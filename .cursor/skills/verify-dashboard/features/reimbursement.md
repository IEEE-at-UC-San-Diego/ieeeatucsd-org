# Reimbursement submit

An officer submits a reimbursement with a business purpose and at least one receipt line item. The request is stored and shown on the officer detail page and the admin review page.

## Sub-features

- `submit-request` walks Report Details, Expenses, and Review, then calls `reimbursements:create`.
- `officer-detail` shows the stored business purpose and line items.
- `admin-review` shows the same purpose on `/manage-reimbursements`.

## How to get to it (user POV)

- Open `http://localhost:3000/reimbursement`.
- Choose **New Request**.
- Continue in manual mode when AI parsing is off.
- Fill title, department, payment method, and business purpose, then **Next: Expenses**.
- Upload a receipt, enter a vendor and a line item, then **Review & Submit** and **Submit Request**.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- The signed-in officer already exists with `signedUp` true, `status` `active`, and an officer role. Set `aiFeaturesEnabled` to false so the receipt step stays manual.
- The deployed `reimbursements:create` args include `businessPurpose`. A deployment from before commit `44e8e5a2` rejects that field.

- **Submit.** Open `/reimbursement`, choose **New Request**, then **Continue in Manual Mode**. The department control id ends in `-department` and the payment control id ends in `-paymentMethod`. Choose the option text `Events` and `Zelle`, not the sidebar link named Events. Upload `input[name='receiptFile']`, then fill `input[name='vendorName']`, `Line Item 1 Description`, and `Line Item 1 Amount`.
- **Proof.** The success toast says `Reimbursement request submitted!`. The detail page text includes `Business Purpose` and the line item. The admin page at `/manage-reimbursements` shows the same purpose after opening the request title. Read the stored row from a Convex export of `reimbursements/documents.jsonl`. A screenshot of the review step alone does not prove the write.

## Gotchas

- The sidebar link `Events` matches before the department option. Choose `[role='option']` with the exact label.
- A receipt expense cannot advance until a file is uploaded and the total is greater than zero.
- Convex returns the validation error over its websocket. The toast includes the whole argument object, so crop it to the `ArgumentValidationError` line before saving a screenshot.
- `ghcr.io/get-convex/convex-backend` is denied. `pnpm dev:convex` uses `ghcr.io/convex/convex-backend`.
