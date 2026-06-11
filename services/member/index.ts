import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE_NAME = process.env.TABLE_NAME!;

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

function getSub(event: APIGatewayProxyEventV2): string | null {
  return (event.requestContext as unknown as {
    authorizer?: { jwt?: { claims?: { sub?: string } } };
  })?.authorizer?.jwt?.claims?.sub ?? null;
}

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try { return JSON.parse(event.body ?? '{}'); } catch { return {}; }
}

// ─── Profile ──────────────────────────────────────────────────────────────────

async function getProfile(sub: string): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${sub}`, SK: 'PROFILE' } })
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
  updates.forEach((k) => { expressionNames[`#${k}`] = k; expressionValues[`:${k}`] = body[k]; });
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

async function unlinkLine(sub: string): Promise<APIGatewayProxyResultV2> {
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${sub}`, SK: 'PROFILE' },
      UpdateExpression: 'REMOVE lineUserId SET updatedAt = :now',
      ExpressionAttributeValues: { ':now': new Date().toISOString() },
      ConditionExpression: 'attribute_exists(PK)',
    })
  );
  return ok({ message: 'LINE unlinked' });
}

async function getMembership(sub: string): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `MEMBER#${sub}`, ':prefix': 'MEMBERSHIP#' },
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
      ExpressionAttributeValues: { ':pk': `MEMBER#${sub}`, ':prefix': 'CHECKIN#' },
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

// ─── QR Code ──────────────────────────────────────────────────────────────────

async function getQr(sub: string): Promise<APIGatewayProxyResultV2> {
  // Return the memberId; the frontend generates the QR image from it
  return ok({ memberId: sub });
}

// ─── Points ───────────────────────────────────────────────────────────────────

async function getMemberPoints(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const limit = Math.min(Number(event.queryStringParameters?.limit ?? 50), 200);

  const [balanceResult, txnResult] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${sub}`, SK: 'POINTS_BALANCE' } })),
    dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `MEMBER#${sub}`, ':prefix': 'POINTS_TXN#' },
        ScanIndexForward: false,
        Limit: limit,
      })
    ),
  ]);

  return ok({ balance: balanceResult.Item?.balance ?? 0, transactions: txnResult.Items ?? [] });
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

async function listRewards(): Promise<APIGatewayProxyResultV2> {
  // Members only see active rewards
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :meta AND isActive = :active',
      ExpressionAttributeValues: { ':prefix': 'REWARD#', ':meta': 'META', ':active': true },
    })
  );
  return ok({ rewards: result.Items ?? [] });
}

// ─── Redemptions ──────────────────────────────────────────────────────────────

async function redeemReward(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { rewardId } = parseBody(event) as { rewardId?: string };
  if (!rewardId) return err('rewardId is required', 400);

  const rewardResult = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `REWARD#${rewardId}`, SK: 'META' } })
  );
  const reward = rewardResult.Item;
  if (!reward) return err('Reward not found', 404);
  if (!reward.isActive) return err('Reward is not available', 400);
  if (reward.stock === 0) return err('Reward is out of stock', 400);

  const now = new Date().toISOString();
  // SK uses epochMs-uuid for URL-safe IDs and chronological ordering
  const redemptionId = `${Date.now()}-${crypto.randomUUID()}`;
  const redemptionSK = `REDEMPTION#${redemptionId}`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transactItems: any[] = [
    {
      Update: {
        TableName: TABLE_NAME,
        Key: { PK: `MEMBER#${sub}`, SK: 'POINTS_BALANCE' },
        UpdateExpression: 'SET balance = balance - :cost, updatedAt = :now',
        ConditionExpression: 'balance >= :cost',
        ExpressionAttributeValues: { ':cost': reward.pointsCost as number, ':now': now },
      },
    },
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `MEMBER#${sub}`,
          SK: redemptionSK,
          redemptionId,
          rewardId,
          rewardName: reward.name as string,
          pointsCost: reward.pointsCost as number,
          status: 'active',
          redeemedAt: now,
        },
        ConditionExpression: 'attribute_not_exists(SK)',
      },
    },
    {
      Put: {
        TableName: TABLE_NAME,
        Item: {
          PK: `MEMBER#${sub}`,
          SK: `POINTS_TXN#${now}`,
          type: 'redeem',
          delta: -(reward.pointsCost as number),
          note: `兌換: ${reward.name as string}`,
          createdAt: now,
        },
      },
    },
  ];

  // If stock is limited, atomically decrement it
  if ((reward.stock as number) !== -1) {
    transactItems.push({
      Update: {
        TableName: TABLE_NAME,
        Key: { PK: `REWARD#${rewardId}`, SK: 'META' },
        UpdateExpression: 'SET stock = stock - :one, updatedAt = :now',
        ConditionExpression: 'stock > :zero',
        ExpressionAttributeValues: { ':one': 1, ':zero': 0, ':now': now },
      },
    });
  }

  try {
    await dynamo.send(new TransactWriteCommand({ TransactItems: transactItems }));
  } catch (e: unknown) {
    const error = e as { name?: string };
    if (error.name === 'TransactionCanceledException') {
      return err('Insufficient points or reward no longer available', 400);
    }
    throw e;
  }

  return ok({ message: 'Redeemed successfully', redemptionId }, 201);
}

async function getMemberRedemptions(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const limit = Math.min(Number(event.queryStringParameters?.limit ?? 20), 100);

  const result = await dynamo.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      // SK: REDEMPTION#<epochMs>-<uuid>, descending = newest first
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':pk': `MEMBER#${sub}`, ':prefix': 'REDEMPTION#' },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return ok({ redemptions: result.Items ?? [] });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

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
    if (method === 'DELETE' && path === '/members/me/line') return await unlinkLine(sub);
    if (method === 'GET' && path === '/members/me/membership') return await getMembership(sub);
    if (method === 'GET' && path === '/members/me/checkins') return await getCheckins(sub, event);
    if (method === 'GET' && path === '/members/me/qr') return await getQr(sub);
    if (method === 'GET' && path === '/members/me/points') return await getMemberPoints(sub, event);
    if (method === 'GET' && path === '/members/rewards') return await listRewards();
    if (method === 'POST' && path === '/members/me/redemptions') return await redeemReward(sub, event);
    if (method === 'GET' && path === '/members/me/redemptions') return await getMemberRedemptions(sub, event);

    return err('Not found', 404);
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    console.error({ errorName: error.name, errorMessage: error.message });

    if (error.name === 'ConditionalCheckFailedException') return err('Member not found', 404);

    return err('Internal server error', 500);
  }
};
