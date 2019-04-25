export const pipelineAccountId = '1234567890';
export const githubOwner = 'yourownername';
export const githubTokenSsmPath = '/path/to/github-personal-access-token';

/** List of stages/accounts that CICD pipeline can deploy to */
export const deploymentTargetAccounts = {
    tools: {
        accountId: '1234567890',
    },
    staging: {
        accountId: '56789012345',
    },
    prod: {
        accountId: '987654321',
    },
};
