import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  UpdateCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
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

function getSub(event: APIGatewayProxyEventV2): string | null {
  return (event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: { sub?: string } } };
  })?.authorizer?.jwt?.claims?.sub ?? null;
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try {
    return JSON.parse(event.body ?? '{}');
  } catch {
    return {};
  }
}

async function getProfile(sub: string): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${sub}`, SK: 'PROFILE' },
    })
  );

  if (!result.Item) return err('Member not found', 404);
  return ok(result.Item);
}

async function updateProfile(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event);
  const allowed = ['name', 'phone'] as const;
  const updates = allowed.filter((k) => body[k] !== undefined);

  if (updates.length === 0) return err('No updatable fields provided (name, phone)', 400);

  const setExpressions = updates.map((k) => `#${k} = :${k}`);
  setExpressions.push('#updatedAt = :updatedAt');

  const expressionNames: Record<string, string> = {};
  const expressionValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };

  updates.forEach((k) => {
    expressionNames[`#${k}`] = k;
    expressionValues[`:${k}`] = body[k];
  });
  expressionNames['#updatedAt'] = 'updatedAt';

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${sub}`, SK: 'PROFILE' },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return ok(result.Attributes);
}

async function getMembership(sub: string): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `MEMBER#${sub}`,
        ':prefix': 'MEMBERSHIP#',
      },
    })
  );

  return ok({ memberships: result.Items ?? [] });
}

async function getCheckins(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const limit = Math.min(Number(event.queryStringParameters?.limit ?? 20), 100);
  const lastKey = event.queryStringParameters?.cursor
    ? JSON.parse(Buffer.from(event.queryStringParameters.cursor, 'base64').toString())
    : undefined;

  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `MEMBER#${sub}`,
        ':prefix': 'CHECKIN#',
      },
      ScanIndexForward: false,
      Limit: limit,
      ExclusiveStartKey: lastKey,
    })
  );

  const cursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;

  return ok({ checkins: result.Items ?? [], cursor });
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log({ method, path });

  if (method === 'OPTIONS') return { statusCode: 200, headers: { ...CORS }, body: '' };

  const sub = getSub(event);
  if (!sub) return err('Unauthorized', 401);

  try {
    if (method === 'GET' && path === '/members/me') return await getProfile(sub);
    if (method === 'PUT' && path === '/members/me') return await updateProfile(sub, event);
    if (method === 'GET' && path === '/members/me/membership') return await getMembership(sub);
    if (method === 'GET' && path === '/members/me/checkins') return await getCheckins(sub, event);

    return err('Not found', 404);
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    console.error({ errorName: error.name, errorMessage: error.message });

    if (error.name === 'ConditionalCheckFailedException') return err('Member not found', 404);

    return err('Internal server error', 500);
  }
};
