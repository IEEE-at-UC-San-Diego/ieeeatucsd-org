import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";
import { isNativeAuthBridgeMode } from "@/lib/auth/mode";
import { useAuth } from "./useAuth";

type GenericArgs = Record<string, unknown>;

export function useAuthedQuery<QueryRef extends FunctionReference<"query">>(
  queryRef: QueryRef,
  args?: Partial<QueryRef["_args"]> | "skip",
): QueryRef["_returnType"] | undefined {
  const { logtoId, convexSessionToken } = useAuth();
  const convexAuth = isNativeAuthBridgeMode()
    ? useConvexAuth()
    : { isAuthenticated: true, isLoading: false };
  if (args === "skip") {
    return useQuery(queryRef, "skip" as QueryRef["_args"] | "skip");
  }
  if (!logtoId || !convexSessionToken || convexAuth.isLoading || !convexAuth.isAuthenticated) {
    return useQuery(queryRef, "skip" as QueryRef["_args"] | "skip");
  }

  return useQuery(queryRef, {
    ...((args ?? {}) as GenericArgs),
    logtoId,
    authToken: convexSessionToken,
  } as QueryRef["_args"]);
}

export function useAuthedMutation<MutationRef extends FunctionReference<"mutation">>(
  mutationRef: MutationRef,
): (args?: Partial<MutationRef["_args"]>) => Promise<MutationRef["_returnType"]> {
  const { logtoId, convexSessionToken } = useAuth();
  const convexAuth = isNativeAuthBridgeMode()
    ? useConvexAuth()
    : { isAuthenticated: true, isLoading: false };
  const mutate = useMutation(mutationRef);

  return async (args?: Partial<MutationRef["_args"]>) => {
    if (!logtoId || !convexSessionToken || convexAuth.isLoading || !convexAuth.isAuthenticated) {
      throw new Error("Authentication required");
    }

    return await mutate({
      ...((args ?? {}) as GenericArgs),
      logtoId,
      authToken: convexSessionToken,
    } as MutationRef["_args"]);
  };
}
