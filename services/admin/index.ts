import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminAddUserToGroupCommand,
  DeliveryMediumType,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  TransactWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

const cognito = new CognitoIdentityProviderClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const USER_POOL_ID = process.env.USER_POOL_ID!;
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

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try { return JSON.parse(event.body ?? '{}'); } catch { return {}; }
}

type JwtClaims = {
  sub?: string;
  email?: string;
  name?: string;
  'cognito:groups'?: string | string[];
  'cognito:username'?: string;
};
type JwtContext = { authorizer?: { jwt?: { claims?: JwtClaims } } };

function getClaims(event: APIGatewayProxyEventV2) {
  return (event.requestContext as unknown as JwtContext)?.authorizer?.jwt?.claims;
}

function parseGroups(groups: string | string[]): string[] {
  if (Array.isArray(groups)) return groups;
  // API Gateway HTTP API passes Cognito groups as "[group1 group2]"
  return groups.replace(/^\[|\]$/g, '').split(' ').filter(Boolean);
}

function isAdmin(event: APIGatewayProxyEventV2): boolean {
  const groups = getClaims(event)?.['cognito:groups'];
  if (!groups) return false;
  return parseGroups(groups).includes('admin');
}

function isAdminOrTrainer(event: APIGatewayProxyEventV2): boolean {
  const groups = getClaims(event)?.['cognito:groups'];
  if (!groups) return false;
  const g = parseGroups(groups);
  return g.includes('admin') || g.includes('trainer');
}

// ─── Member management ────────────────────────────────────────────────────────

async function listMembers(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const limit = Math.min(Number(event.queryStringParameters?.limit ?? 20), 100);
  const lastKey = event.queryStringParameters?.cursor
    ? JSON.parse(Buffer.from(event.queryStringParameters.cursor, 'base64').toString())
    : undefined;

  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'SK = :profile',
      ExpressionAttributeValues: { ':profile': 'PROFILE' },
      Limit: limit,
      ExclusiveStartKey: lastKey,
    })
  );

  const cursor = result.LastEvaluatedKey
    ? Buffer.from(JSON.stringify(result.LastEvaluatedKey)).toString('base64')
    : null;

  return ok({ members: result.Items ?? [], cursor });
}

async function getMember(id: string): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' } })
  );
  if (!result.Item) return err('Member not found', 404);
  return ok(result.Item);
}

async function createMember(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const { email, name, phone } = parseBody(event) as { email?: string; name?: string; phone?: string };
  if (!email || !name) return err('email and name are required', 400);

  const cognitoUser = await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
      UserAttributes: [
        { Name: 'email', Value: email },
        { Name: 'name', Value: name },
        { Name: 'email_verified', Value: 'true' },
        ...(phone ? [{ Name: 'phone_number', Value: phone }] : []),
      ],
      DesiredDeliveryMediums: [DeliveryMediumType.EMAIL],
    })
  );

  const sub = cognitoUser.User?.Attributes?.find((a) => a.Name === 'sub')?.Value;
  if (!sub) return err('Failed to create user', 500);

  await cognito.send(
    new AdminAddUserToGroupCommand({ UserPoolId: USER_POOL_ID, Username: email, GroupName: 'member' })
  );

  const now = new Date().toISOString();
  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `MEMBER#${sub}`, SK: 'PROFILE', sub, email, name, ...(phone ? { phone } : {}), status: 'active', createdAt: now, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

  return ok({ message: 'Member created. Temporary password sent to email.', sub }, 201);
}

async function updateMember(id: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event);
  const allowed = ['name', 'phone'] as const;
  const updates = allowed.filter((k) => body[k] !== undefined);
  if (updates.length === 0) return err('No updatable fields provided (name, phone)', 400);

  const setExpressions = updates.map((k) => `#${k} = :${k}`);
  setExpressions.push('#updatedAt = :updatedAt');

  const expressionNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const expressionValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  updates.forEach((k) => { expressionNames[`#${k}`] = k; expressionValues[`:${k}`] = body[k]; });

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return ok(result.Attributes);
}

