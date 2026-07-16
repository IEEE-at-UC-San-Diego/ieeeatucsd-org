import * as React from "react";

function readOnline() {
	if (typeof navigator === "undefined") return true;
	return navigator.onLine;
}

/**
 * Tracks browser online/offline. Useful for installed/standalone mode where
 * network drops must not leave routes on indefinite skeletons.
 */
export function useOnlineStatus() {
	const [isOnline, setIsOnline] = React.useState(readOnline);

	React.useEffect(() => {
		const onOnline = () => setIsOnline(true);
		const onOffline = () => setIsOnline(false);
		window.addEventListener("online", onOnline);
		window.addEventListener("offline", onOffline);
		setIsOnline(readOnline());
		return () => {
			window.removeEventListener("online", onOnline);
			window.removeEventListener("offline", onOffline);
		};
	}, []);

	return isOnline;
}
