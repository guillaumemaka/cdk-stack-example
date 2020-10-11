#!/usr/bin/env node

const cdk = require('@aws-cdk/core');
const { HabilhomeAwsFargateStack } = require('../lib/habilhome-aws-fargate-stack');

const app = new cdk.App();
new HabilhomeAwsFargateStack(app, 'HabilhomeAwsFargateStack');
