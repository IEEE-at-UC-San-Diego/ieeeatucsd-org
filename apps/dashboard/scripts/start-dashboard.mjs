import { spawn } from "node:child_process";
import { constants as osConstants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main as deployConvex } from "./deploy-convex.mjs";

const dashboardRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverEntry = path.join(dashboardRoot, ".output", "server", "index.mjs");

/**
 * Map a child `exit` event to a process status.
 * A signal death must not look like success: Unix uses 128 + signal number.
 *
 * @param {number | null} code
 * @param {NodeJS.Signals | null} signal
 */
export function exitStatusFromChild(code, signal) {
	if (signal) {
		const signalNumber = osConstants.signals[signal];
		return typeof signalNumber === "number" ? 128 + signalNumber : 1;
	}
	return code ?? 1;
}

function isDirectRun() {
	const entry = process.argv[1];
	if (!entry) {
		return false;
	}
	return fileURLToPath(import.meta.url) === path.resolve(entry);
}

export function startDashboard(env = process.env) {
	const deployStatus = deployConvex(env);
	if (deployStatus !== 0) {
		return deployStatus;
	}

	const child = spawn(process.execPath, [serverEntry], {
		cwd: dashboardRoot,
		stdio: "inherit",
		env,
	});

	const forward = (signal) => {
		if (child.pid) {
			child.kill(signal);
		}
	};
	process.on("SIGTERM", () => forward("SIGTERM"));
	process.on("SIGINT", () => forward("SIGINT"));

	child.on("exit", (code, signal) => {
		process.exit(exitStatusFromChild(code, signal));
	});

	return 0;
}

if (isDirectRun()) {
	const status = startDashboard();
	if (status !== 0) {
		process.exit(status);
	}
}
