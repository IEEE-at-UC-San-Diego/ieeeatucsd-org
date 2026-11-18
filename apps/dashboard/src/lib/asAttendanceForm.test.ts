import { describe, expect, it } from "vitest";
import { buildAsAttendanceFormUrl } from "./asAttendanceForm";

const EVENT =
	"Institute of Electrical and Electronics Engineers (IEEE) - VolIEEEball";

function paramsOf(url: string): URLSearchParams {
	return new URL(url).searchParams;
}

describe("buildAsAttendanceFormUrl", () => {
	it("encodes email, class year, membership, event, and food", () => {
		const url = buildAsAttendanceFormUrl({
			email: "ddxu@ucsd.edu",
			graduationYear: 2029,
			eventName: "VolIEEEball",
			foodVendor: "Santorini Cafe",
		});

		expect(url.startsWith("https://docs.google.com/forms/d/e/")).toBe(true);
		expect(url).toContain("emailAddress=ddxu%40ucsd.edu");
		expect(url).toContain("entry.1687560837=Class+of+%2729");
		expect(url).toContain("entry.1851239463=Member");
		expect(url).toContain(
			"entry.219446721=Institute+of+Electrical+and+Electronics+Engineers+%28IEEE%29+-+VolIEEEball",
		);
		expect(url).toContain("entry.570464428=Santorini+Cafe");

		const params = paramsOf(url);
		expect(params.get("emailAddress")).toBe("ddxu@ucsd.edu");
		expect(params.get("entry.1687560837")).toBe("Class of '29");
		expect(params.get("entry.1851239463")).toBe("Member");
		expect(params.get("entry.219446721")).toBe(EVENT);
		expect(params.get("entry.570464428")).toBe("Santorini Cafe");
	});

	it("uses the form's own class-year strings, including the 2027 apostrophe", () => {
		expect(
			paramsOf(buildAsAttendanceFormUrl({ graduationYear: 2027 })).get(
				"entry.1687560837",
			),
		).toBe("Class of \u201827");
		expect(
			paramsOf(buildAsAttendanceFormUrl({ graduationYear: 2028 })).get(
				"entry.1687560837",
			),
		).toBe("Class of '28");
		expect(
			paramsOf(buildAsAttendanceFormUrl({ graduationYear: 2030 })).get(
				"entry.1687560837",
			),
		).toBe("Class of '30");
	});

	it("leaves out params whose values are missing", () => {
		const params = paramsOf(
			buildAsAttendanceFormUrl({
				email: "  ",
				graduationYear: 2031,
				eventName: "",
				foodVendor: null,
			}),
		);

		expect(params.get("emailAddress")).toBeNull();
		expect(params.get("entry.1687560837")).toBeNull();
		expect(params.get("entry.219446721")).toBeNull();
		expect(params.get("entry.570464428")).toBeNull();
		expect(params.get("entry.1851239463")).toBe("Member");
		expect([...params.keys()]).toEqual(["entry.1851239463"]);
	});

	it("trims the event name before building the club option", () => {
		const params = paramsOf(buildAsAttendanceFormUrl({ eventName: "  GBM  " }));
		expect(params.get("entry.219446721")).toBe(
			"Institute of Electrical and Electronics Engineers (IEEE) - GBM",
		);
	});
});
