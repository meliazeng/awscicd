// /lib/cicd/pipelines.ts
// Library of CICD constructs to use for creating a CICD pipeline using CodePipeline and CodeBuild
import { Construct, Stack, SecretParameter } from '@aws-cdk/cdk';
import {
    Role, ServicePrincipal, Policy, PolicyStatement, PolicyStatementEffect,
} from '@aws-cdk/aws-iam';
import { Topic } from '@aws-cdk/aws-sns';
import { EventRule } from '@aws-cdk/aws-events';
import { Pipeline, GitHubSourceAction } from '@aws-cdk/aws-codepipeline';
import {
    Project, CodePipelineSource, LinuxBuildImage,
} from '@aws-cdk/aws-codebuild';
import { ServiceDefinition } from './service-definition';
import { CrossAccountDeploymentRole } from './cross-account-deployment';
import { deploymentTargetAccounts } from '../../stacks/config';

export enum SourceTrigger {
    Master = 'master', // triggered on merge to master
    PullRequest = 'pr', // triggered on create/update of PR on a feature branch
}

export interface StageConfig {
    accountId: string;
}

export interface DeploymentTargetAccounts {
    [stage: string]: StageConfig;
}

export interface ServiceCicdPipelinesProps {
    services: ServiceDefinition[];
    deploymentTargetAccounts: DeploymentTargetAccounts;
}

/** Container for grouping all service pipelines into a single CloudFormation stack. */
export class ServiceCicdPipelines extends Construct {
    readonly stack: Stack;

    readonly alertsTopic: Topic;

    readonly pipelines: Pipeline[] = [];

    constructor(scope: Construct, id: string, props: ServiceCicdPipelinesProps) {
        super(scope, id);
        this.stack = new Stack(this, 'cicd', {
            stackName: 'cicd-pipelines',
        });
        this.alertsTopic = new Topic(this.stack, 'cicd-notifications', {
            topicName: 'cicd-notifications',
            displayName: 'CICD pipeline failed',
        });
        this.alertsTopic.export();
        props.services.forEach((service) => {
            this.pipelines.push(new ServicePipeline(this.stack, `${service.serviceName}_pipeline`, {
                service,
                sourceTrigger: SourceTrigger.Master,
                alertsTopic: this.alertsTopic,
                deploymentTargetAccounts: props.deploymentTargetAccounts,
            }).pipeline);
            // TODO: also create a PR pipeline
        });
    }
}

export interface ServicePipelineProps {
    /** Information about service to be built & deployed (source repo, etc) */
    service: ServiceDefinition;
    /** Trigger on PR or Master merge?  */
    sourceTrigger: SourceTrigger;
    /** Account details for where this service will be deployed to */
    deploymentTargetAccounts: DeploymentTargetAccounts;
    /** Optional SNS topic to send pipeline failure notifications to */
    alertsTopic?: Topic;
}

/** Creates a single end-to-end Pipeline for a specific service definition. */
export class ServicePipeline extends Construct {
    readonly pipeline: Pipeline;

    readonly alert: PipelineFailedAlert;

