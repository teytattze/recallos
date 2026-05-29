import { Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
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

    // Imported by name rather than via a cross-stack export: CI references the
    // same name, and it keeps this stack independent of the ECR stack.
    const repository = ecr.Repository.fromRepositoryName(
      this,
      "Repository",
      config.ecrRepositoryName,
    );

    for (const service of config.services) {
      this.deployService(cluster, repository, service, config.imageTag);
    }
  }

  private deployService(
    cluster: ecs.ICluster,
    repository: ecr.IRepository,
    service: ServiceConfig,
    imageTag: string,
  ): void {
    // CI tags every app image as `<app>.<version>` in the one repository.
    const image = ecs.ContainerImage.fromEcrRepository(
      repository,
      `${service.name}.${imageTag}`,
    );
    const environment = { AWS_REGION: this.region };

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
    new ecs.FargateService(this, service.name, {
      cluster,
      taskDefinition,
      desiredCount: service.desiredCount,
      minHealthyPercent: 100,
      circuitBreaker: { rollback: true },
    });
  }
}
