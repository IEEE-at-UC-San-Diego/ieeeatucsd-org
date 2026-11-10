import { type RequestForQueries, useMutation, useQueries } from "convex/react";
import type { FunctionReference } from "convex/server";
import { useMemo } from "react";
import { shouldSendBridgeToken } from "@/lib/auth/openTabSession";
import { useAuth } from "./useAuth";

type GenericArgs = Record<string, unknown>;

function isRetryableAuthError(error: Error) {
	return (
		error.message.includes("User not found in database") ||
		error.message.includes("Auth token expired")
	);
}

export function useAuthedQuery<QueryRef extends FunctionReference<"query">>(
	queryRef: QueryRef,
	args?: Partial<QueryRef["_args"]> | "skip",
): QueryRef["_returnType"] | undefined {
	const {
		logtoId,
		convexSessionToken,
		convexSessionExpiresAt,
		holdBridgeQueries,
	} = useAuth();
	const bridgeReady = shouldSendBridgeToken(
		convexSessionExpiresAt,
		Date.now(),
		holdBridgeQueries,
	);
	const skip =
		args === "skip" || !logtoId || !convexSessionToken || !bridgeReady;
	const argKey = args === "skip" ? "skip" : JSON.stringify(args ?? {});
	const requests = useMemo((): RequestForQueries => {
		if (skip || !logtoId || !convexSessionToken || args === "skip") return {};
		return {
			query: {
				query: queryRef,
				args: {
					...((args ?? {}) as GenericArgs),
					logtoId,
					authToken: convexSessionToken,
				},
			},
		};
	}, [argKey, convexSessionToken, logtoId, queryRef, skip]);
	const result = useQueries(requests).query as
		| QueryRef["_returnType"]
		| undefined
		| Error;
	if (result instanceof Error) {
		if (isRetryableAuthError(result)) return undefined;
		throw result;
	}
	return result;
}

export function useAuthedMutation<
	MutationRef extends FunctionReference<"mutation">,
>(
	mutationRef: MutationRef,
): (
	args?: Partial<MutationRef["_args"]>,
) => Promise<MutationRef["_returnType"]> {
	const { ensureBridgeSession } = useAuth();
	const mutate = useMutation(mutationRef);

	return async (args?: Partial<MutationRef["_args"]>) => {
		const session = await ensureBridgeSession();
		return await mutate({
			...((args ?? {}) as GenericArgs),
			logtoId: session.logtoId,
			authToken: session.authToken,
		} as MutationRef["_args"]);
	};
}
