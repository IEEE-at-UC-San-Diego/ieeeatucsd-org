import type { Id } from "./_generated/dataModel";

export interface AuthUpsertResult {
  userId: Id<"users">;
  signedUp: boolean;
  role: string;
}

export function buildAuthUpsertResult(
  userId: Id<"users">,
  signedUp: boolean,
  role: string,
): AuthUpsertResult {
  return {
    userId,
    signedUp,
    role,
  };
}
