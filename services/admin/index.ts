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
  UpdateCommand,
  ScanCommand,
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

function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try {
    return JSON.parse(event.body ?? '{}');
  } catch {
    return {};
  }
}

type JwtContext = { authorizer?: { jwt?: { claims?: { sub?: string; 'cognito:groups'?: string | string[] } } } };

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

// GET /admin/members
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

// GET /admin/members/:id
async function getMember(id: string): Promise<APIGatewayProxyResultV2> {
  const result = await dynamo.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: `MEMBER#${id}`, SK: 'PROFILE' },
    })
  );
  if (!result.Item) return err('Member not found', 404);
  return ok(result.Item);
}

// POST /admin/members
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

  return ok({ message: 'Member created. Temporary password sent to email.', sub }, 201);
}

// PUT /admin/members/:id
async function updateMember(id: string, event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> {
  const body = parseBody(event);
  const allowed = ['name', 'phone'] as const;
  const updates = allowed.filter((k) => body[k] !== undefined);
  if (updates.length === 0) return err('No updatable fields provided (name, phone)', 400);

  const setExpressions = updates.map((k) => `#${k} = :${k}`);
  setExpressions.push('#updatedAt = :updatedAt');

  const expressionNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
  const expressionValues: Record<string, unknown> = { ':updatedAt': new Date().toISOString() };
  updates.forEach((k) => {
    expressionNames[`#${k}`] = k;
    expressionValues[`:${k}`] = body[k];
  });

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

// DELETE /admin/members/:id
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

// PUT /admin/members/:id/suspend
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
    cognito.send(
      new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: profile.Item.email as string })
    ),
  ]);

  return ok({ message: 'Member suspended' });
}

// PUT /admin/members/:id/activate
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
    cognito.send(
      new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: profile.Item.email as string })
    ),
  ]);

  return ok({ message: 'Member activated' });
}

export const handler = async (event: APIGatewayProxyEventV2): Promise<APIGatewayProxyResultV2> => {
  const method = event.requestContext.http.method;
  const path = event.requestContext.http.path;

  console.log({ method, path });

  if (method === 'OPTIONS') return { statusCode: 200, headers: { ...CORS }, body: '' };

  if (!isAdmin(event)) return err('Forbidden', 403);

  try {
    // GET /admin/members
    if (method === 'GET' && path === '/admin/members') return await listMembers(event);

    // POST /admin/members
    if (method === 'POST' && path === '/admin/members') return await createMember(event);

    // /admin/members/:id[/action]
    const memberMatch = path.match(/^\/admin\/members\/([^/]+)(\/suspend|\/activate)?$/);
    if (memberMatch) {
      const id = memberMatch[1];
      const action = memberMatch[2];

      if (method === 'GET' && !action) return await getMember(id);
      if (method === 'PUT' && !action) return await updateMember(id, event);
      if (method === 'DELETE' && !action) return await deleteMember(id);
      if (method === 'PUT' && action === '/suspend') return await suspendMember(id);
      if (method === 'PUT' && action === '/activate') return await activateMember(id);
    }

    return err('Not found', 404);
  } catch (e: unknown) {
    const error = e as { name?: string; message?: string };
    console.error({ errorName: error.name, errorMessage: error.message });

    if (error.name === 'UsernameExistsException') return err('Email already registered', 409);
    if (error.name === 'ConditionalCheckFailedException') return err('Member not found', 404);

    return err('Internal server error', 500);
  }
};
