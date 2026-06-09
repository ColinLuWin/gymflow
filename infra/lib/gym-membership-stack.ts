import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';
import { Construct } from 'constructs';

const MEMBER_PORTAL_URL = 'https://dv3vkkn6m5tr2.cloudfront.net';
const ADMIN_PORTAL_URL  = 'https://d3h5wal582eh13.cloudfront.net';

export class GymMembershipStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // ── DynamoDB ──────────────────────────────────────────────────────────
    const table = new dynamodb.Table(this, 'GymTable', {
      tableName: 'gym-membership',
      partitionKey: { name: 'PK', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    table.addGlobalSecondaryIndex({
      indexName: 'status-expiry-index',
      partitionKey: { name: 'membershipStatus', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'expiryDate', type: dynamodb.AttributeType.STRING },
    });

    table.addGlobalSecondaryIndex({
      indexName: 'checkin-date-index',
      partitionKey: { name: 'locationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'checkinAt', type: dynamodb.AttributeType.STRING },
    });

    // ── Cognito User Pool ─────────────────────────────────────────────────
    const userPool = new cognito.UserPool(this, 'GymUserPool', {
      userPoolName: 'gym-membership-users',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cognito.CfnUserPoolGroup(this, 'AdminGroup',   { userPoolId: userPool.userPoolId, groupName: 'admin' });
    new cognito.CfnUserPoolGroup(this, 'TrainerGroup', { userPoolId: userPool.userPoolId, groupName: 'trainer' });
    new cognito.CfnUserPoolGroup(this, 'MemberGroup',  { userPoolId: userPool.userPoolId, groupName: 'member' });

    // ── Cognito Hosted UI Domain ──────────────────────────────────────────
    const userPoolDomain = new cognito.UserPoolDomain(this, 'GymUserPoolDomain', {
      userPool,
      cognitoDomain: { domainPrefix: 'gymflow-auth' },
    });

    // ── OAuth Secrets (Secrets Manager) ──────────────────────────────────
    const googleSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'GoogleOAuthSecret', 'gymflow/google-oauth'
    );
    const lineSecret = secretsmanager.Secret.fromSecretNameV2(
      this, 'LineOAuthSecret', 'gymflow/line'
    );

    // ── Google Identity Provider ──────────────────────────────────────────
    const googleProvider = new cognito.UserPoolIdentityProviderGoogle(this, 'GoogleProvider', {
      userPool,
      clientId: googleSecret.secretValueFromJson('clientId').unsafeUnwrap(),
      clientSecretValue: googleSecret.secretValueFromJson('clientSecret'),
      scopes: ['email', 'profile', 'openid'],
      attributeMapping: {
        email:          cognito.ProviderAttribute.GOOGLE_EMAIL,
        fullname:       cognito.ProviderAttribute.GOOGLE_NAME,
        profilePicture: cognito.ProviderAttribute.GOOGLE_PICTURE,
      },
    });

    // ── LINE OIDC Identity Provider ───────────────────────────────────────
    // LINE OIDC discovery: https://access.line.me/.well-known/openid-configuration
    // email scope requires LINE Business email permission — omitted intentionally
    const lineProvider = new cognito.UserPoolIdentityProviderOidc(this, 'LineProvider', {
      userPool,
      name: 'LINE',
      clientId:     lineSecret.secretValueFromJson('clientId').unsafeUnwrap(),
      clientSecret: lineSecret.secretValueFromJson('clientSecret').unsafeUnwrap(),
      issuerUrl: 'https://access.line.me',
      scopes: ['openid', 'profile'],
      attributeRequestMethod: cognito.OidcAttributeRequestMethod.GET,
      attributeMapping: {
        fullname:       cognito.ProviderAttribute.other('name'),
        profilePicture: cognito.ProviderAttribute.other('picture'),
      },
    });

    // ── Member Portal UserPoolClient ──────────────────────────────────────
    const memberUserPoolClient = new cognito.UserPoolClient(this, 'GymUserPoolClient', {
      userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          `${MEMBER_PORTAL_URL}/callback`,
          `${MEMBER_PORTAL_URL}/link-callback`,
          'http://localhost:5173/callback',
          'http://localhost:5173/link-callback',
        ],
        logoutUrls: [
          `${MEMBER_PORTAL_URL}/login`,
          'http://localhost:5173/login',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
        cognito.UserPoolClientIdentityProvider.custom('LINE'),
      ],
    });
    memberUserPoolClient.node.addDependency(googleProvider);
    memberUserPoolClient.node.addDependency(lineProvider);

    // ── Admin Portal UserPoolClient ───────────────────────────────────────
    const adminUserPoolClient = new cognito.UserPoolClient(this, 'AdminUserPoolClient', {
      userPool,
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.EMAIL, cognito.OAuthScope.OPENID, cognito.OAuthScope.PROFILE],
        callbackUrls: [
          `${ADMIN_PORTAL_URL}/callback`,
          'http://localhost:5174/callback',
        ],
        logoutUrls: [
          `${ADMIN_PORTAL_URL}/login`,
          'http://localhost:5174/login',
        ],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.GOOGLE,
      ],
    });
    adminUserPoolClient.node.addDependency(googleProvider);

    // ── Lambda functions ──────────────────────────────────────────────────
    const commonEnv = {
      TABLE_NAME:           table.tableName,
      USER_POOL_ID:         userPool.userPoolId,
      USER_POOL_CLIENT_ID:  memberUserPoolClient.userPoolClientId,
    };

    const servicesLockFile = path.join(__dirname, '../../services/package-lock.json');

    const adminHandler = new nodejs.NodejsFunction(this, 'AdminHandler', {
      functionName: 'gym-admin-handler',
      entry: path.join(__dirname, '../../services/admin/index.ts'),
      depsLockFilePath: servicesLockFile,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: commonEnv,
    });

    const memberHandler = new nodejs.NodejsFunction(this, 'MemberHandler', {
      functionName: 'gym-member-handler',
      entry: path.join(__dirname, '../../services/member/index.ts'),
      depsLockFilePath: servicesLockFile,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: commonEnv,
    });

    const authHandler = new nodejs.NodejsFunction(this, 'AuthHandler', {
      functionName: 'gym-auth-handler',
      entry: path.join(__dirname, '../../services/auth/index.ts'),
      depsLockFilePath: servicesLockFile,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        ...commonEnv,
        LINE_CLIENT_ID:     lineSecret.secretValueFromJson('clientId').unsafeUnwrap(),
        LINE_CLIENT_SECRET: lineSecret.secretValueFromJson('clientSecret').unsafeUnwrap(),
      },
    });

    // PostConfirmation trigger — creates DynamoDB member profile on first
    // Google/LINE sign-in and adds the user to the Cognito 'member' group.
    // NOTE: USER_POOL_ID is intentionally absent from env — it's read from
    // event.userPoolId at runtime to avoid a CDK circular dependency:
    //   UserPool → Lambda(trigger) → UserPoolClient → UserPool
    const postConfirmHandler = new nodejs.NodejsFunction(this, 'PostConfirmHandler', {
      functionName: 'gym-post-confirm-handler',
      entry: path.join(__dirname, '../../services/auth/postConfirmation.ts'),
      depsLockFilePath: servicesLockFile,
      handler: 'handler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: {
        TABLE_NAME: table.tableName,
      },
    });

    // Escape hatch: set LambdaConfig directly on CfnUserPool instead of using
    // userPool.addTrigger(), which creates a circular dependency by adding a
    // Lambda permission with sourceArn pointing back to the UserPool.
    const cfnUserPool = userPool.node.defaultChild as cognito.CfnUserPool;
    cfnUserPool.addPropertyOverride('LambdaConfig.PostConfirmation', postConfirmHandler.functionArn);

    // Use sourceAccount (static string) instead of sourceArn to avoid creating
    // a token reference from Lambda back to UserPool.
    postConfirmHandler.addPermission('CognitoPostConfirm', {
      principal: new iam.ServicePrincipal('cognito-idp.amazonaws.com'),
      sourceAccount: this.account,
    });

    // ── IAM ───────────────────────────────────────────────────────────────
    table.grantReadWriteData(memberHandler);
    table.grantReadWriteData(authHandler);
    table.grantReadWriteData(adminHandler);
    table.grantReadWriteData(postConfirmHandler);

    postConfirmHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['cognito-idp:AdminAddUserToGroup'],
        resources: ['*'],
      })
    );

    authHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:InitiateAuth',
          'cognito-idp:AdminLinkProviderForUser',
        ],
        resources: [userPool.userPoolArn],
      })
    );

    adminHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminDeleteUser',
          'cognito-idp:AdminDisableUser',
          'cognito-idp:AdminEnableUser',
          'cognito-idp:AdminAddUserToGroup',
        ],
        resources: [userPool.userPoolArn],
      })
    );

    // ── API Gateway ───────────────────────────────────────────────────────
    const api = new apigateway.HttpApi(this, 'GymApi', {
      apiName: 'gym-membership-api',
    });

    // Accept tokens from both member and admin clients
    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.ap-northeast-1.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [
          memberUserPoolClient.userPoolClientId,
          adminUserPoolClient.userPoolClientId,
        ],
      }
    );

    // /auth/link/line requires a valid JWT — add before the catch-all wildcard
    api.addRoutes({
      path: '/auth/link/line',
      methods: [apigateway.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration('LinkLineIntegration', authHandler),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/auth/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('AuthIntegration', authHandler),
    });

    api.addRoutes({
      path: '/members/{proxy+}',
      methods: [apigateway.HttpMethod.OPTIONS],
      integration: new integrations.HttpLambdaIntegration('MemberOptionsIntegration', memberHandler),
    });
    api.addRoutes({
      path: '/members/{proxy+}',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST, apigateway.HttpMethod.PUT, apigateway.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('MemberIntegration', memberHandler),
      authorizer: jwtAuthorizer,
    });

    api.addRoutes({
      path: '/admin/{proxy+}',
      methods: [apigateway.HttpMethod.OPTIONS],
      integration: new integrations.HttpLambdaIntegration('AdminOptionsIntegration', adminHandler),
    });
    api.addRoutes({
      path: '/admin/{proxy+}',
      methods: [apigateway.HttpMethod.GET, apigateway.HttpMethod.POST, apigateway.HttpMethod.PUT, apigateway.HttpMethod.DELETE],
      integration: new integrations.HttpLambdaIntegration('AdminIntegration', adminHandler),
      authorizer: jwtAuthorizer,
    });

    // ── Frontend hosting ──────────────────────────────────────────────────
    const spaErrorResponses: cloudfront.ErrorResponse[] = [
      { httpStatus: 403, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
      { httpStatus: 404, responseHttpStatus: 200, responsePagePath: '/index.html', ttl: cdk.Duration.seconds(0) },
    ];

    const memberBucket = new s3.Bucket(this, 'MemberPortalBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const memberDistribution = new cloudfront.Distribution(this, 'MemberDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(memberBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: 'index.html',
      errorResponses: spaErrorResponses,
    });

    const adminBucket = new s3.Bucket(this, 'AdminPortalBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const adminDistribution = new cloudfront.Distribution(this, 'AdminDistribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(adminBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      },
      defaultRootObject: 'index.html',
      errorResponses: spaErrorResponses,
    });

    // ── Outputs ───────────────────────────────────────────────────────────
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.apiEndpoint,
      description: 'API Gateway endpoint',
    });

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: memberUserPoolClient.userPoolClientId,
      description: 'Member portal Cognito client ID',
    });

    new cdk.CfnOutput(this, 'AdminUserPoolClientId', {
      value: adminUserPoolClient.userPoolClientId,
      description: 'Admin portal Cognito client ID',
    });

    new cdk.CfnOutput(this, 'CognitoDomain', {
      value: `https://${userPoolDomain.domainName}.auth.ap-northeast-1.amazoncognito.com`,
      description: 'Cognito Hosted UI base URL',
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
    });

    new cdk.CfnOutput(this, 'MemberPortalUrl', {
      value: `https://${memberDistribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'MemberBucketName', {
      value: memberBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'MemberDistributionId', {
      value: memberDistribution.distributionId,
    });

    new cdk.CfnOutput(this, 'AdminPortalUrl', {
      value: `https://${adminDistribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'AdminBucketName', {
      value: adminBucket.bucketName,
    });
    new cdk.CfnOutput(this, 'AdminDistributionId', {
      value: adminDistribution.distributionId,
    });
  }
}
