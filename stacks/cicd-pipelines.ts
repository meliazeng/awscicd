// /stacks/cicd-pipelines.ts
// CDK app which creates a stack using a set of service definitions
import 'source-map-support/register';
import { App } from '@aws-cdk/cdk';
import { ServiceCicdPipelines } from '../lib/cicd/pipelines';
import { deploymentTargetAccounts } from './config';

import services from './services';

const app = new App({
    autoRun: false,
});

new ServiceCicdPipelines(app, 'Default', {
    services,
    deploymentTargetAccounts,
});
app.run();
