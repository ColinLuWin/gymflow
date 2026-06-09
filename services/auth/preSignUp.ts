import type { PreSignUpTriggerEvent } from 'aws-lambda';

const ADMIN_CLIENT_ID     = process.env.ADMIN_CLIENT_ID!;
const ADMIN_ALLOWED_EMAILS = (process.env.ADMIN_ALLOWED_EMAILS ?? '')
  .split(',')
  .map(e => e.trim())
  .filter(Boolean);

export const handler = async (event: PreSignUpTriggerEvent): Promise<PreSignUpTriggerEvent> => {
  // Enforce email allowlist only for the admin portal client
  if (event.callerContext.clientId === ADMIN_CLIENT_ID) {
    const email = event.request.userAttributes['email'] ?? '';
    if (!ADMIN_ALLOWED_EMAILS.includes(email)) {
      throw new Error(`Email ${email} is not authorised for admin access`);
    }
  }

  return event;
};
