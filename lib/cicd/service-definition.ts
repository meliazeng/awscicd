// /lib/cicd/service-definition.ts
import { PolicyStatement } from '@aws-cdk/aws-iam';

/** Defines things that can vary between each serverless.yml service */
export interface ServiceDefinition {
    serviceName: string;
    githubRepo: string;
    githubOwner: string;
    githubTokenSsmPath: string;
    /** Permissions that CodeBuild role needs to assume to deploy serverless stack */
    deployPermissions: PolicyStatement[];
}
