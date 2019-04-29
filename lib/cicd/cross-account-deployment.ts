// /lib/cicd/cross-account-deployment.ts
// Creates roles in target accounts (e.g. prod) where codepipeline does a cross-account deployment to.

import { Construct } from '@aws-cdk/cdk';
import {
    Role, AccountPrincipal, Policy, PolicyStatement, PolicyStatementEffect,
} from '@aws-cdk/aws-iam';
import { ServiceDefinition } from './service-definition';
import { DeploymentTargetAccounts } from './pipelines';
import ssm = require('@aws-cdk/aws-ssm')

export interface CrossAccountDeploymentRoleProps {
    services: ServiceDefinition[];
    /** account ID where CodePipeline/CodeBuild is hosted */
    deploymentTargetAccounts: DeploymentTargetAccounts;
}

/**
 * Creates an IAM role to allow for cross-account deployment of a service's resources.
 */
export class CrossAccountDeploymentRole extends Construct {
    public static getRoleNameForService(serviceName: string, stage: string): string {
        return `${serviceName}-${stage}-deployer-role`;
    }

    public static getRoleArnForService(serviceName: string, stage: string, accountId: string): string {
        return `arn:aws:iam::${accountId}:role/${CrossAccountDeploymentRole.getRoleNameForService(serviceName, stage)}`;
    }

    readonly deployerRole: Role;

    readonly deployerPolicy: Policy;

    readonly roleName: string;

    public constructor(scope: Construct, id: string, props: CrossAccountDeploymentRoleProps) {
        super(scope, id);

        const stageName = new ssm.ParameterStoreString(this, 'MyParameter', {
            parameterName: 'stage_name',
            version: 1,
        });

        this.roleName = CrossAccountDeploymentRole.getRoleNameForService(props.services[0].serviceName, stageName.toString());
        // Cross-account assume role
        // https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-iam.html#configuring-an-externalid
        this.deployerRole = new Role(this, 'deployerRole', {
            roleName: this.roleName,
            assumedBy: new AccountPrincipal(props.deploymentTargetAccounts.Tools),
        });
        const passrole = new PolicyStatement(PolicyStatementEffect.Allow)
            .addActions(
                'iam:PassRole',
            ).addAllResources();
        this.deployerPolicy = new Policy(this, 'deployerPolicy', {
            policyName: `${this.roleName}-policy`,
            statements: [passrole, ...props.services[0].deployPermissions],
        });
        this.deployerPolicy.attachToRole(this.deployerRole);
        this.deployerRole.export();
    }
}
