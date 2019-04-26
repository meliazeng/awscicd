// /lib/cicd/service-definition.ts
import { PolicyStatement } from '@aws-cdk/aws-iam';

/** Defines things that can vary between each serverless.yml service */
export interface ServiceDefinition {
    serviceName: string;
    githubRepoService: string;
    githubRepoMVP: string;
    githubOwner: string;
    githubTokenSsmPath: string;
    accessPermissions: PolicyStatement[];
    /** Permissions that CodeBuild role needs to assume to deploy serverless stack */
    deployPermissions: PolicyStatement[];
    s3DeployBucketStagingArn: string;
    s3DeployBucketProdArn: string;
}
