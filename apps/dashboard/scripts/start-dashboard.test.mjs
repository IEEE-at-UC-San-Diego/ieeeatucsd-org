import { afterEach, describe, expect, it, vi } from "vitest";

const deployConvex = vi.fn();
const spawn = vi.fn();

vi.mock("./deploy-convex.mjs", () => ({
	main: (...args) => deployConvex(...args),
}));

vi.mock("node:child_process", () => ({
	spawn: (...args) => spawn(...args),
}));

afterEach(() => {
	vi.resetModules();
	deployConvex.mockReset();
	spawn.mockReset();
});

describe("startDashboard", () => {
	it("starts the server after a skipped Convex push", async () => {
		deployConvex.mockReturnValue(0);
		const child = { pid: 1, kill: vi.fn(), on: vi.fn() };
		spawn.mockReturnValue(child);

		const { startDashboard } = await import("./start-dashboard.mjs");
		expect(startDashboard({ DEPLOY_CONVEX: "0" })).toBe(0);
		expect(spawn).toHaveBeenCalledOnce();
	});

	it("does not start the server when a production Convex push fails", async () => {
		deployConvex.mockReturnValue(1);

		const { startDashboard } = await import("./start-dashboard.mjs");
		expect(
			startDashboard({
				DEPLOY_CONVEX: "1",
				VITE_CONVEX_URL: "https://convex.example.com",
			}),
		).toBe(1);
		expect(spawn).not.toHaveBeenCalled();
	});
});
