import * as React from "react";

/**
 * Returns the offset (px) from the layout viewport bottom to the visual
 * viewport bottom — typically the software keyboard overlap on mobile.
 */
export function useVisualViewportBottom() {
	const [bottomInset, setBottomInset] = React.useState(0);

	React.useEffect(() => {
		const vv = window.visualViewport;
		if (!vv) return;

		const update = () => {
			const inset = Math.max(
				0,
				window.innerHeight - (vv.height + vv.offsetTop),
			);
			setBottomInset(Math.round(inset));
		};

		update();
		vv.addEventListener("resize", update);
		vv.addEventListener("scroll", update);
		window.addEventListener("resize", update);

		return () => {
			vv.removeEventListener("resize", update);
			vv.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
		};
	}, []);

	return bottomInset;
}