async function deleteMember(id: string): Promise<APIGatewayProxyResultV2> {
  const profile = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' } })
  );
  if (!profile.Item) return err('Member not found', 404);

  await Promise.all([
    dynamo.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' } })),
    cognito.send(new AdminDeleteUserCommand({ UserPoolId: USER_POOL_ID, Username: profile.Item.email as string })),
  ]);

  return ok({ message: 'Member deleted' });
}

async function suspendMember(id: string): Promise<APIGatewayProxyResultV2> {
  const profile = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' } })
  );
  if (!profile.Item) return err('Member not found', 404);

  await Promise.all([
    dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: { ':status': 'suspended', ':updatedAt': new Date().toISOString() },
      })
    ),
    cognito.send(new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: profile.Item.email as string })),
  ]);

  return ok({ message: 'Member suspended' });
}

async function activateMember(id: string): Promise<APIGatewayProxyResultV2> {
  const profile = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' } })
  );
  if (!profile.Item) return err('Member not found', 404);

  await Promise.all([
    dynamo.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' },
        UpdateExpression: 'SET #status = :status, #updatedAt = :updatedAt',
        ExpressionAttributeNames: { '#status': 'status', '#updatedAt': 'updatedAt' },
        ExpressionAttributeValues: { ':status': 'active', ':updatedAt': new Date().toISOString() },
      })
    ),
    cognito.send(new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: profile.Item.email as string })),
  ]);

  return ok({ message: 'Member activated' });
}

// ─── Points ───────────────────────────────────────────────────────────────────

async function awardPoints(id: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event) as { points?: unknown; note?: string };
  const points = Number(body.points);
  if (!Number.isInteger(points) || points <= 0) return err('points must be a positive integer', 400);

  const awardedBy = getClaims(event)?.sub ?? 'unknown';

  const profile = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' } })
  );
  if (!profile.Item) return err('Member not found', 404);

  const now = new Date().toISOString();

  await dynamo.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME,
            Key: { PK: `MEMBER#${id}`, SK: 'POINTS_BALANCE' },
            UpdateExpression: 'SET balance = if_not_exists(balance, :zero) + :points, updatedAt = :now',
            ExpressionAttributeValues: { ':points': points, ':zero': 0, ':now': now },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              PK: `MEMBER#${id}`,
              SK: `POINTS_TXN#${now}`,
              type: 'award',
              delta: points,
              note: body.note ?? null,
              awardedBy,
              createdAt: now,
            },
          },
        },
      ],
    })
  );

  return ok({ message: 'Points awarded', memberId: id, points });
}

async function getMemberPoints(id: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const limit = Math.min(Number(event.queryStringParameters?.limit ?? 50), 200);

  const [balanceResult, txnResult] = await Promise.all([
    dynamo.send(new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${id}`, SK: 'POINTS_BALANCE' } })),
    dynamo.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: { ':pk': `MEMBER#${id}`, ':prefix': 'POINTS_TXN#' },
        ScanIndexForward: false,
        Limit: limit,
      })
    ),
  ]);

  return ok({ balance: balanceResult.Item?.balance ?? 0, transactions: txnResult.Items ?? [] });
}

// ─── Rewards ──────────────────────────────────────────────────────────────────

async function listRewards(): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :meta',
      ExpressionAttributeValues: { ':prefix': 'REWARD#', ':meta': 'META' },
    })
  );
  return ok({ rewards: result.Items ?? [] });
}

async function createReward(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event) as { name?: string; description?: string; pointsCost?: unknown; stock?: unknown };
  if (!body.name) return err('name is required', 400);

  const pointsCost = Number(body.pointsCost);
  if (!Number.isInteger(pointsCost) || pointsCost <= 0) return err('pointsCost must be a positive integer', 400);

  // stock: -1 = unlimited, 0+ = limited quantity
  const stock = body.stock !== undefined ? Number(body.stock) : -1;
  if (!Number.isInteger(stock) || stock < -1) return err('stock must be -1 (unlimited) or a non-negative integer', 400);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await dynamo.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: { PK: `REWARD#${id}`, SK: 'META', id, name: body.name, description: body.description ?? null, pointsCost, stock, isActive: true, createdAt: now, updatedAt: now },
      ConditionExpression: 'attribute_not_exists(PK)',
    })
  );

  return ok({ id, message: 'Reward created' }, 201);
}

