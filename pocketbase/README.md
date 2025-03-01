# PocketBase Schema

This directory contains the schema definition for the PocketBase database used in the IEEE UCSD website.

## Overview

The `schema.ts` file defines TypeScript interfaces that represent the collections in the PocketBase database. These interfaces can be imported and used throughout the codebase to ensure type safety when working with PocketBase data.

## Collections

The following collections are defined in the schema:

- **Users**: User accounts in the system
- **Events**: Events created in the system
- **Event Requests**: Requests to create new events
- **Logs**: System logs for user actions
- **Officers**: Officer roles in the organization
- **Reimbursements**: Reimbursement requests
- **Receipts**: Receipt records for reimbursements
- **Sponsors**: Sponsors of the organization

## Usage

To use these types in your code, import them from the schema file:

```typescript
import { User, Event, Collections } from "../pocketbase/schema";

// Example: Get a user from PocketBase
const getUser = async (userId: string): Promise<User> => {
  const pb = getPocketBase();
  return await pb.collection(Collections.USERS).getOne<User>(userId);
};
```

## Updating the Schema

When the PocketBase database schema changes, update the corresponding interfaces in `schema.ts` to reflect those changes. This ensures that the TypeScript types match the actual database structure.

## Collection Names

The `Collections` object provides constants for all collection names, which should be used when making API calls to PocketBase instead of hardcoding collection names as strings.

## Collection IDs

Each collection has its PocketBase collection ID documented in the schema file. These IDs are useful for reference and debugging purposes.
