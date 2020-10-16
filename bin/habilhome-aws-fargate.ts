#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { HabilhomeAwsFargateStack } from '../lib/habilhome-aws-fargate-stack';

const app = new cdk.App();
new HabilhomeAwsFargateStack(app, 'HabilhomeAwsFargateStack');
