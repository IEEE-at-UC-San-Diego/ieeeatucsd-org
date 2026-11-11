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

	it("exits nonzero when the child is terminated by a signal", async () => {
		const { exitStatusFromChild } = await import("./start-dashboard.mjs");
		expect(exitStatusFromChild(0, "SIGTERM")).toBeGreaterThan(0);
		expect(exitStatusFromChild(null, "SIGINT")).toBeGreaterThan(0);
		expect(exitStatusFromChild(0, "SIGTERM")).not.toBe(0);

		deployConvex.mockReturnValue(0);
		/** @type {Record<string, (...args: unknown[]) => void>} */
		const handlers = {};
		const child = {
			pid: 1,
			kill: vi.fn(),
			on: vi.fn((event, cb) => {
				handlers[event] = cb;
			}),
		};
		spawn.mockReturnValue(child);
		const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined);

		const { startDashboard } = await import("./start-dashboard.mjs");
		startDashboard({ DEPLOY_CONVEX: "0" });
		handlers.exit(0, "SIGTERM");

		expect(exit).toHaveBeenCalledOnce();
		expect(exit.mock.calls[0][0]).toBeGreaterThan(0);
		exit.mockRestore();
	});
});
