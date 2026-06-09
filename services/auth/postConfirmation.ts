import type { PostConfirmationTriggerEvent } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminAddUserToGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

const cognito = new CognitoIdentityProviderClient({});
const dynamo  = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const TABLE_NAME = process.env.TABLE_NAME!;

export const handler = async (event: PostConfirmationTriggerEvent): Promise<PostConfirmationTriggerEvent> => {
  // Only act on first-time sign-up confirmation (native or federated)
  if (event.triggerSource !== 'PostConfirmation_ConfirmSignUp') return event;

  const attrs   = event.request.userAttributes;
  const sub     = attrs['sub'];
  const email   = attrs['email'] ?? '';
  const rawName = attrs['name'] ?? '';
  const name    = rawName || email.split('@')[0] || sub.slice(0, 8);

  // Idempotent profile creation (safe if trigger fires twice)
  const existing = await dynamo.send(
    new GetCommand({ TableName: TABLE_NAME, Key: { PK: `MEMBER#${sub}`, SK: 'PROFILE' } })
  );

  if (!existing.Item) {
    const now = new Date().toISOString();
    try {
      await dynamo.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `MEMBER#${sub}`,
            SK: 'PROFILE',
            sub,
            ...(email ? { email } : {}),
            name,
            status: 'active',
            createdAt: now,
            updatedAt: now,
          },
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );
    } catch (e: unknown) {
      // Race condition — another trigger invocation created the profile first
      if ((e as { name?: string }).name !== 'ConditionalCheckFailedException') throw e;
    }

    // event.userPoolId avoids a CDK circular dependency that would arise
    // from passing USER_POOL_ID as an environment variable.
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: event.userPoolId,
        Username:   event.userName,
        GroupName:  'member',
      })
    );
  }

  return event;
};
