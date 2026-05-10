import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { env } from "@/env";
import { requireApiAuth } from "@/server/auth";
import { createConvexSessionToken } from "@/server/convex-session";
import { syncGoogleGroupsForRole } from "@/server/google-groups";
import {
  findLogtoUserByEmail,
  isSupportedRole,
  syncOfficerRolesOnLogtoUser,
} from "@/server/logto";
import type { UserRole } from "@/types/roles";

type AppRole =
  | "Member"
  | "General Officer"
  | "Executive Officer"
  | "Member at Large"
  | "Past Officer"
  | "Sponsor"
  | "Administrator";

type OfficerTeam = "Internal" | "Events" | "Projects";
type Source = "manage-users" | "onboarding";

const VALID_TEAMS: OfficerTeam[] = ["Internal", "Events", "Projects"];

function getConvexClient() {
  const url = env.VITE_CONVEX_URL || process.env.CONVEX_URL || process.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
  }
  return new ConvexHttpClient(url);
}

async function handle({ request }: { request: Request }) {
  try {
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authResult = await requireApiAuth(request, {
      requiredRoles: ["Administrator", "Executive Officer"],
    });
    if (authResult instanceof Response) return authResult;

    const { body, logtoId, user } = authResult;
    const role = body.role as string | undefined;
    const source = (body.source as Source | undefined) || "manage-users";
    const email = body.email as string | undefined;
    const name = body.name as string | undefined;
    const userId = body.userId as string | undefined;
    const position = body.position as string | undefined;
    const rawTeam = body.team as string | undefined;
    const team = rawTeam && rawTeam.length > 0 ? rawTeam : undefined;

    if (!role || !isSupportedRole(role)) {
      return new Response(
        JSON.stringify({ error: "Invalid role" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (!userId && !email) {
      return new Response(
        JSON.stringify({ error: "Either userId or email is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (source !== "manage-users" && source !== "onboarding") {
      return new Response(
        JSON.stringify({ error: "Invalid source" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (team && !VALID_TEAMS.includes(team as OfficerTeam)) {
      return new Response(
        JSON.stringify({ error: "Invalid team" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const warnings: string[] = [];
    let convexUpdated = false;
    let logtoUpdated = false;
    let resolvedEmail = email;
    let resolvedLogtoUserId: string | null = null;

    const convex = getConvexClient();
    const { token } = createConvexSessionToken({
      sub: logtoId,
      role: user.role as UserRole | undefined,
    });
    const getByIdFn = "users:getByIdForAdmin" as unknown as FunctionReference<"query">;
    const getByEmailFn = "users:getByEmailForAdmin" as unknown as FunctionReference<"query">;
    const updateRoleFn = "users:updateRole" as unknown as FunctionReference<"mutation">;

    let targetUser: {
      _id: string;
      email: string;
      logtoId?: string;
    } | null = null;

    if (userId) {
      targetUser = (await convex.query(getByIdFn, {
        logtoId,
        authToken: token,
        userId,
      })) as typeof targetUser;

      if (!targetUser) {
        warnings.push(`No Convex user found for id '${userId}'`);
      }

      try {
        await convex.mutation(updateRoleFn, {
          logtoId,
          authToken: token,
          userId,
          role,
          position: position || undefined,
          team: team as OfficerTeam | undefined,
        });
        convexUpdated = true;
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : "Failed to update role in Convex",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
    } else if (resolvedEmail) {
      targetUser = (await convex.query(getByEmailFn, {
        logtoId,
        authToken: token,
        email: resolvedEmail,
      })) as { _id: string; email: string; logtoId?: string } | null;

      if (targetUser?._id) {
        await convex.mutation(updateRoleFn, {
          logtoId,
          authToken: token,
          userId: targetUser._id,
          role,
          position: position || undefined,
          team: team as OfficerTeam | undefined,
        });
        convexUpdated = true;
      } else if (source === "onboarding" && resolvedEmail) {
        const createPlaceholderFn = "users:createPlaceholder" as unknown as FunctionReference<"mutation">;
        const newUserId = await convex.mutation(createPlaceholderFn, {
          logtoId,
          authToken: token,
          email: resolvedEmail,
          name: name || resolvedEmail.split("@")[0],
          role,
          position: position || undefined,
          team: team as OfficerTeam | undefined,
        });
        targetUser = { _id: newUserId as string, email: resolvedEmail };
        convexUpdated = true;
      } else {
        warnings.push(`No Convex user found for email '${resolvedEmail}'`);
      }
    }

    if (targetUser) {
      resolvedEmail = resolvedEmail || targetUser.email;
      resolvedLogtoUserId = targetUser.logtoId || null;
    }

    if (resolvedLogtoUserId) {
      try {
        await syncOfficerRolesOnLogtoUser(resolvedLogtoUserId, role as AppRole);
        logtoUpdated = true;
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Failed to sync role to Logto: ${error.message}`
            : "Failed to sync role to Logto",
        );
      }
    } else if (resolvedEmail) {
      try {
        const logtoUser = await findLogtoUserByEmail(resolvedEmail);
        if (!logtoUser) {
          warnings.push(`No Logto user found for email '${resolvedEmail}'`);
        } else {
          await syncOfficerRolesOnLogtoUser(logtoUser.id, role as AppRole);
          logtoUpdated = true;
        }
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Failed to sync role to Logto: ${error.message}`
            : "Failed to sync role to Logto",
        );
      }
    }

    let googleGroupUpdated = false;
    if (resolvedEmail) {
      try {
        const googleResults = await syncGoogleGroupsForRole(resolvedEmail, role);
        googleGroupUpdated = googleResults.filter((r) => r.error).length === 0;

        for (const result of googleResults) {
          try {
            const createGgFn = "googleGroupAssignments:create" as unknown as FunctionReference<"mutation">;
            await convex.mutation(createGgFn, {
              email: resolvedEmail,
              googleGroup: result.group,
              role,
              success: !result.error,
              error: result.error,
            });
          } catch {
            // Non-fatal: audit log failure shouldn't block the update
          }
        }
      } catch (error) {
        warnings.push(
          error instanceof Error
            ? `Failed to sync Google Groups: ${error.message}`
            : "Failed to sync Google Groups",
        );
      }
    }

    if (!convexUpdated && source === "manage-users") {
      return new Response(
        JSON.stringify({
          error: "No matching Convex user found to update",
          warnings,
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        convexUpdated,
        logtoUpdated,
        googleGroupUpdated,
        warnings,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/api/users/update-role")({
  server: {
    handlers: {
      POST: handle,
    },
  },
});
