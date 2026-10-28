import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { main as deployConvex } from "./deploy-convex.mjs";

const dashboardRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const serverEntry = path.join(dashboardRoot, ".output", "server", "index.mjs");

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
		if (signal) {
			process.kill(process.pid, signal);
			return;
		}
		process.exit(code ?? 1);
	});

	return 0;
}

if (isDirectRun()) {
	const status = startDashboard();
	if (status !== 0) {
		process.exit(status);
	}
}
