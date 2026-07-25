import { ConvexQueryClient } from "@convex-dev/react-query";
import { useLogto } from "@logto/react";
import {
	ConvexProvider,
	ConvexProviderWithAuth,
	type ConvexReactClient,
} from "convex/react";
import { useCallback, useMemo, useRef } from "react";
import { errorMessage, logAuthEvent } from "@/lib/auth/logging";
import { isNativeAuthBridgeMode } from "@/lib/auth/mode";
import { refreshLogtoIdToken } from "@/lib/auth/logtoToken";

const CONVEX_URL = (
	import.meta as ImportMeta & {
		env?: Record<string, string | undefined>;
	}
).env?.VITE_CONVEX_URL;

if (!CONVEX_URL) {
	console.error("missing envar VITE_CONVEX_URL");
}

const convexQueryClient = new ConvexQueryClient(CONVEX_URL ?? "");

export { convexQueryClient };

function useLogtoConvexAuth() {
	const {
		isAuthenticated,
		isLoading,
		getIdToken,
		getAccessToken,
		clearAccessToken,
	} = useLogto();

	const getIdTokenRef = useRef(getIdToken);
	const getAccessTokenRef = useRef(getAccessToken);
	const clearAccessTokenRef = useRef(clearAccessToken);
	getIdTokenRef.current = getIdToken;
	getAccessTokenRef.current = getAccessToken;
	clearAccessTokenRef.current = clearAccessToken;

	const fetchAccessToken = useCallback(
		async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
			try {
				const token = await refreshLogtoIdToken({
					forceRefreshToken,
					clearAccessToken: async () => {
						await clearAccessTokenRef.current?.();
					},
					getAccessToken: async () => getAccessTokenRef.current?.(),
					getIdToken: async () => getIdTokenRef.current?.(),
				});
				if (!token && forceRefreshToken) {
					logAuthEvent("convex_native_token_missing", { forceRefreshToken });
				}
				return token;
			} catch (error) {
				logAuthEvent("convex_native_token_failed", {
					forceRefreshToken,
					error: errorMessage(error),
				});
				return null;
			}
		},
		[],
	);

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
