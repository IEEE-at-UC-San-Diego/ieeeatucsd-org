import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { env } from "@/env";
import { createConvexSessionToken } from "@/server/convex-session";
import { syncGoogleGroupsForRoleWithAudit } from "@/server/google-group-sync";
import {
	findLogtoUserByEmail,
	isSupportedRole,
	syncOfficerRolesOnLogtoUser,
} from "@/server/logto";
import type { OfficerTeam, UserRole } from "@/types/roles";

type Source = "manage-users" | "onboarding";

type TargetUser = {
	_id: string;
	email: string;
	logtoId?: string;
};

export type UserRoleSyncInput = {
	actorLogtoId: string;
	actorRole?: UserRole;
	userId?: string;
	email?: string;
	name?: string;
	role?: string;
	position?: string;
	team?: string;
	source?: Source;
};

export type UserRoleSyncResult = {
	convexUpdated: boolean;
	logtoUpdated: boolean;
	googleGroupUpdated: boolean;
	googleGroup: string | null;
	warnings: string[];
};

export class UserRoleSyncInputError extends Error {
	status: number;

	constructor(message: string, status = 400) {
		super(message);
		this.name = "UserRoleSyncInputError";
		this.status = status;
	}
}

const VALID_TEAMS: OfficerTeam[] = ["Internal", "Events", "Projects"];

function getConvexClient() {
	const url =
		env.VITE_CONVEX_URL ||
		process.env.CONVEX_URL ||
		process.env.VITE_CONVEX_URL;
	if (!url) {
		throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
	}
	return new ConvexHttpClient(url);
}

function normalizeOptionalText(value: string | undefined) {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function normalizeTeam(team: string | undefined) {
	const normalizedTeam = normalizeOptionalText(team);
	if (!normalizedTeam) return undefined;
	if (!VALID_TEAMS.includes(normalizedTeam as OfficerTeam)) {
		throw new UserRoleSyncInputError("Invalid team");
	}
	return normalizedTeam as OfficerTeam;
}

function normalizeSource(source: Source | undefined) {
	if (!source) return "manage-users";
	if (source !== "manage-users" && source !== "onboarding") {
		throw new UserRoleSyncInputError("Invalid source");
	}
	return source;
}

export async function syncUserRole(input: UserRoleSyncInput) {
	const role = input.role;
	const source = normalizeSource(input.source);
	const email = normalizeOptionalText(input.email)?.toLowerCase();
	const userId = normalizeOptionalText(input.userId);
	const position = normalizeOptionalText(input.position);
	const team = normalizeTeam(input.team);

	if (!role || !isSupportedRole(role)) {
		throw new UserRoleSyncInputError("Invalid role");
	}

	if (!userId && !email) {
		throw new UserRoleSyncInputError("Either userId or email is required");
	}

	const warnings: string[] = [];
	let convexUpdated = false;
	let logtoUpdated = false;
	let googleGroupUpdated = false;
	let googleGroup: string | null = null;
	let resolvedEmail = email;
	let resolvedLogtoUserId: string | null = null;
	let targetUser: TargetUser | null = null;

	const convex = getConvexClient();
	const { token } = createConvexSessionToken({
		sub: input.actorLogtoId,
		role: input.actorRole,
	});
	const getByIdFn =
		"users:getByIdForAdmin" as unknown as FunctionReference<"query">;
	const getByEmailFn =
		"users:getByEmailForAdmin" as unknown as FunctionReference<"query">;
	const updateRoleFn =
		"users:updateRole" as unknown as FunctionReference<"mutation">;

	if (userId) {
		targetUser = (await convex.query(getByIdFn, {
			logtoId: input.actorLogtoId,
			authToken: token,
			userId,
		})) as TargetUser | null;

		if (!targetUser) {
			warnings.push(`No Convex user found for id '${userId}'`);
		}

		try {
			await convex.mutation(updateRoleFn, {
				logtoId: input.actorLogtoId,
				authToken: token,
				userId,
				role,
				position,
				team,
			});
			convexUpdated = true;
		} catch (error) {
			throw new UserRoleSyncInputError(
				error instanceof Error
					? error.message
					: "Failed to update role in Convex",
			);
		}
	} else if (resolvedEmail) {
		targetUser = (await convex.query(getByEmailFn, {
			logtoId: input.actorLogtoId,
			authToken: token,
			email: resolvedEmail,
		})) as TargetUser | null;

		if (targetUser?._id) {
			await convex.mutation(updateRoleFn, {
				logtoId: input.actorLogtoId,
				authToken: token,
				userId: targetUser._id,
				role,
				position,
				team,
			});
			convexUpdated = true;
		} else if (source === "onboarding") {
			const createPlaceholderFn =
				"users:createPlaceholder" as unknown as FunctionReference<"mutation">;
			const newUserId = await convex.mutation(createPlaceholderFn, {
				logtoId: input.actorLogtoId,
				authToken: token,
				email: resolvedEmail,
				name: normalizeOptionalText(input.name) || resolvedEmail.split("@")[0],
				role,
				position,
				team,
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
			await syncOfficerRolesOnLogtoUser(resolvedLogtoUserId, role);
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
				await syncOfficerRolesOnLogtoUser(logtoUser.id, role);
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

	if (resolvedEmail) {
		const googleGroupResult = await syncGoogleGroupsForRoleWithAudit(
			convex,
			resolvedEmail,
			role,
		);
		googleGroupUpdated = googleGroupResult.googleGroupUpdated;
		googleGroup = googleGroupResult.googleGroup;
		warnings.push(...googleGroupResult.warnings);
	}

	return {
		convexUpdated,
		logtoUpdated,
		googleGroupUpdated,
		googleGroup,
		warnings,
	} satisfies UserRoleSyncResult;
}
