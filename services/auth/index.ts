import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  AdminLinkProviderForUserCommand,
  AuthFlowType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const cognito = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const CLIENT_ID       = process.env.USER_POOL_CLIENT_ID!;
const USER_POOL_ID    = process.env.USER_POOL_ID!;
const TABLE_NAME      = process.env.TABLE_NAME!;
const LINE_CLIENT_ID  = process.env.LINE_CLIENT_ID!;
const LINE_CLIENT_SECRET = process.env.LINE_CLIENT_SECRET!;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

function ok(body: unknown, status = 200): APIGatewayProxyResultV2 {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(body) };
}

function err(message: string, status: number): APIGatewayProxyResultV2 {
  return { statusCode: status, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify({ message }) };
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, string> {
  try { return JSON.parse(event.body ?? '{}'); } catch { return {}; }
}

async function refresh(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { refreshToken } = parseBody(event);
  if (!refreshToken) return err('refreshToken is required', 400);

  const result = await cognito.send(
    new InitiateAuthCommand({
      ClientId: CLIENT_ID,
      AuthFlow: AuthFlowType.REFRESH_TOKEN_AUTH,
      AuthParameters: { REFRESH_TOKEN: refreshToken },
    })
  );

  const tokens = result.AuthenticationResult;
  return ok({ idToken: tokens?.IdToken, accessToken: tokens?.AccessToken, expiresIn: tokens?.ExpiresIn });
}

async function linkLine(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  // Claims are injected by API Gateway JWT authorizer on this route
  const claims = event.requestContext.authorizer?.jwt?.claims ?? {};
  const sub             = claims['sub'] as string | undefined;
  const cognitoUsername = claims['cognito:username'] as string | undefined;
  if (!sub || !cognitoUsername) return err('Unauthorized', 401);

  const { code, redirectUri } = parseBody(event);
  if (!code || !redirectUri) return err('code and redirectUri are required', 400);

  // Exchange LINE authorization code for tokens
  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  redirectUri,
      client_id:     LINE_CLIENT_ID,
      client_secret: LINE_CLIENT_SECRET,
    }).toString(),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text();
    console.error('LINE token exchange failed', body);
    return err('Failed to exchange LINE authorization code', 400);
  }

  const lineTokens = await tokenRes.json() as { id_token?: string };
  const idToken = lineTokens.id_token;
  if (!idToken) return err('LINE id_token missing — ensure openid scope is requested', 400);

  // Decode id_token (no verification needed — trust Cognito + LINE for the linking step)
  const [, payloadB64] = idToken.split('.');
  const linePayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as { sub?: string };
  const lineUserId = linePayload.sub;
  if (!lineUserId) return err('Unable to extract LINE user ID from id_token', 400);

  // Link LINE identity to the existing Cognito user so future LINE logins work
  try {
    await cognito.send(
      new AdminLinkProviderForUserCommand({
        UserPoolId: USER_POOL_ID,
        DestinationUser: {
          ProviderName:           'Cognito',
          ProviderAttributeName:  'Cognito_Subject',
          ProviderAttributeValue: cognitoUsername,
        },
        SourceUser: {
          ProviderName:           'LINE',
          ProviderAttributeName:  'Cognito_Subject',
          ProviderAttributeValue: lineUserId,
        },
      })
    );
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    // Already linked to this user — treat as success and fall through to persist lineUserId
    if (!(error.name === 'InvalidParameterException' && error.message?.includes('already linked'))) {
      throw e;
    }
  }

  // Persist lineUserId for push notifications
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${sub}`, SK: 'PROFILE' },
      UpdateExpression: 'SET lineUserId = :id, updatedAt = :now',
      ExpressionAttributeValues: { ':id': lineUserId, ':now': new Date().toISOString() },
    })
  );

  return ok({ lineUserId });
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path   = event.requestContext.http.path;

  console.log({ method, path });

  if (method === 'OPTIONS') return { statusCode: 200, headers: { ...CORS }, body: '' };

  try {
    if (method === 'POST' && path === '/auth/refresh')    return await refresh(event);
    if (method === 'POST' && path === '/auth/link/line')  return await linkLine(event);

    return err('Not found', 404);
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    console.error({ errorName: error.name, errorMessage: error.message });

    if (error.name === 'NotAuthorizedException')  return err('Invalid or expired refresh token', 401);
    if (error.name === 'AliasExistsException')    return err('This LINE account is already linked to another user', 409);

    return err('Internal server error', 500);
  }
};
