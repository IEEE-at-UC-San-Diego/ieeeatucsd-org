import type { KeyboardEvent } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGoogleMapsPlacesLoader } from "@/hooks/useGoogleMapsPlacesLoader";
import { cn } from "@/lib/utils";

type Props = {
	id?: string;
	label?: string;
	value: string;
	onChange: (value: string) => void;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	/** Prefer street-style results; still allows all types if too strict */
	addressOnly?: boolean;
	/** Show Google Maps env hint (set false on repeated fields in the same form) */
	showFootnote?: boolean;
};

type PlacesLibraryLike = {
	AutocompleteService?: new () => AutocompleteServiceLike;
	AutocompleteSessionToken?: new () => unknown;
};

type AutocompleteServiceLike = {
	getPlacePredictions: (
		request: AutocompleteRequestLike,
		callback: (
			predictions: PlacePredictionLike[] | null,
			status: string,
		) => void,
	) => Promise<unknown> | undefined;
};

type AutocompleteRequestLike = {
	input: string;
	componentRestrictions?: { country: string };
	region?: string;
	sessionToken?: unknown;
	types?: string[];
};

type PlacePredictionLike = {
	place_id: string;
	description: string;
	structured_formatting?: {
		main_text?: string;
		secondary_text?: string;
	};
};

type AddressSuggestion = {
	id: string;
	mainText: string;
	secondaryText: string;
	fullText: string;
};

type PlacesApiState = {
	autocomplete: AutocompleteServiceLike;
	sessionTokenCtor?: new () => unknown;
	okStatus: string;
	zeroResultsStatus: string;
	requestDeniedStatus: string;
};

/**
 * Address input with progressive Google Places suggestions.
 * The plain input always works; Places only enhances it when the key/API loads.
 */
