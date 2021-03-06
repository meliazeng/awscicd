// List of services that will have CICD pipelines and deployment roles created for them
import { PolicyStatement, PolicyStatementEffect } from '@aws-cdk/aws-iam';
import { ServiceDefinition } from '../lib/cicd/service-definition';
import { githubOwner, githubTokenSsmPath } from './config';

const mySlsService: ServiceDefinition = {
    serviceName: 'profound-impact',
    githubRepoService: 'testSrv',
    githubRepoMVP: 'testWeb',
    githubOwner,
    githubTokenSsmPath,
    s3DeployBucketProdArn: 'arn:aws:s3:::bucketwebsite321',
    s3DeployBucketStagingArn: 'arn:aws:s3:::bucketwebsite123',
    accessPermissions: [
        new PolicyStatement(PolicyStatementEffect.Allow)
            .addActions(
                's3:ListAllMyBuckets',
                's3:GetBucketLocation',
                's3:PutObject',
                's3:GetObject',
                'sts:AssumeRole',
                's3:ListBucket',
                's3:GetBucketPolicy'
            )
    ],

    // TODO: should lock down below permissions to specific resources
    deployPermissions: [
        new PolicyStatement(PolicyStatementEffect.Allow)
            .addActions(
                'cloudformation:*', // TODO: tighten up
                'lambda:AddPermission',
                'lambda:CreateAlias',
                'lambda:CreateFunction',
                'lambda:DeleteFunction',
                'lambda:InvokeFunction',
                'lambda:PublishVersion',
                'lambda:RemovePermission',
                'lambda:Update*',
                'lambda:GetFunctionConfiguration',
                'lambda:GetFunction',
                'lambda:ListVersionsByFunction',
                'iam:CreateRole',
                'iam:CreatePolicy',
                'iam:GetRole',
                'iam:DeleteRole',
                'iam:PutRolePolicy',
                'iam:PassRole',
                'iam:DeleteRolePolicy',
                // <serverless-domain-manager> plugin: https://www.npmjs.com/package/serverless-domain-manager#prerequisites
                'apigateway:*', // TODO: tighten up
                'acm:ListCertificates',
                'cloudfront:UpdateDistribution',
                'route53:ListHostedZones',
                'route53:ChangeResourceRecordSets',
                'route53:GetHostedZone',
                'route53:ListResourceRecordSets',
                // </serverless-domain-manager>,
                's3:CreateBucket',
                's3:DeleteBucket',
                's3:ListBucket',
                's3:ListBucketVersion',
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:SetBucketEncryption',
                's3:PutBucketAcl',
                's3:GetEncryptionConfiguration',
                's3:PutEncryptionConfiguration',
                'logs:*', // logs:PutRetentionPolicy
            ).addAllResources(),
    ],
};

export default [
    mySlsService,
];

