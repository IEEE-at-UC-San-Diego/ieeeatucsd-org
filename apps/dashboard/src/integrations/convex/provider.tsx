import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider, type ConvexReactClient } from "convex/react";

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

export default function AppConvexProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ConvexProvider
			client={convexQueryClient.convexClient as unknown as ConvexReactClient}
		>
			{children}
		</ConvexProvider>
	);
}
