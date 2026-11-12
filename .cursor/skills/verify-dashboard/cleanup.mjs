import { existsSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";

const pidFile = process.env.VERIFY_PID_FILE ?? "/tmp/verify-dashboard-pids";
const evidence = process.env.VERIFY_EVIDENCE_DIR ?? "/tmp/verify-dashboard-evidence";

if (!existsSync(pidFile)) {
	console.log(
		JSON.stringify({
			stopped: [],
			reason: "no pid file, reused processes were left running",
			evidence,
		}),
	);
	process.exit(0);
}

const pids = readFileSync(pidFile, "utf8")
	.split("\n")
	.map((line) => Number(line.trim()))
	.filter((pid) => Number.isInteger(pid) && pid > 0);

const envLocalPath = resolve(
	import.meta.dirname,
	"../../../apps/dashboard/.env.local",
);
if (existsSync(envLocalPath)) {
	const contents = readFileSync(envLocalPath, "utf8");
	if (contents.startsWith("# verify-dashboard\n")) {
		rmSync(envLocalPath);
	}
}

const stopped = [];
for (const pid of pids) {
	let signaled = false;
	for (const signal of ["SIGTERM", "SIGKILL"]) {
		try {
			process.kill(-pid, signal);
			signaled = true;
		} catch {
			try {
				process.kill(pid, signal);
				signaled = true;
			} catch {
				// already gone, or this signal cannot be delivered
			}
		}
	}
	stopped.push(signaled ? pid : { pid, error: "not running" });
}
console.log(JSON.stringify({ stopped, evidence }));
