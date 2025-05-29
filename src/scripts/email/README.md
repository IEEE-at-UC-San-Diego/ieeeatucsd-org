# Email Notification System

This directory contains the email notification system for the IEEE UCSD reimbursement portal and event management system using Resend.

## Setup

### Environment Variables

Add the following environment variables to your `.env` file:

```bash
# PocketBase Configuration
POCKETBASE_URL=https://pocketbase.ieeeucsd.org

# Resend API Configuration
RESEND_API_KEY=your_resend_api_key_here

# Email Configuration
FROM_EMAIL="IEEE UCSD <noreply@ieeeucsd.org>"
REPLY_TO_EMAIL="treasurer@ieeeucsd.org"
```

**Note**: This project uses Astro's standard environment variable pattern with `import.meta.env.VARIABLE_NAME`. No PUBLIC_ prefix is needed as these are used in API routes and server-side code.

### Getting a Resend API Key

1. Sign up for a [Resend account](https://resend.com)
2. Go to your dashboard and create a new API key
3. Add the API key to your environment variables

## Features

### Automatic Email Notifications

The system automatically sends emails for the following events:

#### Reimbursement System
1. **Reimbursement Submitted** - Confirmation email when a user submits a new reimbursement request
2. **Status Changes** - Notification when reimbursement status is updated (submitted, under review, approved, rejected, in progress, paid)
3. **Comments Added** - Notification when someone adds a public comment to a reimbursement
4. **Rejections with Reasons** - Detailed rejection notification including the specific reason for rejection

#### Event Management System
1. **Event Request Submitted** - Notification to coordinators@ieeeatucsd.org when a new event request is submitted

Note: Private comments are not sent via email to maintain privacy.

### Email Templates

All emails include:
- Professional IEEE UCSD branding
- Responsive design for mobile and desktop
- Clear status indicators with color coding
- Detailed information summary
- Next steps information
- Contact information for support

## Usage

### In React Components (Client-side)

#### Reimbursement Notifications
```typescript
import { EmailClient } from '../../../scripts/email/EmailClient';

// Send status change notification
await EmailClient.notifyStatusChange(reimbursementId, newStatus, previousStatus, userId);

// Send comment notification
await EmailClient.notifyComment(reimbursementId, comment, commentByUserId, isPrivate);

// Send submission confirmation
await EmailClient.notifySubmission(reimbursementId);

// Send rejection with reason (recommended for rejections)
await EmailClient.notifyRejection(reimbursementId, rejectionReason, previousStatus, userId);

// Send test email
await EmailClient.sendTestEmail('your-email@example.com');

// Alternative: Send rejection via notifyStatusChange with additionalContext
await EmailClient.notifyStatusChange(
  reimbursementId, 
  'rejected', 
  previousStatus, 
  userId,
  { rejectionReason: 'Missing receipt for coffee purchase. Please resubmit with proper documentation.' }
);
```

#### Event Request Notifications
```typescript
import { EmailClient } from '../../../scripts/email/EmailClient';

// Send event request submission notification to coordinators
await EmailClient.notifyEventRequestSubmission(eventRequestId);
```

### API Route (Server-side)

The API route at `/api/email/send-reimbursement-notification` accepts POST requests with the following structure:

#### Reimbursement Notifications
```json
{
  "type": "status_change" | "comment" | "submission" | "test",
  "reimbursementId": "string",
  "newStatus": "string", // for status_change
  "previousStatus": "string", // for status_change
  "changedByUserId": "string", // for status_change
  "comment": "string", // for comment
  "commentByUserId": "string", // for comment
  "isPrivate": boolean, // for comment
  "additionalContext": {}, // for additional data
  "authData": { // Authentication data for PocketBase access
    "token": "string",
    "model": {}
  }
}
```

#### Event Request Notifications
```json
{
  "type": "event_request_submission",
  "eventRequestId": "string",
  "authData": { // Authentication data for PocketBase access
    "token": "string",
    "model": {}
  }
}
```

## Architecture

The email system uses a client-server architecture for security and authentication:

- `EmailService.ts` - Core email service using Resend (server-side only)
- `ReimbursementEmailNotifications.ts` - High-level notification service (server-side only)
- `EmailClient.ts` - Client-side helper that calls the API with authentication
- `/api/email/send-reimbursement-notification.ts` - API route that handles server-side email sending with PocketBase authentication

### Authentication Flow

1. **Client-side**: `EmailClient` gets the current user's authentication token and model from the `Authentication` service
2. **API Request**: The auth data is sent to the server-side API route
3. **Server-side**: The API route authenticates with PocketBase using the provided auth data
4. **Database Access**: The authenticated PocketBase connection can access protected collections
5. **Email Sending**: Emails are sent using the Resend service with proper user data

This ensures that:
- API keys are never exposed to the client-side code
- Only authenticated users can trigger email notifications
- The server can access protected PocketBase collections
- Email operations respect user permissions and data security

## Email Recipients

- **Reimbursement notifications**: Sent to the user who submitted the reimbursement
- **Event request notifications**: Sent to coordinators@ieeeatucsd.org
- **Test emails**: Sent to the specified email address

## Error Handling

Email failures are logged but do not prevent the main operations from completing. This ensures that reimbursement processing and event request submissions continue even if email delivery fails.

## Security

- API keys are loaded from environment variables server-side only
- Authentication tokens are passed securely from client to server
- Email addresses are validated before sending
- Private comments are not sent via email (configurable)
- All emails include appropriate contact information
- PocketBase collection access respects authentication and permissions

## Event Request Email Notifications

### Event Request Submission
When a new event request is submitted, an email is automatically sent to the coordinators team.

```typescript
await EmailClient.notifyEventRequestSubmission(eventRequestId);
```

### Event Request Status Change
When an event request status is changed, an email is sent to coordinators.

```typescript
await EmailClient.notifyEventRequestStatusChange(eventRequestId, previousStatus, newStatus, changedByUserId);
```

### PR Completion Notification
When PR materials are completed for an event request, an email is sent to the submitter notifying them to contact the internal team.

```typescript
await EmailClient.notifyPRCompleted(eventRequestId);
```

This email includes:
- Confirmation that PR materials are completed
- Event details and information
- Instructions to contact the internal team for next steps
- Contact information for internal@ieeeucsd.org 