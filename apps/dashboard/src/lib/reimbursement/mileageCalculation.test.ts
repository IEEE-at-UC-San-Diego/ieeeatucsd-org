import { describe, expect, it } from "vitest";
import type { GoogleMapsPlacesLoaderState } from "@/hooks/useGoogleMapsPlacesLoader";
import {
	deriveMileagePhase,
	describeCalculatedRoute,
	type MileageCalculationResult,
	type MileagePrerequisite,
	type MileageRouteInput,
	resolveMileagePrerequisite,
} from "./mileageCalculation";

const readyMaps: GoogleMapsPlacesLoaderState = {
	ready: true,
	loading: false,
	error: null,
};

const completeRoute: MileageRouteInput = {
	isMileage: true,
	from: " Campus ",
	to: "Store ",
	stops: [" Library "],
};

const routeKey = ["Campus", "Library", "Store"].join("\u001f");

describe("resolveMileagePrerequisite", () => {
	it("is not applicable to receipt expenses", () => {
		expect(
			resolveMileagePrerequisite(
				{ ...completeRoute, isMileage: false },
				{ hasApiKey: true, maps: readyMaps },
			),
		).toEqual({ status: "notMileage" });
	});

	it("waits for both endpoints and every stop", () => {
		expect(
			resolveMileagePrerequisite(
				{ ...completeRoute, to: "  " },
				{ hasApiKey: true, maps: readyMaps },
			),
		).toEqual({
			status: "incomplete",
			message: "Enter From and To addresses to calculate mileage.",
		});
		expect(
			resolveMileagePrerequisite(
				{ ...completeRoute, stops: ["Library", " "] },
				{ hasApiKey: true, maps: readyMaps },
			),
		).toEqual({
			status: "incomplete",
			message: "Fill every stop address to calculate the full route.",
		});
	});

	it("checks route completeness before configuration and maps state", () => {
		expect(
			resolveMileagePrerequisite(
				{ ...completeRoute, from: "" },
				{
					hasApiKey: false,
					maps: { ready: false, loading: false, error: "boom" },
				},
			).status,
		).toBe("incomplete");
	});

	it("is unavailable without an API key or when maps failed to load", () => {
		expect(
			resolveMileagePrerequisite(completeRoute, {
				hasApiKey: false,
				maps: readyMaps,
			}),
		).toEqual({
			status: "unavailable",
			message: "Automatic mileage calculation needs VITE_GOOGLE_MAPS_API_KEY.",
		});
		expect(
			resolveMileagePrerequisite(completeRoute, {
				hasApiKey: true,
				maps: { ready: false, loading: false, error: "Maps failed" },
			}),
		).toEqual({ status: "unavailable", message: "Maps failed" });
	});

	it("waits for maps to finish loading", () => {
		expect(
			resolveMileagePrerequisite(completeRoute, {
				hasApiKey: true,
				maps: { ready: false, loading: true, error: null },
			}),
		).toEqual({ status: "loadingMaps" });
		expect(
			resolveMileagePrerequisite(completeRoute, {
				hasApiKey: true,
				maps: { ready: false, loading: false, error: null },
			}),
		).toEqual({ status: "loadingMaps" });
	});

	it("produces a trimmed route with a stable key when ready", () => {
		expect(
			resolveMileagePrerequisite(completeRoute, {
				hasApiKey: true,
				maps: readyMaps,
			}),
		).toEqual({
			status: "ready",
			route: {
				from: "Campus",
				to: "Store",
				stops: ["Library"],
				key: routeKey,
			},
		});
	});
});

describe("describeCalculatedRoute", () => {
	it("mentions stops only when the route has them", () => {
		expect(
			describeCalculatedRoute({ from: "A", to: "B", stops: [], key: "" }),
		).toBe("Calculated from From to To.");
		expect(
			describeCalculatedRoute({ from: "A", to: "B", stops: ["C"], key: "" }),
		).toBe("Calculated from From through every stop to To.");
	});
});

describe("deriveMileagePhase", () => {
	const ready: MileagePrerequisite = {
		status: "ready",
		route: { from: "Campus", to: "Store", stops: ["Library"], key: routeKey },
	};
	const result: MileageCalculationResult = {
		receiptId: "r1",
		routeKey,
		status: "calculated",
		message: "Calculated from From through every stop to To.",
	};

	it("maps prerequisites that block calculation", () => {
		expect(deriveMileagePhase({ status: "notMileage" }, null, "r1")).toEqual({
			status: "idle",
		});
		expect(
			deriveMileagePhase(
				{ status: "incomplete", message: "Enter addresses" },
				result,
				"r1",
			),
		).toEqual({ status: "waiting", message: "Enter addresses" });
		expect(
			deriveMileagePhase(
				{ status: "unavailable", message: "Maps failed" },
				result,
				"r1",
			),
		).toEqual({ status: "error", message: "Maps failed" });
		expect(deriveMileagePhase({ status: "loadingMaps" }, null, "r1")).toEqual({
			status: "calculating",
			message: "Loading route calculation…",
		});
	});

	it("is calculating until a result for this receipt and route arrives", () => {
		expect(deriveMileagePhase(ready, null, "r1")).toEqual({
			status: "calculating",
			message: "Calculating driving distance…",
		});
	});

	it("shows a result that matches the receipt and route", () => {
		expect(deriveMileagePhase(ready, result, "r1")).toEqual({
			status: "calculated",
			message: result.message,
		});
		expect(
			deriveMileagePhase(
				ready,
				{ ...result, status: "error", message: "No route" },
				"r1",
			),
		).toEqual({ status: "error", message: "No route" });
	});

	it("ignores results for another receipt or an outdated route", () => {
		expect(deriveMileagePhase(ready, result, "r2").status).toBe("calculating");
		expect(
			deriveMileagePhase(ready, { ...result, routeKey: "old" }, "r1").status,
		).toBe("calculating");
	});
});