async function updateReward(id: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event);
  const allowed = ['name', 'description', 'pointsCost', 'stock', 'isActive'] as const;
  const updates = allowed.filter((k) => body[k] !== undefined);
  if (updates.length === 0) return err('No updatable fields provided', 400);

  const setExpressions = updates.map((k) => `#${k} = :${k}`);
  setExpressions.push('#updatedAt = :updatedAt');

  const expressionNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const expressionValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  updates.forEach((k) => { expressionNames[`#${k}`] = k; expressionValues[`:${k}`] = body[k]; });

  const result = await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `REWARD#${id}`, SK: 'META' },
      UpdateExpression: `SET ${setExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionNames,
      ExpressionAttributeValues: expressionValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW',
    })
  );

  return ok(result.Attributes);
}

async function deleteReward(id: string): Promise<APIGatewayProxyResultV2> {
  await dynamo.send(
    new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: `REWARD#${id}`, SK: 'META' },
      ConditionExpression: 'attribute_exists(PK)',
    })
  );
  return ok({ message: 'Reward deleted' });
}

// ─── Redemptions ──────────────────────────────────────────────────────────────

async function listAllRedemptions(): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(SK, :prefix)',
      ExpressionAttributeValues: { ':prefix': 'REDEMPTION#' },
    })
  );
  const items = (result.Items ?? []).sort((a, b) =>
    String(b.redeemedAt).localeCompare(String(a.redeemedAt))
  );
  return ok({ redemptions: items });
}

async function getRedemption(memberId: string, redemptionId: string): Promise<APIGatewayProxyResultV2> {
  const sk = `REDEMPTION#${redemptionId}`;
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${memberId}`, SK: sk } })
  );
  if (!result.Item) return err('Redemption not found', 404);
  return ok(result.Item);
}

async function useRedemption(memberId: string, redemptionId: string): Promise<APIGatewayProxyResultV2> {
  const sk = `REDEMPTION#${redemptionId}`;
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${memberId}`, SK: sk } })
  );
  if (!result.Item) return err('Redemption not found', 404);
  if (result.Item.status !== 'active') return err('Redemption is not active', 400);

  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${memberId}`, SK: sk },
      UpdateExpression: 'SET #status = :used, usedAt = :now, updatedAt = :now',
      ConditionExpression: '#status = :active',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':used': 'used', ':active': 'active', ':now': now },
    })
  );
  return ok({ message: 'Redemption marked as used' });
}

async function cancelRedemption(memberId: string, redemptionId: string): Promise<APIGatewayProxyResultV2> {
  // redemptionId = "<epochMs>-<uuid>", SK = "REDEMPTION#<epochMs>-<uuid>"
  const sk = `REDEMPTION#${redemptionId}`;
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${memberId}`, SK: sk } })
  );
  if (!result.Item) return err('Redemption not found', 404);
  if (result.Item.status === 'cancelled') return err('Already cancelled', 400);

  const now = new Date().toISOString();

  await dynamo.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Update: {
            TableName: TABLE_NAME,
            Key: { PK: `MEMBER#${memberId}`, SK: sk },
            UpdateExpression: 'SET #status = :cancelled, updatedAt = :now',
            ConditionExpression: '#status = :active',
            ExpressionAttributeNames: { '#status': 'status' },
            ExpressionAttributeValues: { ':cancelled': 'cancelled', ':active': 'active', ':now': now },
          },
        },
        {
          Update: {
            TableName: TABLE_NAME,
            Key: { PK: `MEMBER#${memberId}`, SK: 'POINTS_BALANCE' },
            UpdateExpression: 'SET balance = balance + :points, updatedAt = :now',
            ExpressionAttributeValues: { ':points': result.Item.pointsCost as number, ':now': now },
          },
        },
        {
          Put: {
            TableName: TABLE_NAME,
            Item: {
              PK: `MEMBER#${memberId}`,
              SK: `POINTS_TXN#${now}`,
              type: 'refund',
              delta: result.Item.pointsCost as number,
              note: `撤銷兌換: ${result.Item.rewardName as string}`,
              createdAt: now,
            },
          },
        },
      ],
    })
  );

  return ok({ message: 'Redemption cancelled, points restored' });
}

