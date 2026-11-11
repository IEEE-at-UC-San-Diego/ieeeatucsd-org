import type { GoogleMapsPlacesLoaderState } from "@/hooks/useGoogleMapsPlacesLoader";

export type MileageRoute = {
	from: string;
	to: string;
	stops: string[];
	key: string;
};

export type MileageRouteInput = {
	isMileage: boolean;
	from: string;
	to: string;
	stops: readonly string[];
};

/** Everything that must hold before a route calculation can be requested. */
export type MileagePrerequisite =
	| { status: "notMileage" }
	| { status: "incomplete"; message: string }
	| { status: "unavailable"; message: string }
	| { status: "loadingMaps" }
	| { status: "ready"; route: MileageRoute };

export type MileageCalculationResult = {
	receiptId: string;
	routeKey: string;
	status: "calculated" | "error";
	message: string;
};

export type MileagePhase =
	| { status: "idle" }
	| { status: "waiting"; message: string }
	| { status: "calculating"; message: string }
	| { status: "calculated"; message: string }
	| { status: "error"; message: string };

export function resolveMileagePrerequisite(
	input: MileageRouteInput,
	environment: { hasApiKey: boolean; maps: GoogleMapsPlacesLoaderState },
): MileagePrerequisite {
	if (!input.isMileage) return { status: "notMileage" };

	const from = input.from.trim();
	const to = input.to.trim();
	if (!from || !to) {
		return {
			status: "incomplete",
			message: "Enter From and To addresses to calculate mileage.",
		};
	}

	const stops = input.stops.map((stop) => stop.trim());
	if (stops.some((stop) => stop.length === 0)) {
		return {
			status: "incomplete",
			message: "Fill every stop address to calculate the full route.",
		};
	}

	if (!environment.hasApiKey) {
		return {
			status: "unavailable",
			message: "Automatic mileage calculation needs VITE_GOOGLE_MAPS_API_KEY.",
		};
	}

	const { maps } = environment;
	if (maps.error) return { status: "unavailable", message: maps.error };
	if (maps.loading || !maps.ready) return { status: "loadingMaps" };

	return {
		status: "ready",
		route: { from, to, stops, key: [from, ...stops, to].join("\u001f") },
	};
}

export function describeCalculatedRoute(route: MileageRoute): string {
	return route.stops.length > 0
		? "Calculated from From through every stop to To."
		: "Calculated from From to To.";
}

export function deriveMileagePhase(
	prerequisite: MileagePrerequisite,
	result: MileageCalculationResult | null,
	receiptId: string,
): MileagePhase {
	switch (prerequisite.status) {
		case "notMileage":
			return { status: "idle" };
		case "incomplete":
			return { status: "waiting", message: prerequisite.message };
		case "unavailable":
			return { status: "error", message: prerequisite.message };
		case "loadingMaps":
			return { status: "calculating", message: "Loading route calculation…" };
		case "ready":
			if (
				result?.receiptId === receiptId &&
				result.routeKey === prerequisite.route.key
			) {
				return { status: result.status, message: result.message };
			}
			return {
				status: "calculating",
				message: "Calculating driving distance…",
			};
		default: {
			const unreachable: never = prerequisite;
			return unreachable;
		}
	}
}
