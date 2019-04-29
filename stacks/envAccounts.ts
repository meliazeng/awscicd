// /stacks/envAccounts.ts
// CDK app which creates a stack using a set of service definitions
import 'source-map-support/register';
import { App } from '@aws-cdk/cdk';
import { deploymentTargetAccounts } from './config';
import services from './services';
import { CrossAccountDeploymentRole } from '../lib/cicd/cross-account-deployment';

const app = new App({
    autoRun: false,
});

new CrossAccountDeploymentRole(app, "account", {
    services,
    deploymentTargetAccounts,  
});
app.run();