// ─── Approval management ─────────────────────────────────────────────────────

async function requestAccess(event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const claims = getClaims(event);
  if (!claims?.sub) return err('Unauthorized', 401);

  const sub             = claims.sub as string;
  const email           = (claims['email'] ?? '') as string;
  const name            = (claims['name'] ?? email.split('@')[0] ?? sub.slice(0, 8)) as string;
  const cognitoUsername = (claims['cognito:username'] ?? sub) as string;

  const groups = claims['cognito:groups'];
  if (groups) {
    const g = parseGroups(groups as string | string[]);
    if (g.includes('admin') || g.includes('trainer')) return err('Already approved', 409);
  }

  const existing = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `PENDING_ADMIN#${sub}`, SK: 'META' } })
  );
  if (existing.Item) {
    return ok({ status: existing.Item.status, requestedAt: existing.Item.requestedAt });
  }

  const now = new Date().toISOString();
  try {
    await dynamo.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: { PK: `PENDING_ADMIN#${sub}`, SK: 'META', sub, email, name, cognitoUsername, requestedAt: now, status: 'pending' },
        ConditionExpression: 'attribute_not_exists(PK)',
      })
    );
  } catch (e: unknown) {
    if ((e as { name?: string }).name === 'ConditionalCheckFailedException') {
      const recheck = await dynamo.send(
        new GetCommand({ TableName: TABLE_NAME, Key: { PK: `PENDING_ADMIN#${sub}`, SK: 'META' } })
      );
      return ok({ status: recheck.Item?.status ?? 'pending', requestedAt: recheck.Item?.requestedAt ?? now });
    }
    throw e;
  }
  return ok({ status: 'pending', requestedAt: now }, 201);
}

async function listPendingApprovals(): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: 'begins_with(PK, :prefix) AND SK = :meta',
      ExpressionAttributeValues: { ':prefix': 'PENDING_ADMIN#', ':meta': 'META' },
    })
  );
  const items = (result.Items ?? []).sort((a, b) =>
    String(b.requestedAt).localeCompare(String(a.requestedAt))
  );
  return ok({ approvals: items });
}

async function approvePending(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `PENDING_ADMIN#${sub}`, SK: 'META' } })
  );
  if (!result.Item) return err('Approval request not found', 404);
  if (result.Item.status !== 'pending') return err('Request is not pending', 400);

  await cognito.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: result.Item.cognitoUsername as string,
      GroupName: 'trainer',
    })
  );

  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `PENDING_ADMIN#${sub}`, SK: 'META' },
      UpdateExpression: 'SET #status = :s, reviewedAt = :now, reviewedBy = :by',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':s': 'approved', ':now': now, ':by': getClaims(event)?.sub ?? 'unknown' },
    })
  );
  return ok({ message: 'Approved and added to trainer group' });
}

