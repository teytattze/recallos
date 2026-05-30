import type { Construct } from "constructs";

import { Stack, type StackProps } from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";

/**
 * Durable networking the service stack consumes: the VPC and ECS cluster rarely
 * change, so isolating them keeps the per-release service changeset small.
 */
export class NetworkStack extends Stack {
  readonly vpc: ec2.Vpc;
  readonly cluster: ecs.Cluster;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", { maxAzs: 2, natGateways: 1 });
    this.cluster = new ecs.Cluster(this, "Cluster", { vpc: this.vpc });
  }
}
