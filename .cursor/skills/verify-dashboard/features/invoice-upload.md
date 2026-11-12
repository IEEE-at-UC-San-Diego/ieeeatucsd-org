# Invoice upload

Invoice upload attaches a PDF or image to an event request on the funding step and stores the Convex storage id on that invoice.

## Sub-features

- `invoice-drop-unlabeled` attaches a PDF whose browser type is empty.
- `invoice-typed` attaches a PDF the browser already labels `application/pdf`.
- `invoice-too-big` rejects a file over 10MB before requesting an upload URL.
- `invoice-no-url` shows the upload error when the upload URL cannot be issued, and does not attach a file.

## How to get to it (user POV)

- Open Manage Events, choose New Event Request, accept the requirements, and continue through Basic Info, Logistics, and Marketing to Funding.
- On Funding, under Invoices, use Upload Invoice or drop a file on the invoice area.

## Driving it with verify-dashboard

Preconditions:

- Doctor exits 0.
- The officer can open `/manage-events`.
- `IEEE_DEV_OFFICER_JSON` is set when Google sign-in is unavailable.
- `PUPPETEER_CORE` points at `puppeteer-core.js`, or puppeteer-core is installed under the scratch prefix in the skill.

- **Reach Funding.** Run `node .cursor/skills/verify-dashboard/drive-invoice-upload.mjs`. It chooses New Event Request, checks the label that starts `I have read the requirements`, fills event name `Invoice PDF Social`, description, event type Social, location `Price Center`, and event code `INV42`, then continues to the step whose text includes `Upload an invoice to get started`.
- **Drop an unlabeled PDF.** The script builds `invoice.pdf` with `type: ""` and dispatches a drop on the fieldset around the input named `Upload invoice file`. The constructed type in the JSON report is an empty string.
- **See the file attach.** The funding step shows `Invoice file attached`. The storage POST returns 200 and a body with `storageId`.
- **Headless lock.** Run `pnpm --dir apps/dashboard exec vitest run src/components/manage-events/wizard/invoicePdfUpload.test.tsx`. The unlabeled case, the typed PDF, the 10MB refusal, and the missing upload URL all pass.

## Gotchas

- Choosing a `.pdf` through the file input sets `application/pdf`, so that path does not reproduce an empty type. Use the drop.
- An empty `Content-Type` makes Convex storage return 400 `{"code":"BadHeader","message":"Bad header for content-type: invalid HTTP header"}`. The UI then says `Failed to upload file. Check your connection and try again.` and leaves the invoice without a file.
- When AI is off, a successful upload still shows `AI is disabled for this account` and also `Invoice file attached`. The AI sentence is not the upload failure.
- The invoice list is controlled by the wizard. The attached banner appears only after the parent stores `invoiceFile`.
- Room-booking files on the logistics step use the same content-type helper. This map does not drive that control.
