import type { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { getGoogleGroupForRole, syncGoogleGroupsForRole } from "@/server/google-groups";

export type GoogleGroupSyncResult = {
  googleGroupUpdated: boolean;
  googleGroup: string | null;
  warnings: string[];
};

type GoogleGroupAuditResult = {
  group: string;
  added?: boolean;
  removed?: boolean;
  error?: string;
};

export async function syncGoogleGroupsForRoleWithAudit(
  convex: ConvexHttpClient,
  email: string,
  role: string,
): Promise<GoogleGroupSyncResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const googleGroup = getGoogleGroupForRole(role);
  const warnings: string[] = [];

  if (!normalizedEmail) {
    return {
      googleGroupUpdated: false,
      googleGroup,
      warnings: ["Failed to sync Google Groups: email is required"],
    };
  }

  try {
    const googleResults = await syncGoogleGroupsForRole(normalizedEmail, role);
    const createGgFn =
      "googleGroupAssignments:create" as unknown as FunctionReference<"mutation">;

    await Promise.all(
      googleResults.map(async (result: GoogleGroupAuditResult) => {
        try {
          await convex.mutation(createGgFn, {
            email: normalizedEmail,
            googleGroup: result.group,
            role,
            success: !result.error,
            error: result.error,
          });
        } catch {
          // Non-fatal: audit log failure should not block role updates.
        }
      }),
    );

    const errors = googleResults.filter((result) => result.error);
    if (errors.length > 0) {
      warnings.push(
        `Failed to sync Google Groups: ${errors
          .map((result) => `${result.group}: ${result.error}`)
          .join(" | ")}`,
      );
    }

    return {
      googleGroupUpdated: errors.length === 0,
      googleGroup,
      warnings,
    };
  } catch (error) {
    return {
      googleGroupUpdated: false,
      googleGroup,
      warnings: [
        error instanceof Error
          ? `Failed to sync Google Groups: ${error.message}`
          : "Failed to sync Google Groups",
      ],
    };
  }
}