async function rejectPending(sub: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `PENDING_ADMIN#${sub}`, SK: 'META' } })
  );
  if (!result.Item) return err('Approval request not found', 404);

  const now = new Date().toISOString();
  await dynamo.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: { PK: `PENDING_ADMIN#${sub}`, SK: 'META' },
      UpdateExpression: 'SET #status = :s, reviewedAt = :now, reviewedBy = :by',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: { ':s': 'rejected', ':now': now, ':by': getClaims(event)?.sub ?? 'unknown' },
    })
  );
  return ok({ message: 'Rejected' });
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log({ method, path });

  if (method === 'OPTIONS') return { statusCode: 200, headers: { ...CORS }, body: '' };

  // POST /admin/request-access — any valid JWT (no group required)
  if (method === 'POST' && path === '/admin/request-access') {
    return await requestAccess(event);
  }

  if (!isAdminOrTrainer(event)) return err('Forbidden', 403);
  const callerIsAdmin = isAdmin(event);

  try {
    // GET /admin/members
    if (method === 'GET' && path === '/admin/members') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      return await listMembers(event);
    }

    // POST /admin/members
    if (method === 'POST' && path === '/admin/members') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      return await createMember(event);
    }

    // /admin/rewards
    if (path === '/admin/rewards') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      if (method === 'GET') return await listRewards();
      if (method === 'POST') return await createReward(event);
    }

    // GET /admin/redemptions
    if (method === 'GET' && path === '/admin/redemptions') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      return await listAllRedemptions();
    }

    // PUT/DELETE /admin/rewards/:id
    const rewardMatch = path.match(/^\/admin\/rewards\/([^/]+)$/);
    if (rewardMatch) {
      if (!callerIsAdmin) return err('Forbidden', 403);
      const rewardId = rewardMatch[1];
      if (method === 'PUT') return await updateReward(rewardId, event);
      if (method === 'DELETE') return await deleteReward(rewardId);
    }

    // GET /admin/members/:id/redemptions/:redemptionId
    const redemptionGetMatch = path.match(/^\/admin\/members\/([^/]+)\/redemptions\/([^/]+)$/);
    if (redemptionGetMatch) {
      if (!callerIsAdmin) return err('Forbidden', 403);
      const [, memberId, redemptionId] = redemptionGetMatch;
      if (method === 'GET') return await getRedemption(memberId, redemptionId);
    }

    // POST /admin/members/:id/redemptions/:redemptionId/use
    const useMatch = path.match(/^\/admin\/members\/([^/]+)\/redemptions\/([^/]+)\/use$/);
    if (useMatch) {
      if (!callerIsAdmin) return err('Forbidden', 403);
      const [, memberId, redemptionId] = useMatch;
      if (method === 'POST') return await useRedemption(memberId, redemptionId);
    }

    // POST /admin/members/:id/redemptions/:redemptionId/cancel
    const cancelMatch = path.match(/^\/admin\/members\/([^/]+)\/redemptions\/([^/]+)\/cancel$/);
    if (cancelMatch) {
      if (!callerIsAdmin) return err('Forbidden', 403);
      const [, memberId, redemptionId] = cancelMatch;
      if (method === 'POST') return await cancelRedemption(memberId, redemptionId);
    }

    // /admin/members/:id[/action]
    const memberMatch = path.match(/^\/admin\/members\/([^/]+)(\/suspend|\/activate|\/points)?$/);
    if (memberMatch) {
      const id = memberMatch[1];
      const action = memberMatch[2];

      if (!action) {
        if (!callerIsAdmin) return err('Forbidden', 403);
        if (method === 'GET') return await getMember(id);
        if (method === 'PUT') return await updateMember(id, event);
        if (method === 'DELETE') return await deleteMember(id);
      }
      if (action === '/suspend' && method === 'PUT') {
        if (!callerIsAdmin) return err('Forbidden', 403);
        return await suspendMember(id);
      }
      if (action === '/activate' && method === 'PUT') {
        if (!callerIsAdmin) return err('Forbidden', 403);
        return await activateMember(id);
      }
      // Trainer + admin: award (POST) and view (GET) points
      if (action === '/points') {
        if (method === 'POST') return await awardPoints(id, event);
        if (method === 'GET') return await getMemberPoints(id, event);
      }
    }

    // GET /admin/approvals
    if (method === 'GET' && path === '/admin/approvals') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      return await listPendingApprovals();
    }

    // POST /admin/approvals/:sub/approve
    const approveMatch = path.match(/^\/admin\/approvals\/([^/]+)\/approve$/);
    if (approveMatch && method === 'POST') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      return await approvePending(approveMatch[1], event);
    }

    // POST /admin/approvals/:sub/reject
    const rejectMatch = path.match(/^\/admin\/approvals\/([^/]+)\/reject$/);
    if (rejectMatch && method === 'POST') {
      if (!callerIsAdmin) return err('Forbidden', 403);
      return await rejectPending(rejectMatch[1], event);
    }

    return err('Not found', 404);
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    console.error({ errorName: error.name, errorMessage: error.message });

    if (error.name === 'UsernameExistsException') return err('Email already registered', 409);
    if (error.name === 'ConditionalCheckFailedException') return err('Resource not found', 404);
    if (error.name === 'TransactionCanceledException') return err('Transaction failed: insufficient points or reward unavailable', 400);

    return err('Internal server error', 500);
  }
};
