#!/usr/bin/env node
import 'source-map-support/register';
import cdk = require('@aws-cdk/cdk');
import { AwscicdStack } from '../lib/awscicd-stack';

const app = new cdk.App();
new AwscicdStack(app, 'AwscicdStack');
