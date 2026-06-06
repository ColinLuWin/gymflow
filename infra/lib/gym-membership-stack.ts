import * as cdk from 'aws-cdk-lib/core';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import { Construct } from 'constructs';

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

    // GSI: 查詢到期會員 (PK=membershipStatus, SK=expiryDate)
    table.addGlobalSecondaryIndex({
      indexName: 'status-expiry-index',
      partitionKey: { name: 'membershipStatus', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'expiryDate', type: dynamodb.AttributeType.STRING },
    });

    // GSI: 報到統計 (PK=locationId, SK=checkinAt)
    table.addGlobalSecondaryIndex({
      indexName: 'checkin-date-index',
      partitionKey: { name: 'locationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'checkinAt', type: dynamodb.AttributeType.STRING },
    });

    // ── Cognito ───────────────────────────────────────────────────────────
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

    const userPoolClient = new cognito.UserPoolClient(this, 'GymUserPoolClient', {
      userPool,
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
    });

    // 角色群組
    new cognito.CfnUserPoolGroup(this, 'AdminGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'admin',
    });

    new cognito.CfnUserPoolGroup(this, 'TrainerGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'trainer',
    });

    new cognito.CfnUserPoolGroup(this, 'MemberGroup', {
      userPoolId: userPool.userPoolId,
      groupName: 'member',
    });

    // ── Lambda functions ──────────────────────────────────────────────────
    const commonEnv = {
      TABLE_NAME: table.tableName,
      USER_POOL_ID: userPool.userPoolId,
      USER_POOL_CLIENT_ID: userPoolClient.userPoolClientId,
    };

    const servicesLockFile = path.join(__dirname, '../../services/package-lock.json');

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
      environment: commonEnv,
    });

    table.grantReadWriteData(memberHandler);
    table.grantReadWriteData(authHandler);

    authHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'cognito-idp:SignUp',
          'cognito-idp:ConfirmSignUp',
          'cognito-idp:InitiateAuth',
          'cognito-idp:AdminAddUserToGroup',
        ],
        resources: [userPool.userPoolArn],
      })
    );

    // ── API Gateway ───────────────────────────────────────────────────────
    const api = new apigateway.HttpApi(this, 'GymApi', {
      apiName: 'gym-membership-api',
      corsPreflight: {
        allowHeaders: ['Content-Type', 'Authorization'],
        allowMethods: [apigateway.CorsHttpMethod.ANY],
        allowOrigins: ['*'],
      },
    });

    const jwtAuthorizer = new authorizers.HttpJwtAuthorizer(
      'CognitoAuthorizer',
      `https://cognito-idp.ap-northeast-1.amazonaws.com/${userPool.userPoolId}`,
      {
        jwtAudience: [userPoolClient.userPoolClientId],
      }
    );

    // Auth routes (public)
    api.addRoutes({
      path: '/auth/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('AuthIntegration', authHandler),
    });

    // Member routes (protected)
    api.addRoutes({
      path: '/members/{proxy+}',
      methods: [apigateway.HttpMethod.ANY],
      integration: new integrations.HttpLambdaIntegration('MemberIntegration', memberHandler),
      authorizer: jwtAuthorizer,
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
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'TableName', {
      value: table.tableName,
    });
  }
}
