/**
 * @vitest-environment jsdom
 */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CheckInModal } from "./CheckInModal";

vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}));

afterEach(() => {
	cleanup();
});

const formUrl =
	"https://docs.google.com/forms/d/e/example/viewform?entry.1851239463=Member";

describe("CheckInModal attendance form", () => {
	it("hides the attendance form until check-in succeeds", () => {
		const { rerender } = render(
			<CheckInModal
				isOpen
				onClose={() => {}}
				onSubmit={() => {}}
				eventHasFood={false}
				eventName="VolIEEEball"
			/>,
		);

		expect(
			screen.queryByRole("link", { name: "A.S. attendance form" }),
		).toBeNull();

		rerender(
			<CheckInModal
				isOpen
				onClose={() => {}}
				onSubmit={() => {}}
				eventHasFood={false}
				eventName="VolIEEEball"
				checkInSuccess={{ points: 5, attendanceFormUrl: formUrl }}
			/>,
		);

		const link = screen.getByRole("link", { name: "A.S. attendance form" });
		expect(link.getAttribute("href")).toBe(formUrl);
		expect(link.getAttribute("target")).toBe("_blank");
	});
});
