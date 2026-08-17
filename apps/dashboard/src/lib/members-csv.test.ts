import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildMembersCsv,
	downloadMembersCsv,
	escapeCsvField,
	formatCsvDate,
	MEMBER_CSV_HEADERS,
	type MemberCsvSource,
	membersCsvFilename,
} from "./members-csv";

function member(overrides: Partial<MemberCsvSource> = {}): MemberCsvSource {
	return {
		name: "Ada Lovelace",
		email: "ada@ucsd.edu",
		role: "Member",
		status: "active",
		joinDate: Date.UTC(2024, 8, 15),
		signedUp: true,
		...overrides,
	};
}

describe("escapeCsvField", () => {
	it("leaves plain values unquoted", () => {
		expect(escapeCsvField("Member")).toBe("Member");
	});

	it("quotes commas, quotes, and newlines", () => {
		expect(escapeCsvField("Doe, Jane")).toBe('"Doe, Jane"');
		expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
		expect(escapeCsvField("line\nbreak")).toBe('"line\nbreak"');
	});

	it("quotes standalone carriage returns so rows do not split", () => {
		expect(escapeCsvField("line\rbreak")).toBe('"line\rbreak"');
	});

	it("neutralizes spreadsheet formula prefixes", () => {
		expect(escapeCsvField("=1+1")).toBe("'=1+1");
		expect(escapeCsvField("@foo")).toBe("'@foo");
		expect(escapeCsvField("+cmd")).toBe("'+cmd");
		expect(escapeCsvField("-2+2")).toBe("'-2+2");
	});

	it("neutralizes formula prefixes after leading whitespace or control characters", () => {
		expect(escapeCsvField(" =1+1")).toBe("'=1+1");
		expect(escapeCsvField("\t@foo")).toBe("'@foo");
	});
});

describe("formatCsvDate", () => {
	it("formats timestamps as YYYY-MM-DD and blanks missing values", () => {
		expect(formatCsvDate(undefined)).toBe("");
		expect(formatCsvDate(new Date(2026, 0, 5).getTime())).toBe("2026-01-05");
	});
});

describe("membersCsvFilename", () => {
	it("uses the ieee-members-YYYY-MM-DD.csv pattern", () => {
		expect(membersCsvFilename(new Date(2026, 7, 17))).toBe(
			"ieee-members-2026-08-17.csv",
		);
	});
});

describe("buildMembersCsv", () => {
	it("emits a header row plus one row per member", () => {
		const csv = buildMembersCsv([
			member({ name: "Ada Lovelace" }),
			member({
				name: "Grace Hopper",
				email: "grace@ucsd.edu",
				role: "Sponsor",
				status: "inactive",
				sponsorTier: "Gold",
				sponsorOrganization: "Acme",
			}),
		]);
		const lines = csv.split("\n");

		expect(lines[0]).toBe(MEMBER_CSV_HEADERS.join(","));
		expect(lines).toHaveLength(3);
		expect(lines[1]).toContain("Ada Lovelace");
		expect(lines[2]).toContain("Grace Hopper");
		expect(lines[2]).toContain("inactive");
		expect(lines[2]).toContain("Sponsor");
		expect(lines[2]).toContain("Gold");
	});

	it("exports the manage-users roster fields and omits extra PII keys", () => {
		const csv = buildMembersCsv([
			member({
				position: "Treasurer",
				team: "Internal",
				pid: "A12345678",
				memberId: "IEEE-99",
				major: "Computer Engineering",
				graduationYear: 2027,
				points: 12,
				eventsAttended: 4,
				lastLogin: Date.UTC(2026, 7, 1),
				ieeeEmail: "ada@ieeeatucsd.org",
				hasIEEEEmail: true,
				ieeeEmailCreatedAt: Date.UTC(2025, 9, 2),
			}),
		]);

		expect(csv).toContain("Name,Email,Role,Position,Team,Status,PID,Member ID");
		expect(csv).toContain("Treasurer");
		expect(csv).toContain("Internal");
		expect(csv).toContain("A12345678");
		expect(csv).toContain("IEEE-99");
		expect(csv).toContain("Computer Engineering");
		expect(csv).toContain("2027");
		expect(csv).toContain("ada@ieeeatucsd.org");
		expect(csv).not.toContain("zelle");
		expect(csv).not.toContain("logtoId");
		expect(csv).not.toContain("authUserId");
	});

	it("keeps a carriage return inside a quoted field instead of splitting the row", () => {
		const csv = buildMembersCsv([member({ name: "Ada\rLovelace" })]);
		const lines = csv.split("\n");

		expect(lines).toHaveLength(2);
		expect(lines[1]).toContain('"Ada\rLovelace"');
	});

	it("does not emit formula-leading names as live spreadsheet formulas", () => {
		const csv = buildMembersCsv([
			member({ name: "=1+1" }),
			member({ name: "@foo", email: "foo@ucsd.edu" }),
			member({ name: " =1+1", email: "space@ucsd.edu" }),
			member({ name: "\t@foo", email: "tab@ucsd.edu" }),
		]);
		const nameFields = csv
			.split("\n")
			.slice(1)
			.map((row) => row.split(",")[0]);

		expect(nameFields).toEqual(["'=1+1", "'@foo", "'=1+1", "'@foo"]);
		for (const nameField of nameFields) {
			expect(nameField).toBeDefined();
			expect(nameField?.startsWith("=")).toBe(false);
			expect(nameField?.startsWith("@")).toBe(false);
			expect(nameField?.startsWith("+")).toBe(false);
			expect(nameField?.startsWith("-")).toBe(false);
			expect(nameField?.startsWith(" ")).toBe(false);
			expect(nameField?.startsWith("\t")).toBe(false);
		}
	});

	it("leaves optional fields empty instead of inventing values", () => {
		const csv = buildMembersCsv([
			member({
				position: undefined,
				team: undefined,
				pid: undefined,
				points: undefined,
				lastLogin: undefined,
				hasIEEEEmail: undefined,
			}),
		]);
		const dataRow = csv.split("\n")[1];
		expect(dataRow).toBeDefined();
		expect(dataRow?.split(",")[3]).toBe("");
		expect(dataRow?.split(",")[10]).toBe("");
	});
});

describe("downloadMembersCsv", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("triggers a CSV file download", () => {
		const click = vi.fn();
		const link = {
			setAttribute: vi.fn(),
			style: { visibility: "" },
			click,
		};
		const appendChild = vi.fn();
		const removeChild = vi.fn();
		const createElement = vi.fn(() => link);
		const createObjectURL = vi.fn(() => "blob:members");
		const revokeObjectURL = vi.fn();

		vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

		downloadMembersCsv("Name\nAda", "ieee-members-2026-08-17.csv", {
			createElement,
			body: { appendChild, removeChild },
		} as unknown as Document);

		expect(createElement).toHaveBeenCalledWith("a");
		expect(link.setAttribute).toHaveBeenCalledWith(
			"download",
			"ieee-members-2026-08-17.csv",
		);
		expect(click).toHaveBeenCalledOnce();
		expect(appendChild).toHaveBeenCalledWith(link);
		expect(removeChild).toHaveBeenCalledWith(link);
		expect(revokeObjectURL).toHaveBeenCalledWith("blob:members");
	});
});