    constructor(scope: Construct, id: string, props: ServicePipelineProps) {
        super(scope, id);
        const pipelineName = `${props.service.serviceName}_${props.sourceTrigger}`;
        this.pipeline = new Pipeline(scope, pipelineName, {
            pipelineName,
        });

        // https://docs.aws.amazon.com/codepipeline/latest/userguide/GitHub-rotate-personal-token-CLI.html
        const oauth = new SecretParameter(scope, 'GithubPersonalAccessToken', {
            ssmParameter: props.service.githubTokenSsmPath,
        });

        const sourceAction = new GitHubSourceAction({
            actionName: props.sourceTrigger === SourceTrigger.PullRequest ? 'GitHub_SubmitPR' : 'GitHub_PushToMaster',
            owner: props.service.githubOwner,
            repo: props.service.githubRepo,
            branch: 'master',
            oauthToken: oauth.value,
            outputArtifactName: 'SourceOutput',
        });

        this.pipeline.addStage({
            name: 'Source',
            actions: [sourceAction],
        });

        // Create stages for DEV => STAGING => PROD.
        // Each stage defines its own steps in its own build file
        const buildProject = new ServiceCodebuildProject(this.pipeline, 'buildProject', {
            projectName: `${pipelineName}_dev`,
            buildSpec: 'buildspec.dev.yml',
            deployerRoleArn: CrossAccountDeploymentRole.getRoleArnForService(
                props.service.serviceName, 'dev', deploymentTargetAccounts.dev.accountId,
            ),
        });
        const buildAction = buildProject.project.toCodePipelineBuildAction({
            actionName: 'Build_Deploy_DEV',
            inputArtifact: sourceAction.outputArtifact,
            outputArtifactName: 'sourceOutput',
            additionalOutputArtifactNames: [
                'devPackage',
                'stagingPackage',
                'prodPackage',
            ],
        });
        this.pipeline.addStage({
            name: 'Build_Deploy_DEV',
            actions: [buildAction],
        });
        const stagingProject = new ServiceCodebuildProject(this.pipeline, 'deploy-staging', {
            projectName: `${pipelineName}_staging`,
            buildSpec: 'buildspec.staging.yml',
            deployerRoleArn: CrossAccountDeploymentRole.getRoleArnForService(
                props.service.serviceName, 'staging', deploymentTargetAccounts.staging.accountId,
            ),
        });
        const stagingAction = stagingProject.project.toCodePipelineBuildAction({
            actionName: 'Deploy_STAGING',
            inputArtifact: sourceAction.outputArtifact,
            additionalInputArtifacts: [
                buildAction.additionalOutputArtifact('stagingPackage'),
            ],
        });
        this.pipeline.addStage({
            name: 'Deploy_STAGING',
            actions: [stagingAction],
        });

        // Prod stage requires cross-account access as codebuild isn't running in same account
        const prodProject = new ServiceCodebuildProject(this.pipeline, 'deploy-prod', {
            projectName: `${pipelineName}_prod`,
            buildSpec: 'buildspec.prod.yml',
            deployerRoleArn: CrossAccountDeploymentRole.getRoleArnForService(
                props.service.serviceName, 'prod', deploymentTargetAccounts.prod.accountId,
            ),
        });
        const prodAction = prodProject.project.toCodePipelineBuildAction({
            actionName: 'Deploy_PROD',
            inputArtifact: sourceAction.outputArtifact,
            additionalInputArtifacts: [
                buildAction.additionalOutputArtifact('prodPackage'),
            ],
        });
        this.pipeline.addStage({
            name: 'Deploy_PROD',
            actions: [prodAction],
        });

        // Wire up pipeline error notifications
        if (props.alertsTopic) {
            this.alert = new PipelineFailedAlert(this, 'pipeline-failed-alert', {
                pipeline: this.pipeline,
                alertsTopic: props.alertsTopic,
            });
        }
    }
}

export interface ServiceCodebuildActionProps {
    projectName: string;
    buildSpec?: string;
    deployerRoleArn: string;
}

export class ServiceCodebuildProject extends Construct {
    readonly buildRole: Role;

    readonly project: Project;

    constructor(scope: Construct, id: string, props: ServiceCodebuildActionProps) {
        super(scope, id);

        this.buildRole = new ServiceDeployerRole(this, 'project-role', {
            deployerRoleArn: props.deployerRoleArn,
        }).buildRole;

        this.project = new Project(this, 'build-project', {
            projectName: props.projectName,
            timeout: 10, // minutes
            environment: {
                buildImage: LinuxBuildImage.UBUNTU_14_04_NODEJS_8_11_0,
            },
            source: new CodePipelineSource(),
            buildSpec: props.buildSpec || 'buildspec.yml',
            role: this.buildRole,
        });
    }
}

export interface ServiceDeployerRoleProps {
    deployerRoleArn: string;
}
export class ServiceDeployerRole extends Construct {
    readonly buildRole: Role;

    readonly policy: Policy;

    constructor(scope: Construct, id: string, props: ServiceDeployerRoleProps) {
        super(scope, id);
        this.buildRole = new Role(this, 'Default', {
            assumedBy: new ServicePrincipal('codebuild.amazonaws.com'),
        });
        // Allow CodeBuild to assume role of deployer
        const assumeStatement = new PolicyStatement(PolicyStatementEffect.Allow)
            .addAction('sts:AssumeRole')
            .addResource(props.deployerRoleArn);
        this.policy = new Policy(scope, 'sls-deployer-policy', {
            statements: [assumeStatement],
        });
        this.policy.attachToRole(this.buildRole);
    }
}

export interface PipelineFailedAlertProps {
    pipeline: Pipeline;
    alertsTopic: Topic;
}

/** Creates alert to send SNS notification if pipeline fails */
export class PipelineFailedAlert extends Construct {
    readonly rule: EventRule;

    constructor(scope: Construct, id: string, props: PipelineFailedAlertProps) {
        super(scope, id);
        this.rule = new EventRule(scope, 'pipeline_failed_rule', {
            ruleName: `${props.pipeline.pipelineName}_pipeline_failed_rule`,
        });
        this.rule.addEventPattern({
            source: ['aws.codepipeline'],
            detailType: ['CodePipeline Pipeline Execution State Change'],
            detail: {
                pipeline: [props.pipeline.pipelineName],
                state: ['FAILED'],
            },
        });

        this.rule.addTarget(props.alertsTopic);
        this.rule.export();
    }
}