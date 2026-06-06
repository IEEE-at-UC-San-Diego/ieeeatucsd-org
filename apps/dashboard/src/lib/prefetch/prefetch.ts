import type { FunctionReference } from "convex/server";
import { getFunctionName } from "convex/server";
import { convexQueryClient } from "@/integrations/convex/provider";
import { getAuthTokens } from "./authTokens";

const MAX_CONCURRENT = 4;
const IDLE_TIMEOUT_MS = 90_000;

type GenericArgs = Record<string, unknown>;

type PrefetchLoaderContext = {
	location: { pathname: string };
};

type PrefetchEntry = {
	key: string;
	dispose: () => void;
	idleTimer: ReturnType<typeof setTimeout> | undefined;
};

const registry = new Map<string, PrefetchEntry>();
const insertionOrder: string[] = [];

const isDev = import.meta.env.DEV;

function debug(message: string, data?: Record<string, unknown>) {
	if (!isDev) return;
	if (data) {
		console.debug(`[prefetch] ${message}`, data);
	} else {
		console.debug(`[prefetch] ${message}`);
	}
}

function stableArgsKey(args: GenericArgs) {
	const sorted = Object.keys(args)
		.sort()
		.reduce<GenericArgs>((acc, key) => {
			acc[key] = args[key];
			return acc;
		}, {});
	return JSON.stringify(sorted);
}

function cacheKey(query: FunctionReference<"query">, args: GenericArgs) {
	return `${getFunctionName(query)}:${stableArgsKey(args)}`;
}

function clearIdleTimer(entry: PrefetchEntry) {
	if (entry.idleTimer !== undefined) {
		clearTimeout(entry.idleTimer);
	}
}

function scheduleIdleDispose(key: string) {
	const entry = registry.get(key);
	if (!entry) return;

	clearIdleTimer(entry);
	entry.idleTimer = setTimeout(() => {
		disposeEntry(key, "idle");
	}, IDLE_TIMEOUT_MS);
}

function disposeEntry(key: string, reason: "idle" | "evict") {
	const entry = registry.get(key);
	if (!entry) return;

	clearIdleTimer(entry);
	entry.dispose();
	registry.delete(key);

	const index = insertionOrder.indexOf(key);
	if (index >= 0) {
		insertionOrder.splice(index, 1);
	}

	debug(reason === "evict" ? "evict" : "dispose", { key, reason });
}

function evictOldest() {
	const oldestKey = insertionOrder[0];
	if (oldestKey) {
		disposeEntry(oldestKey, "evict");
	}
}

function shouldSkip(context?: PrefetchLoaderContext) {
	if (typeof window === "undefined") {
		return true;
	}

	if (context && window.location.pathname === context.location.pathname) {
		debug("skip-current-route", { pathname: context.location.pathname });
		return true;
	}

	return false;
}

function warmQuery(
	query: FunctionReference<"query">,
	args: GenericArgs,
	context?: PrefetchLoaderContext,
) {
	if (shouldSkip(context)) return;

	const key = cacheKey(query, args);
	const existing = registry.get(key);
	if (existing) {
		scheduleIdleDispose(key);
		debug("hit", { key });
		return;
	}

	while (registry.size >= MAX_CONCURRENT) {
		evictOldest();
	}

	try {
		const watch = convexQueryClient.convexClient.watchQuery(
			query,
			args as never,
		);
		const dispose = watch.onUpdate(() => {});

		const entry: PrefetchEntry = {
			key,
			dispose,
			idleTimer: undefined,
		};
		registry.set(key, entry);
		insertionOrder.push(key);
		scheduleIdleDispose(key);
		debug("start", { key });
	} catch (error) {
		debug("error", {
			key,
			message: error instanceof Error ? error.message : String(error),
		});
	}
}

export function prefetchQuery<Query extends FunctionReference<"query">>(
	query: Query,
	args?: Partial<Query["_args"]>,
	context?: PrefetchLoaderContext,
) {
	try {
		warmQuery(query, (args ?? {}) as GenericArgs, context);
	} catch {
		// Prefetch failures must never break navigation.
	}
}

export function prefetchAuthedQuery<Query extends FunctionReference<"query">>(
	query: Query,
	extraArgs?: Partial<Query["_args"]>,
	context?: PrefetchLoaderContext,
) {
	try {
		const tokens = getAuthTokens();
		if (!tokens) {
			debug("miss-no-tokens", { query: getFunctionName(query) });
			return;
		}

		warmQuery(
			query,
			{
				...((extraArgs ?? {}) as GenericArgs),
				logtoId: tokens.logtoId,
				authToken: tokens.authToken,
			},
			context,
		);
	} catch {
		// Prefetch failures must never break navigation.
	}
}
