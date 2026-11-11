/**
 * @vitest-environment jsdom
 */
import { api } from "@convex/_generated/api";
import { cleanup, render, screen } from "@testing-library/react";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuthedQuery } from "./useAuthedConvex";

vi.mock("./useAuth", () => ({
	useAuth: () => ({
		logtoId: "logto_123",
		convexSessionToken: "bridge-token",
		convexSessionExpiresAt: 4_000_000_000_000,
		holdBridgeQueries: false,
	}),
}));

const watchedArgs: Array<Record<string, unknown>> = [];

const convexClient = {
	watchQuery(_query: unknown, args: Record<string, unknown>) {
		watchedArgs.push(args);
		return {
			localQueryResult: () => undefined,
			onUpdate: () => () => {},
			journal: () => undefined,
		};
	},
} as unknown as ConvexReactClient;

function SignedInQuery() {
	const count = useAuthedQuery(api.notifications.unreadCount, {
		logtoId: "logto_123",
	});
	return <p>{count === undefined ? "pending" : String(count)}</p>;
}

function Harness({ children }: { children: ReactNode }) {
	return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}

afterEach(() => {
	cleanup();
});

describe("useAuthedQuery", () => {
	it("renders a signed-in query when the caller passes a fresh args object", () => {
		render(
			<Harness>
				<SignedInQuery />
			</Harness>,
		);

		expect(screen.getByText("pending")).toBeTruthy();
		expect(watchedArgs).toContainEqual({
			logtoId: "logto_123",
			authToken: "bridge-token",
		});
	});
});
