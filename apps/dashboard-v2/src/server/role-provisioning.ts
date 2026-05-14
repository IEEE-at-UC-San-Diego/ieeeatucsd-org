import type { ConvexHttpClient } from "convex/browser";

import { syncGoogleGroupsForRoleWithAudit } from "@/server/google-group-sync";
import {
	findLogtoUserByEmail,
	isSupportedRole,
	syncAppRoleOnLogtoUser,
} from "@/server/logto";

export type ExternalAccessSyncResult = {
	logtoUpdated: boolean;
	googleGroupUpdated: boolean;
	googleGroup: string | null;
	warnings: string[];
};

export async function syncExternalAccessForRole(params: {
	convex: ConvexHttpClient;
	email: string;
	role: string;
	logtoUserId?: string | null;
}): Promise<ExternalAccessSyncResult> {
	const normalizedEmail = params.email.trim().toLowerCase();
	const warnings: string[] = [];

	if (!normalizedEmail) {
		return {
			logtoUpdated: false,
			googleGroupUpdated: false,
			googleGroup: null,
			warnings: ["Failed to sync external access: email is required"],
		};
	}

	if (!isSupportedRole(params.role)) {
		return {
			logtoUpdated: false,
			googleGroupUpdated: false,
			googleGroup: null,
			warnings: [`Unsupported role '${params.role}' for external access sync`],
		};
	}

	let logtoUpdated = false;
	const logtoUserId = params.logtoUserId || null;

	try {
		const resolvedLogtoUserId =
			logtoUserId || (await findLogtoUserByEmail(normalizedEmail))?.id || null;

		if (resolvedLogtoUserId) {
			await syncAppRoleOnLogtoUser(resolvedLogtoUserId, params.role);
			logtoUpdated = true;
		} else {
			warnings.push(`No Logto user found for email '${normalizedEmail}'`);
		}
	} catch (error) {
		warnings.push(
			error instanceof Error
				? `Failed to sync role to Logto: ${error.message}`
				: "Failed to sync role to Logto",
		);
	}

	const googleGroupResult = await syncGoogleGroupsForRoleWithAudit(
		params.convex,
		normalizedEmail,
		params.role,
	);

	return {
		logtoUpdated,
		googleGroupUpdated: googleGroupResult.googleGroupUpdated,
		googleGroup: googleGroupResult.googleGroup,
		warnings: [...warnings, ...googleGroupResult.warnings],
	};
}
