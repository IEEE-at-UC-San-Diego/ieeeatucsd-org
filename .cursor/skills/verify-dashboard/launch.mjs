import { execFileSync, spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { writeFileSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");
const pidFile = process.env.VERIFY_PID_FILE ?? "/tmp/verify-dashboard-pids";
const sessionFile =
	process.env.VERIFY_LOGTO_SESSION ?? "/tmp/verify-dashboard-logto-session.json";
const officerSub = process.env.VERIFY_OFFICER_SUB ?? "officer-local";

function readEnvFile(path) {
	const values = {};
	for (const line of readFileSync(path, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const eq = trimmed.indexOf("=");
		if (eq < 0) continue;
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		values[trimmed.slice(0, eq).trim()] = value;
	}
	return values;
}

function freePort() {
	return new Promise((resolvePort, reject) => {
		const probe = createServer();
		probe.listen(0, "127.0.0.1", () => {
			const address = probe.address();
			const port = typeof address === "object" && address ? address.port : 0;
			probe.close(() => resolvePort(port));
		});
		probe.on("error", reject);
	});
}

function descendants(root) {
	const found = [];
	const stack = [String(root)];
	while (stack.length > 0) {
		const current = stack.pop();
		let listed = "";
		try {
			listed = execFileSync("ps", ["-o", "pid=", "--ppid", current], {
				encoding: "utf8",
			});
		} catch {
			continue;
		}
		for (const line of listed.split("\n")) {
			const pid = line.trim();
			if (!pid) continue;
			found.push(Number(pid));
			stack.push(pid);
		}
	}
	return found;
}

function spawnDetached(command, args, env) {
	const child = spawn(command, args, {
		cwd: repoRoot,
		env,
		detached: true,
		stdio: "ignore",
	});
	child.unref();
	if (!child.pid) throw new Error(`Failed to start ${command}`);
	return child.pid;
}

const appEnv = readEnvFile(resolve(repoRoot, ".env"));
const appId = appEnv.VITE_LOGTO_APP_ID?.trim();
if (!appId) {
	console.error("VITE_LOGTO_APP_ID is missing from .env");
	process.exit(1);
}

const envLocalPath = resolve(repoRoot, "apps/dashboard/.env.local");
const health = await fetch("http://localhost:3000/api/health").catch(() => null);
if (health?.ok) {
	console.error(
		"localhost:3000 is already serving the dashboard. Stop it before launch so this run can record the pid.",
	);
	process.exit(1);
}

const port = await freePort();
const endpoint = `http://127.0.0.1:${port}`;
const accessToken = randomBytes(16).toString("hex");
const now = Math.floor(Date.now() / 1000);
const payload = Buffer.from(
	JSON.stringify({
		iss: endpoint,
		sub: officerSub,
		aud: appId,
		iat: now,
		exp: now + 60 * 60,
	}),
).toString("base64url");
const idToken = `${Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")}.${payload}.`;

writeFileSync(
	envLocalPath,
	`# verify-dashboard\nLOGTO_ENDPOINT=${endpoint}\nVITE_LOGTO_ENDPOINT=${endpoint}\n`,
);
const stubPid = spawnDetached(
	process.execPath,
	[".cursor/skills/verify-dashboard/userinfo-stub.mjs"],
	{
		...process.env,
		PORT: String(port),
		VERIFY_ACCESS_TOKEN: accessToken,
		VERIFY_OFFICER_SUB: officerSub,
	},
);
const dashboardPid = spawnDetached("pnpm", ["dev:dashboard"], {
	...process.env,
	LOGTO_ENDPOINT: endpoint,
	VITE_LOGTO_ENDPOINT: endpoint,
});

writeFileSync(pidFile, `${stubPid}\n${dashboardPid}\n`);
writeFileSync(
	sessionFile,
	JSON.stringify({
		appId,
		idToken,
		accessToken,
		expiresAt: now + 60 * 60,
	}),
);

const deadline = Date.now() + 60_000;
let ready = false;
while (Date.now() < deadline) {
	const response = await fetch("http://localhost:3000/api/health").catch(
		() => null,
	);
	if (response?.ok) {
		ready = true;
		break;
	}
	await new Promise((resolveWait) => setTimeout(resolveWait, 500));
}

const dashboardTree = descendants(dashboardPid);
writeFileSync(
	pidFile,
	[...dashboardTree, dashboardPid, ...descendants(stubPid), stubPid].join("\n") +
		"\n",
);
if (!ready) {
	rmSync(envLocalPath, { force: true });
	console.error("Dashboard did not become ready");
	process.exit(1);
}

console.log(
	JSON.stringify({
		ok: true,
		pidFile,
		sessionFile,
		pids: [stubPid, dashboardPid, ...dashboardTree],
		logtoEndpoint: endpoint,
	}),
);
