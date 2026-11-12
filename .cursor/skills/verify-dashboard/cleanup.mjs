import { existsSync, readFileSync } from "node:fs";

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

const stopped = [];
for (const pid of pids) {
	try {
		process.kill(pid, "SIGTERM");
		stopped.push(pid);
	} catch (error) {
		stopped.push({ pid, error: String(error) });
	}
}
console.log(JSON.stringify({ stopped, evidence }));
