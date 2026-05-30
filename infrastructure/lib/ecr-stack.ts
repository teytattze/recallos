import type { Construct } from "constructs";

import { RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as ecr from "aws-cdk-lib/aws-ecr";

import type { RecallosConfig } from "./config";

export interface EcrStackProps extends StackProps {
  readonly config: RecallosConfig;
}

/**
 * The registry CI pushes to. Deploy this first so the repository exists before
 * images are pushed; the service stack then imports it by name.
 */
export class EcrStack extends Stack {
  constructor(scope: Construct, id: string, props: EcrStackProps) {
    super(scope, id, props);

    new ecr.Repository(this, "Repository", {
      repositoryName: props.config.ecrRepositoryName,
      imageScanOnPush: true,
      // Keep images even if the stack is torn down — they are the artifacts.
      removalPolicy: RemovalPolicy.RETAIN,
      lifecycleRules: [{ maxImageCount: 20 }],
    });
  }
}
