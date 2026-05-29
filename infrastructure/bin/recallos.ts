#!/usr/bin/env bun
import { App } from "aws-cdk-lib";
import { loadConfig } from "../lib/config";
import { EcrStack } from "../lib/ecr-stack";
import { ServiceStack } from "../lib/service-stack";

const app = new App();
const config = loadConfig(app);

new EcrStack(app, "RecallosEcrStack", { env: config.env, config });
new ServiceStack(app, "RecallosServiceStack", { env: config.env, config });

app.synth();
