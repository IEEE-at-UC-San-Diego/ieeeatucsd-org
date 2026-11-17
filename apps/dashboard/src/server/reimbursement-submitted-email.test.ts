import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./email", () => ({
	sendEmail: vi.fn(async () => ({})),
}));

import { sendEmail } from "./email";
import { sendReimbursementSubmitted } from "./notifications";

const purpose = "Presenting the chapter poster at the IEEE conference";

describe("sendReimbursementSubmitted", () => {
	beforeEach(() => {
		vi.mocked(sendEmail).mockClear();
	});

	it("includes the business purpose in the treasurer and submitter mail", async () => {
		await sendReimbursementSubmitted({
			reimbursementId: "reimb_1",
			title: "Conference flight",
			totalAmount: 120,
			department: "events",
			paymentMethod: "Zelle",
			businessPurpose: purpose,
			submitterName: "Ada",
			submitterEmail: "ada@ucsd.edu",
		});

		const htmls = vi.mocked(sendEmail).mock.calls.map((call) => call[0].html);
		expect(htmls).toHaveLength(2);
		for (const html of htmls) {
			expect(html).toContain("Business Purpose");
			expect(html).toContain(purpose);
		}
	});
});
