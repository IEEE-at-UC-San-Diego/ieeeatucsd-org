import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const TRUTHY = new Set(["1", "true", "yes", "on"]);

/**
 * Decide whether this image build should push Convex functions.
 *
 * Production Dokploy sets DEPLOY_CONVEX=1 on the dashboard app only.
 * The dashboard entrypoint runs this on every container start so a
 * cached image rebuild or a Dokploy rollback still pushes the Convex
 * source that shipped in that image.
 * CI image builds and local compose leave the flag unset so we never
 * push from a pull-request or a laptop.
 *
 * @param {NodeJS.ProcessEnv} env
 * @returns {{ action: "skip"; message: string } | { action: "fail"; message: string } | { action: "deploy"; url: string }}
 */
export function resolveConvexDeploy(env) {
	const flag = (env.DEPLOY_CONVEX ?? "").trim().toLowerCase();
	if (!TRUTHY.has(flag)) {
		return {
			action: "skip",
			message:
				"Skipping Convex deploy (DEPLOY_CONVEX is unset). CI and local compose do not push functions.",
		};
	}

	const url = (
		env.CONVEX_SELF_HOSTED_URL ||
		env.VITE_CONVEX_URL ||
		""
	).trim();
	const adminKey = (env.CONVEX_SELF_HOSTED_ADMIN_KEY || "").trim();

	if (!url) {
		return {
			action: "fail",
			message:
				"DEPLOY_CONVEX is set, but CONVEX_SELF_HOSTED_URL (or VITE_CONVEX_URL) is missing.",
		};
	}

	if (!adminKey) {
		return {
			action: "fail",
			message:
				"DEPLOY_CONVEX is set, but CONVEX_SELF_HOSTED_ADMIN_KEY is missing.",
		};
	}

	return { action: "deploy", url };
}

function isDirectRun() {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}
	return fileURLToPath(import.meta.url) === path.resolve(entry);
}

function runConvexDeploy(url) {
	const dashboardRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
	console.log(`Deploying Convex functions and schema to ${url}`);

	const spawned = spawnSync("pnpm", ["exec", "convex", "deploy", "-y"], {
		cwd: dashboardRoot,
		stdio: "inherit",
		env: {
			...process.env,
			CONVEX_SELF_HOSTED_URL: url,
		},
	});

	if (spawned.error) {
		console.error(spawned.error);
		return 1;
	}

	return spawned.status ?? 1;
}

export function main(env = process.env) {
	const result = resolveConvexDeploy(env);
	if (result.action === "skip") {
		console.log(result.message);
		return 0;
	}
	if (result.action === "fail") {
		console.error(result.message);
		return 1;
	}
	return runConvexDeploy(result.url);
}

if (isDirectRun()) {
	process.exit(main());
}
