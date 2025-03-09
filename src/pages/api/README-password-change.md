# LogTo Password Change Implementation

This document explains how the password change functionality works with LogTo authentication.

## Overview

The password change functionality uses LogTo's Management API to update user passwords. The implementation follows the Machine-to-Machine (M2M) authentication flow as described in the LogTo documentation.

## Key Files

1. **`/src/pages/api/change-password.ts`**: The server-side API endpoint that handles password change requests
2. **`/src/components/dashboard/SettingsSection/PasswordChangeSettings.tsx`**: The React component that provides the password change UI
3. **`/src/components/dashboard/SettingsSection/AccountSecuritySettings.tsx`**: The parent component that includes the password change functionality

## How It Works

### Authentication Flow

1. The client sends a password change request with the user ID and new password
2. The server obtains an access token using the client credentials flow
3. The server uses the access token to make an authenticated request to the LogTo Management API
4. The LogTo API updates the user's password

### Implementation Details

#### 1. Client Credentials Flow

The implementation tries multiple approaches to obtain an access token using the OAuth 2.0 client credentials flow:

```javascript
// Attempt 1: Without resource parameter
let tokenResponse = await fetch(logtoTokenEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: logtoAppId,
    client_secret: logtoAppSecret,
    scope: "all",
  }).toString(),
});

// Attempt 2: With Basic Auth
tokenResponse = await fetch(logtoTokenEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${Buffer.from(`${logtoAppId}:${logtoAppSecret}`).toString("base64")}`,
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    scope: "all",
  }).toString(),
});

// Attempt 3: With organization_id
tokenResponse = await fetch(logtoTokenEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: logtoAppId,
    client_secret: logtoAppSecret,
    organization_id: "default",
    scope: "all",
  }).toString(),
});

// Attempt 4: With audience parameter
tokenResponse = await fetch(logtoTokenEndpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
  },
  body: new URLSearchParams({
    grant_type: "client_credentials",
    client_id: logtoAppId,
    client_secret: logtoAppSecret,
    audience: "https://auth.ieeeucsd.org/api",
    scope: "all",
  }).toString(),
});
```

Key points:

- The `grant_type` must be `client_credentials`
- Multiple approaches are tried to handle different LogTo configurations
- The `scope` parameter is set to `all` to request all available permissions

#### 2. Password Update API

After obtaining an access token, the implementation calls the LogTo Management API to update the password:

```javascript
const passwordEndpoint = `${logtoApiEndpoint}/api/users/${userId}/password`;

const changePasswordResponse = await fetch(passwordEndpoint, {
  method: "PATCH",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  },
  body: JSON.stringify({
    password: newPassword,
  }),
});
```

Key points:

- The endpoint is `/api/users/{userId}/password`
- The HTTP method is `PATCH`
- The request body contains only the `password` field
- The `Authorization` header must include the access token

## Troubleshooting

### Common Issues

1. **Authentication Errors (401)**

   - Check that the client ID and secret are correct
   - Verify that the M2M application has the necessary permissions

2. **Permission Errors (403)**

   - Ensure the M2M application has been assigned the appropriate role
   - Check that the role has the necessary permissions for user management

3. **Resource Parameter Issues**

   - The implementation tries multiple approaches to handle resource parameter issues
   - Different LogTo configurations may require different parameters (resource, audience, etc.)

4. **User ID Issues**
   - Ensure the user ID is correctly retrieved from the authentication system
   - The user ID should match the LogTo user ID, not the local user ID

## References

- [LogTo M2M Quick Start](https://docs.logto.io/quick-starts/m2m)
- [LogTo API Reference](https://openapi.logto.io/)
- [LogTo Update User Password API](https://openapi.logto.io/operation/operation-updateuserpassword)
- [LogTo Authentication](https://openapi.logto.io/authentication)
