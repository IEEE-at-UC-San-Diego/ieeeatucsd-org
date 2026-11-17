import { describe, expect, it } from "vitest";
import { create } from "./reimbursements";
import schema from "./schema";

const CLIENT_CREATE_FIELDS = [
  "additionalInfo",
  "authToken",
  "businessPurpose",
  "dateOfPurchase",
  "department",
  "logtoId",
  "paymentMethod",
  "receipts",
  "title",
  "totalAmount",
] as const;

type ObjectValidatorJson = {
  type: string;
  value: Record<
    string,
    {
      fieldType: { type: string };
      optional: boolean;
    }
  >;
};

function objectFields(json: ObjectValidatorJson) {
  expect(json.type).toBe("object");
  return json.value;
}

describe("reimbursements.create args", () => {
  it("accepts the business purpose the dashboard submits", () => {
    const exportArgs = (create as { exportArgs?: () => string }).exportArgs;
    if (!exportArgs) {
      throw new Error("reimbursements.create is missing exportArgs");
    }
    const args = objectFields(JSON.parse(exportArgs()));
    for (const field of CLIENT_CREATE_FIELDS) {
      expect(args, field).toHaveProperty(field);
    }
    expect(args.businessPurpose).toEqual({
      fieldType: { type: "string" },
      optional: true,
    });
  });
});

describe("reimbursements table", () => {
  it("stores businessPurpose and keeps rows that omit it", () => {
    const table = schema.tables.reimbursements as unknown as {
      validator: { json: ObjectValidatorJson };
    };
    const fields = objectFields(table.validator.json);
    expect(fields.businessPurpose).toEqual({
      fieldType: { type: "string" },
      optional: true,
    });
  });
});
