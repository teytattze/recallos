import type { Construct } from "constructs";

import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import { ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as sqs from "aws-cdk-lib/aws-sqs";

import type { DomainConfig, RecallosConfig, ServiceConfig } from "./config";

export interface ServiceStackProps extends StackProps {
  readonly config: RecallosConfig;
  // Provisioned in the network stack and imported here so releases never touch them.
  readonly vpc: ec2.IVpc;
  readonly cluster: ecs.ICluster;
}

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const { config, vpc, cluster } = props;

    const database = this.createDatabase(vpc);
    const queue = this.createOutboxQueue();

    const repository = ecr.Repository.fromRepositoryName(
      this,
      "Repository",
      config.ecrRepositoryName,
    );

    for (const service of config.services) {
      this.deployService(
        cluster,
        repository,
        database,
        queue,
        service,
        config.imageTag,
        config.domain,
      );
    }
  }

  private createDatabase(vpc: ec2.IVpc): rds.DatabaseCluster {
    return new rds.DatabaseCluster(this, "Database", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_8,
      }),
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      writer: rds.ClusterInstance.serverlessV2("Writer"),
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: 2,
      credentials: rds.Credentials.fromGeneratedSecret("recallos"),
      defaultDatabaseName: "recallos",
    });
  }

  private createOutboxQueue(): sqs.Queue {
    const deadLetter = new sqs.Queue(this, "OutboxDlq", {
      retentionPeriod: Duration.days(14),
    });
    return new sqs.Queue(this, "OutboxQueue", {
      visibilityTimeout: Duration.seconds(30),
      deadLetterQueue: { queue: deadLetter, maxReceiveCount: 5 },
    });
  }

  private deployService(
    cluster: ecs.ICluster,
    repository: ecr.IRepository,
    database: rds.DatabaseCluster,
    queue: sqs.Queue,
    service: ServiceConfig,
    imageTag: string,
    domain: DomainConfig | undefined,
  ): void {
    const image = ecs.ContainerImage.fromEcrRepository(
      repository,
      `${service.name}.${imageTag}`,
    );

    // `unsafeUnwrap` renders a `{{resolve:secretsmanager:…}}` dynamic reference, so
    // the password stays out of source; sslmode=no-verify uses Aurora's TLS without
    // bundling the RDS CA. The apps read a single DATABASE_URL (Prisma + pg adapter).
    const databaseUrl =
      `postgresql://recallos:${database.secret!.secretValueFromJson("password").unsafeUnwrap()}` +
      `@${database.clusterEndpoint.hostname}:${database.clusterEndpoint.port}/recallos?sslmode=no-verify`;

    const environment: Record<string, string> = {
      AWS_REGION: this.region,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl,
    };

    if (service.needsQueue) {
      environment.SQS_QUEUE_URL = queue.queueUrl;
    }

    if (service.exposed) {
      // With a domain the construct provisions an HTTPS:443 listener (cert
      // below), an HTTP:80 listener that redirects to it, and the Route53
      // alias record; without one it stays a plain HTTP:80 ALB.
      let domainOptions = {};
      if (domain) {
        const zone = route53.HostedZone.fromLookup(this, "Zone", {
          domainName: domain.zoneName,
        });
        const certificate = new acm.Certificate(this, "ApiCertificate", {
          domainName: domain.recordName,
          validation: acm.CertificateValidation.fromDns(zone),
        });
        domainOptions = {
          protocol: ApplicationProtocol.HTTPS,
          certificate,
          domainName: domain.recordName,
          domainZone: zone,
          redirectHTTP: true,
        };
      }

      const loadBalanced =
        new ecsPatterns.ApplicationLoadBalancedFargateService(
          this,
          service.name,
          {
            cluster,
            cpu: service.cpu,
            memoryLimitMiB: service.memoryLimitMiB,
            desiredCount: service.desiredCount,
            publicLoadBalancer: true,
            minHealthyPercent: 100,
            circuitBreaker: { rollback: true },
            taskImageOptions: {
              image,
              containerPort: service.containerPort,
              environment,
              family: service.name,
            },
            ...domainOptions,
          },
        );
      loadBalanced.targetGroup.configureHealthCheck({ path: "/api/v1/health" });
      database.connections.allowDefaultPortFrom(loadBalanced.service);
      return;
    }

    const taskDefinition = new ecs.FargateTaskDefinition(
      this,
      `${service.name}-task`,
      {
        cpu: service.cpu,
        memoryLimitMiB: service.memoryLimitMiB,
        family: service.name,
      },
    );

    taskDefinition.addContainer(`${service.name}-container`, {
      image,
      environment,
      logging: ecs.LogDrivers.awsLogs({ streamPrefix: service.name }),
    });

    if (service.needsQueue) {
      queue.grantSendMessages(taskDefinition.taskRole);
    }

    const fargateService = new ecs.FargateService(this, service.name, {
      cluster,
      taskDefinition,
      desiredCount: service.desiredCount,
      minHealthyPercent: 100,
      circuitBreaker: { rollback: true },
    });

    database.connections.allowDefaultPortFrom(fargateService);
  }
}
