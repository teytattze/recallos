import { Duration, Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as rds from "aws-cdk-lib/aws-rds";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";
import type { RecallosConfig, ServiceConfig } from "./config";

export interface ServiceStackProps extends StackProps {
  readonly config: RecallosConfig;
}

export class ServiceStack extends Stack {
  constructor(scope: Construct, id: string, props: ServiceStackProps) {
    super(scope, id, props);

    const { config } = props;

    const vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });
    const cluster = new ecs.Cluster(this, "Cluster", { vpc });

    // The consolidated Aurora cluster (event log + pgvector + graph) and the
    // outbox SQS queue every app connects to at runtime.
    const database = this.createDatabase(vpc);
    const queue = this.createOutboxQueue();

    // Imported by name rather than via a cross-stack export: CI references the
    // same name, and it keeps this stack independent of the ECR stack.
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
      );
    }
  }

  /** Aurora Serverless v2 PostgreSQL with a generated Secrets Manager credential. */
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

  /** Standard outbox queue with a dead-letter queue — the relay's delivery guarantee. */
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
  ): void {
    // CI tags every app image as `<app>.<version>` in the one repository.
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
      const loadBalanced = new ecsPatterns.ApplicationLoadBalancedFargateService(
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
