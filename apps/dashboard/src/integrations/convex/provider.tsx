import { useCallback, useMemo, useRef } from "react";
import { useLogto } from "@logto/react";
import { ConvexQueryClient } from "@convex-dev/react-query";
import {
  ConvexProvider,
  ConvexProviderWithAuth,
  ConvexReactClient,
} from "convex/react";
import { logAuthEvent, errorMessage } from "@/lib/auth/logging";
import { isNativeAuthBridgeMode } from "@/lib/auth/mode";

const CONVEX_URL = (import.meta as ImportMeta & {
  env?: Record<string, string | undefined>;
}).env?.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error("missing envar VITE_CONVEX_URL");
}

const convexQueryClient = new ConvexQueryClient(CONVEX_URL ?? "");

export { convexQueryClient };

function useLogtoConvexAuth() {
  const { isAuthenticated, isLoading, getIdToken } = useLogto();

  const getIdTokenRef = useRef(getIdToken);
  getIdTokenRef.current = getIdToken;

  const fetchAccessToken = useCallback(async ({ forceRefreshToken }: {
    forceRefreshToken: boolean;
  }) => {
    try {
      const token = await getIdTokenRef.current?.();
      if (!token && forceRefreshToken) {
        logAuthEvent("convex_native_token_missing", { forceRefreshToken });
      }
      return token ?? null;
    } catch (error) {
      logAuthEvent("convex_native_token_failed", {
        forceRefreshToken,
        error: errorMessage(error),
      });
      return null;
    }
  }, []);

  return useMemo(
    () => ({
      isAuthenticated,
      isLoading,
      fetchAccessToken,
    }),
    [fetchAccessToken, isAuthenticated, isLoading],
  );
}

export default function AppConvexProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  if (isNativeAuthBridgeMode()) {
    return (
      <ConvexProviderWithAuth
        client={convexQueryClient.convexClient as unknown as ConvexReactClient}
        useAuth={useLogtoConvexAuth}
      >
        {children}
      </ConvexProviderWithAuth>
    );
  }

  return (
    <ConvexProvider
      client={convexQueryClient.convexClient as unknown as ConvexReactClient}
    >
      {children}
    </ConvexProvider>
  );
}
