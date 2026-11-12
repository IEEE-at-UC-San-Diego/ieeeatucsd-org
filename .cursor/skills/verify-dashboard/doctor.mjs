const dashboard = process.env.DASHBOARD_URL ?? "http://localhost:3000";
const convex = process.env.CONVEX_URL ?? "http://127.0.0.1:3210";

const health = await fetch(`${dashboard}/api/health`).catch((error) => error);
const version = await fetch(`${convex}/version`).catch((error) => error);

if (health instanceof Error || !health.ok) {
	console.error(
		JSON.stringify({
			ok: false,
			dashboard,
			health: health instanceof Error ? String(health) : health.status,
		}),
	);
	process.exit(1);
}
if (version instanceof Error || !version.ok) {
	console.error(
		JSON.stringify({
			ok: false,
			convex,
			version: version instanceof Error ? String(version) : version.status,
		}),
	);
	process.exit(1);
}

console.log(
	JSON.stringify({
		ok: true,
		dashboard,
		health: health.status,
		convex,
		version: (await version.text()).trim(),
	}),
);
