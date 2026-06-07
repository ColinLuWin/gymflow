import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  ConfirmSignUpCommand,
  InitiateAuthCommand,
  AdminAddUserToGroupCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const cognito = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CLIENT_ID = process.env.USER_POOL_CLIENT_ID!;
const USER_POOL_ID = process.env.USER_POOL_ID!;
const TABLE_NAME = process.env.TABLE_NAME!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function ok(body: unknown, status = 200): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify(body),
  };
}

function err(message: string, status: number): APIGatewayProxyResultV2 {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json', ...CORS },
    body: JSON.stringify({ message }),
  };
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, string> {
  try {
    return JSON.parse(event.body ?? '{}');
  } catch {
    return {};
  }
}

async function register(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { email, password, name, phone } = parseBody(event);
  if (!email || !password || !name) {
    return err('email, password, name are required', 400);
  }

  const signUp = await cognito.send(
    new SignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
      ],
    })
  );

  const sub = signUp.UserSub!;

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      GroupName: 'member',
    })
  );

  const now = new Date().toISOString();
  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `MEMBER#${sub}`,
        SK: 'PROFILE',
        sub,
        email,
        name,
        ...(phone ? { phone } : {}),
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

  return ok({ message: 'Registration successful. Check your email for the confirmation code.', sub }, 201);
}

async function confirm(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { email, code } = parseBody(event);
  if (!email || !code) {
    return err('email and code are required', 400);
  }

  await cognito.send(
    new ConfirmSignUpCommand({
      ClientId: CLIENT_ID,
      Username: email,
      ConfirmationCode: code,
    })
  );

  return ok({ message: 'Email confirmed. You can now log in.' });
}

async function login(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { email, password } = parseBody(event);
  if (!email || !password) {
    return err('email and password are required', 400);
  }

  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.USER_PASSWORD_AUTH,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    })
  );

  const tokens = result.AuthenticationResult;
  return ok({
    idToken: tokens?.IdToken,
    accessToken: tokens?.AccessToken,
    refreshToken: tokens?.RefreshToken,
    expiresIn: tokens?.ExpiresIn,
  });
}

async function refresh(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { refreshToken } = parseBody(event);
  if (!refreshToken) {
    return err('refreshToken is required', 400);
  }

  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    })
  );

  const tokens = result.AuthenticationResult;
  return ok({
    idToken: tokens?.IdToken,
    accessToken: tokens?.AccessToken,
    expiresIn: tokens?.ExpiresIn,
  });
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log({ method, path });

  if (method === 'OPTIONS') return { statusCode: 200, headers: { ...CORS }, body: '' };

  try {
    if (method === 'POST' && path === '/auth/register') return await register(event);
    if (method === 'POST' && path === '/auth/confirm') return await confirm(event);
    if (method === 'POST' && path === '/auth/login') return await login(event);
    if (method === 'POST' && path === '/auth/refresh') return await refresh(event);

    return err('Not found', 404);
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    console.error({ errorName: error.name, errorMessage: error.message });

    if (error.name === 'UsernameExistsException') return err('Email already registered', 409);
    if (error.name === 'UserNotFoundException') return err('Invalid credentials', 401);
    if (error.name === 'NotAuthorizedException') return err('Invalid credentials', 401);
    if (error.name === 'CodeMismatchException') return err('Invalid confirmation code', 400);
    if (error.name === 'ExpiredCodeException') return err('Confirmation code expired', 400);
    if (error.name === 'UserNotConfirmedException') return err('Email not confirmed', 403);

    return err('Internal server error', 500);
  }
};
