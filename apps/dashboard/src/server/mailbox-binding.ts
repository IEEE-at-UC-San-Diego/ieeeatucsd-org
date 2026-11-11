import { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";
import { env } from "@/env";
import { createConvexSessionToken } from "@/server/convex-session";
import type { UserRole } from "@/types/roles";

function convexClient() {
	const url =
		env.VITE_CONVEX_URL ||
		process.env.CONVEX_URL ||
		process.env.VITE_CONVEX_URL;
	if (!url) {
		throw new Error("Missing required env: VITE_CONVEX_URL or CONVEX_URL");
	}
	return new ConvexHttpClient(url);
}

export async function isMailboxBoundToAnotherAccount(args: {
	logtoId: string;
	role?: UserRole;
	ieeeEmail: string;
	rawValues?: string[];
}) {
	const client = convexClient();
	const fn =
		"users:isMailboxBoundToAnotherAccount" as unknown as FunctionReference<"query">;
	const { token } = createConvexSessionToken({
		sub: args.logtoId,
		role: args.role,
	});
	const taken = await client.query(fn, {
		logtoId: args.logtoId,
		authToken: token,
		ieeeEmail: args.ieeeEmail,
		...(args.rawValues ? { rawValues: args.rawValues } : {}),
	});
	if (typeof taken !== "boolean") {
		throw new Error("Invalid mailbox binding lookup");
	}
	return taken;
}
