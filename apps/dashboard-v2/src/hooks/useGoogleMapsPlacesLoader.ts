import { useEffect, useState } from "react";

const SCRIPT_ID = "google-maps-js";

export type GoogleMapsPlacesLoaderState = {
	ready: boolean;
	loading: boolean;
	error: string | null;
};

/**
 * Loads Maps JS API once with recommended `loading=async`.
 * Ready when the bootstrap is loaded and `importLibrary(...)` can run.
 */
export function useGoogleMapsPlacesLoader(
	apiKey: string | undefined,
): GoogleMapsPlacesLoaderState {
	const [state, setState] = useState<GoogleMapsPlacesLoaderState>(() => {
		const ready =
			typeof window !== "undefined" &&
			typeof window.google?.maps?.importLibrary === "function";
		return { ready, loading: false, error: null };
	});

	useEffect(() => {
		if (!apiKey?.trim()) {
			setState({ ready: false, loading: false, error: null });
			return;
		}

		if (typeof window.google?.maps?.importLibrary === "function") {
			setState({ ready: true, loading: false, error: null });
			return;
		}

		const existing = document.getElementById(SCRIPT_ID) as
			| HTMLScriptElement
			| null
			| undefined;

		const fail = () =>
			setState({
				ready: false,
				loading: false,
				error:
					"Google address suggestions could not load. Enter the address manually.",
			});

		if (existing?.dataset.loaded === "1") {
			setState({
				ready: typeof window.google?.maps?.importLibrary === "function",
				loading: false,
				error: null,
			});
			return;
		}

		if (existing?.dataset.failed === "1") {
			fail();
			return;
		}

		if (existing) {
			setState({ ready: false, loading: true, error: null });
			const onLoad = () =>
				setState({
					ready: typeof window.google?.maps?.importLibrary === "function",
					loading: false,
					error: null,
				});
			const onError = () => {
				existing.dataset.failed = "1";
				fail();
			};
			existing.addEventListener("load", onLoad);
			existing.addEventListener("error", onError);
			return () => {
				existing.removeEventListener("load", onLoad);
				existing.removeEventListener("error", onError);
			};
		}

		const script = document.createElement("script");
		script.id = SCRIPT_ID;
		script.async = true;
		// loading=async: https://goo.gle/js-api-loading — avoids perf warning
		script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&loading=async&v=weekly&libraries=places,routes`;
		setState({ ready: false, loading: true, error: null });
		script.onload = () => {
			script.dataset.loaded = "1";
			setState({
				ready: typeof window.google?.maps?.importLibrary === "function",
				loading: false,
				error: null,
			});
		};
		script.onerror = () => {
			script.dataset.failed = "1";
			fail();
		};
		document.head.appendChild(script);
	}, [apiKey]);

	return state;
}