export function AddressAutocompleteInput({
	id: propId,
	label,
	value,
	onChange,
	placeholder = "Start typing an address...",
	disabled,
	className,
	addressOnly = true,
	showFootnote = true,
}: Props) {
	const reactId = useId();
	const inputId = propId ?? `addr-${reactId}`;
	const dropdownId = `${inputId}-suggestions`;
	const inputRef = useRef<HTMLInputElement>(null);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const requestIdRef = useRef(0);
	const sessionTokenRef = useRef<unknown | null>(null);
	const [placesApi, setPlacesApi] = useState<PlacesApiState | null>(null);
	const [libraryError, setLibraryError] = useState<string | null>(null);
	const [suggestionsDisabled, setSuggestionsDisabled] = useState(false);
	const [selectionLocked, setSelectionLocked] = useState(false);
	const [isFocused, setIsFocused] = useState(false);
	const [isFetching, setIsFetching] = useState(false);
	const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
	const [activeIndex, setActiveIndex] = useState(-1);
	const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
	const maps = useGoogleMapsPlacesLoader(apiKey);

	useEffect(() => {
		if (!maps.ready || !apiKey?.trim()) {
			setPlacesApi(null);
			return;
		}

		let cancelled = false;

		void (async () => {
			try {
				const importLibrary = window.google?.maps?.importLibrary as
					| ((lib: string) => Promise<unknown>)
					| undefined;
				if (!importLibrary) {
					throw new Error("Google Maps importLibrary is unavailable.");
				}

				const imported = (await importLibrary("places")) as PlacesLibraryLike;
				const globalPlaces = window.google?.maps?.places as
					| PlacesLibraryLike
					| undefined;
				const library = { ...globalPlaces, ...imported };

				if (cancelled) return;
				if (!library.AutocompleteService) {
					throw new Error("Google Places autocomplete is unavailable.");
				}

				setPlacesApi({
					autocomplete: new library.AutocompleteService(),
					sessionTokenCtor: library.AutocompleteSessionToken,
					okStatus: "OK",
					zeroResultsStatus: "ZERO_RESULTS",
					requestDeniedStatus: "REQUEST_DENIED",
				});
				setLibraryError(null);
				setSuggestionsDisabled(false);
			} catch (error) {
				if (cancelled) return;
				const message =
					error instanceof Error
						? error.message
						: "Google address suggestions are unavailable.";
				setPlacesApi(null);
				setLibraryError(message);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [maps.ready]);

	useEffect(() => {
		if (
			!isFocused ||
			disabled ||
			suggestionsDisabled ||
			selectionLocked ||
			!placesApi
		) {
			setSuggestions([]);
			setIsFetching(false);
			setActiveIndex(-1);
			return;
		}

		const query = value.trim();
		if (query.length < 3) {
			setSuggestions([]);
			setIsFetching(false);
			setActiveIndex(-1);
			return;
		}

		const requestId = requestIdRef.current + 1;
		requestIdRef.current = requestId;
		const timeout = window.setTimeout(() => {
			setIsFetching(true);
			if (!sessionTokenRef.current && placesApi.sessionTokenCtor) {
				sessionTokenRef.current = new placesApi.sessionTokenCtor();
			}

			getPlacePredictions(placesApi, {
				input: query,
				componentRestrictions: { country: "us" },
				region: "us",
				sessionToken: sessionTokenRef.current ?? undefined,
				types: addressOnly ? ["address"] : undefined,
			})
				.then(({ predictions, status }) => {
					if (requestIdRef.current !== requestId) return;

					if (status === placesApi.requestDeniedStatus) {
						setLibraryError(
							"Google address suggestions are denied for this API key. Enter the address manually.",
						);
						setSuggestionsDisabled(true);
						setSuggestions([]);
						setActiveIndex(-1);
						return;
					}

					if (
						status !== placesApi.okStatus &&
						status !== placesApi.zeroResultsStatus
					) {
						setLibraryError(
							"Google address suggestions are temporarily unavailable. Enter the address manually.",
						);
						setSuggestions([]);
						setActiveIndex(-1);
						return;
					}

					setLibraryError(null);
					const nextSuggestions = predictions
						.map(
							(prediction): AddressSuggestion => ({
								id: prediction.place_id,
								mainText:
									prediction.structured_formatting?.main_text ||
									prediction.description,
								secondaryText:
									prediction.structured_formatting?.secondary_text || "",
								fullText: prediction.description,
							}),
						)
						.slice(0, 5);
					setSuggestions(nextSuggestions);
					setActiveIndex(nextSuggestions.length > 0 ? 0 : -1);
				})
				.catch(() => {
					if (requestIdRef.current !== requestId) return;
					setLibraryError(
						"Google address suggestions are unavailable. Enter the address manually.",
					);
					setSuggestions([]);
					setActiveIndex(-1);
				})
				.finally(() => {
					if (requestIdRef.current === requestId) {
						setIsFetching(false);
					}
				});
		}, 180);

		return () => window.clearTimeout(timeout);
	}, [
		addressOnly,
		disabled,
		isFocused,
		placesApi,
		selectionLocked,
		suggestionsDisabled,
		value,
	]);

	useEffect(() => {
		const onPointerDown = (event: PointerEvent) => {
			if (!wrapperRef.current?.contains(event.target as Node)) {
				setSuggestions([]);
				setActiveIndex(-1);
			}
		};

		document.addEventListener("pointerdown", onPointerDown);
		return () => document.removeEventListener("pointerdown", onPointerDown);
	}, []);

	const canShowSuggestions =
		isFocused && !disabled && suggestions.length > 0 && placesApi !== null;

	const helperText = (() => {
		if (!showFootnote) return null;
		if (!apiKey?.trim()) {
			return (
				<>
					Type the full address. Set{" "}
					<code className="rounded bg-muted px-1 py-0.5 text-[10px]">
						VITE_GOOGLE_MAPS_API_KEY
					</code>{" "}
					to enable suggestions.
				</>
			);
		}
		if (maps.error || libraryError) {
			return "Suggestions are unavailable. You can still type the address manually.";
		}
		if (maps.loading || (maps.ready && !placesApi)) {
			return "Loading address suggestions...";
		}
		return "Start typing, choose a suggestion, or enter the address manually.";
	})();

	const selectSuggestion = async (suggestion: AddressSuggestion) => {
		setSuggestions([]);
		setActiveIndex(-1);
		setSelectionLocked(true);
		setIsFocused(false);
		onChange(suggestion.fullText);
		sessionTokenRef.current = null;
		inputRef.current?.blur();
	};

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (!canShowSuggestions) return;

		if (event.key === "ArrowDown") {
			event.preventDefault();
			setActiveIndex((index) => (index + 1) % suggestions.length);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			setActiveIndex(
				(index) => (index - 1 + suggestions.length) % suggestions.length,
			);
			return;
		}

		if (event.key === "Enter" && activeIndex >= 0) {
			event.preventDefault();
			void selectSuggestion(suggestions[activeIndex]);
			return;
		}

		if (event.key === "Escape") {
			setSuggestions([]);
			setActiveIndex(-1);
		}
	};

	return (
		<div ref={wrapperRef} className={cn("relative space-y-1.5", className)}>
			{label ? (
				<Label htmlFor={inputId} className="text-xs font-medium">
					{label}
				</Label>
			) : null}
			<div className="relative">
				<Input
					ref={inputRef}
					id={inputId}
					value={value}
					onChange={(event) => {
						setSelectionLocked(false);
						onChange(event.target.value);
						if (!sessionTokenRef.current) {
							sessionTokenRef.current = placesApi?.sessionTokenCtor
								? new placesApi.sessionTokenCtor()
								: null;
						}
					}}
					onFocus={() => {
						setSelectionLocked(false);
						setIsFocused(true);
					}}
					onClick={() => {
						setSelectionLocked(false);
						setIsFocused(true);
					}}
					onBlur={() => setIsFocused(false)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled}
					autoComplete="street-address"
					role="combobox"
					aria-autocomplete="list"
					aria-expanded={canShowSuggestions}
					aria-controls={dropdownId}
					aria-activedescendant={
						activeIndex >= 0 ? `${dropdownId}-${activeIndex}` : undefined
					}
					className="w-full pr-10"
				/>
				{isFetching || maps.loading ? (
					<span className="-translate-y-1/2 absolute top-1/2 right-3 h-2 w-2 animate-pulse rounded-full bg-primary" />
				) : placesApi && !suggestionsDisabled ? (
					<span className="-translate-y-1/2 absolute top-1/2 right-3 h-2 w-2 rounded-full bg-ds-green-1000" />
				) : null}
			</div>
			{canShowSuggestions ? (
				<div
					id={dropdownId}
					role="listbox"
					className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg"
				>
					{suggestions.map((suggestion, index) => (
						<Button
							variant="ghost"
							key={`${suggestion.id}-${index}`}
							id={`${dropdownId}-${index}`}
							type="button"
							role="option"
							aria-selected={index === activeIndex}
							className={cn(
								"w-full rounded px-3 py-2 text-left text-sm transition-colors",
								index === activeIndex
									? "bg-accent text-accent-foreground"
									: "hover:bg-accent hover:text-accent-foreground",
							)}
							onMouseDown={(event) => event.preventDefault()}
							onMouseEnter={() => setActiveIndex(index)}
							onClick={() => void selectSuggestion(suggestion)}
						>
							<span className="block truncate font-medium">
								{suggestion.mainText}
							</span>
							{suggestion.secondaryText ? (
								<span className="block truncate text-xs text-muted-foreground">
									{suggestion.secondaryText}
								</span>
							) : null}
						</Button>
					))}
				</div>
			) : null}
			{helperText ? (
				<p className="text-[11px] leading-snug text-muted-foreground">
					{helperText}
				</p>
			) : null}
		</div>
	);
}

function getPlacePredictions(
	placesApi: PlacesApiState,
	request: AutocompleteRequestLike,
) {
	return new Promise<{ predictions: PlacePredictionLike[]; status: string }>(
		(resolve, reject) => {
			try {
				void placesApi.autocomplete.getPlacePredictions(
					request,
					(predictions, status) => {
						resolve({ predictions: predictions ?? [], status });
					},
				);
			} catch (error) {
				reject(error);
			}
		},
	);
}
