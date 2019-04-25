// /lib/cicd/cross-account-deployment.ts
// Creates roles in target accounts (e.g. prod) where codepipeline does a cross-account deployment to.

import { Construct } from '@aws-cdk/cdk';
import {
    Role, AccountPrincipal, Policy, PolicyStatement, PolicyStatementEffect,
} from '@aws-cdk/aws-iam';

export interface CrossAccountDeploymentRoleProps {
    serviceName: string;
    /** account ID where CodePipeline/CodeBuild is hosted */
    deployingAccountId: string;
    /** stage for which this role is being created */
    targetStageName: string;
    /** Permissions that deployer needs to assume to deploy stack */
    deployPermissions: PolicyStatement[];
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

    public constructor(parent: Construct, id: string, props: CrossAccountDeploymentRoleProps) {
        super(parent, id);
        this.roleName = CrossAccountDeploymentRole.getRoleNameForService(props.serviceName, props.targetStageName);
        // Cross-account assume role
        // https://awslabs.github.io/aws-cdk/refs/_aws-cdk_aws-iam.html#configuring-an-externalid
        this.deployerRole = new Role(this, 'deployerRole', {
            roleName: this.roleName,
            assumedBy: new AccountPrincipal(props.deployingAccountId),
        });
        const passrole = new PolicyStatement(PolicyStatementEffect.Allow)
            .addActions(
                'iam:PassRole',
            ).addAllResources();
        this.deployerPolicy = new Policy(this, 'deployerPolicy', {
            policyName: `${this.roleName}-policy`,
            statements: [passrole, ...props.deployPermissions],
        });
        this.deployerPolicy.attachToRole(this.deployerRole);
        this.deployerRole.export();
    }
}
