#!/usr/bin/env bun
import { App } from "aws-cdk-lib";

import { loadConfig } from "../lib/config";
import { EcrStack } from "../lib/ecr-stack";
import { NetworkStack } from "../lib/network-stack";
import { ServiceStack } from "../lib/service-stack";

const app = new App();
const config = loadConfig(app);

new EcrStack(app, "RecallosEcrStack", { env: config.env, config });
const network = new NetworkStack(app, "RecallosNetworkStack", {
  env: config.env,
});
new ServiceStack(app, "RecallosServiceStack", {
  env: config.env,
  config,
  vpc: network.vpc,
  cluster: network.cluster,
});

app.synth();
