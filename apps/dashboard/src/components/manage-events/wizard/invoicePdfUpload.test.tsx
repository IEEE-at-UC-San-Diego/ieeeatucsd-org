/**
 * @vitest-environment jsdom
 */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "@/components/dashboard/ConfirmDialog";
import type { Invoice } from "../types";
import { FundingSection } from "./FundingSection";

const PDF_BYTES = new Uint8Array([
	0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
]);
const STORAGE_ID = "kg2invoicepdf00000000000000001";

function fileList(files: File[]): FileList {
	const list: Record<number | string, unknown> = {
		length: files.length,
		item: (index: number) => files[index] ?? null,
		[Symbol.iterator]: function* iterator() {
			yield* files;
		},
	};
	files.forEach((file, index) => {
		list[index] = file;
	});
	return list as unknown as FileList;
}

function contentTypeOf(headers: HeadersInit | undefined): string {
	if (!headers) return "";
	if (headers instanceof Headers) return headers.get("content-type") ?? "";
	if (Array.isArray(headers)) {
		const found = headers.find(
			([name]) => name.toLowerCase() === "content-type",
		);
		return found?.[1] ?? "";
	}
	const record = headers as Record<string, string>;
	return record["Content-Type"] ?? record["content-type"] ?? "";
}

function installStorage() {
	const seen: string[] = [];
	const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
		const contentType = contentTypeOf(init?.headers);
		seen.push(contentType);
		if (contentType.trim() === "") {
			return new Response(
				JSON.stringify({
					code: "BadHeader",
					message: "Bad header for content-type: invalid HTTP header",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}
		return new Response(JSON.stringify({ storageId: STORAGE_ID }), {
			status: 200,
			headers: { "Content-Type": "application/json" },
		});
	});
	vi.stubGlobal("fetch", fetchMock);
	return { seen, fetchMock };
}

function renderInvoices(generateUploadUrl: () => Promise<string>) {
	const onChange = vi.fn();
	function Harness() {
		const [invoices, setInvoices] = useState<Invoice[]>([]);
		return (
			<FundingSection
				aiEnabled={false}
				data={{
					needsASFunding: false,
					asFundingRequired: false,
					invoices,
				}}
				onChange={(patch) => {
					onChange(patch);
					if (patch.invoices) setInvoices(patch.invoices);
				}}
				generateUploadUrl={generateUploadUrl}
			/>
		);
	}
	render(
		<ConfirmProvider>
			<Harness />
		</ConfirmProvider>,
	);
	return { onChange };
}

describe("invoice PDF upload", () => {
	afterEach(() => {
		cleanup();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("attaches a PDF the browser left unlabeled and stores its id", async () => {
		const { seen } = installStorage();
		const generateUploadUrl = vi.fn(
			async () => "http://127.0.0.1:3210/api/storage/upload?token=t",
		);
		const { onChange } = renderInvoices(generateUploadUrl);
		const file = new File([PDF_BYTES], "invoice.pdf", { type: "" });

		fireEvent.change(screen.getByLabelText("Upload invoice file"), {
			target: { files: fileList([file]) },
		});

		expect(await screen.findByText(/Invoice file attached/)).toBeTruthy();
		expect(screen.queryByText(/Failed to upload file/)).toBeNull();
		expect(seen).toEqual(["application/pdf"]);
		expect(generateUploadUrl).toHaveBeenCalledTimes(1);
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				invoices: [expect.objectContaining({ invoiceFile: STORAGE_ID })],
			}),
		);
	});

	it("keeps a declared PDF content type", async () => {
		const { seen } = installStorage();
		const { onChange } = renderInvoices(
			async () => "http://127.0.0.1:3210/upload",
		);
		fireEvent.change(screen.getByLabelText("Upload invoice file"), {
			target: {
				files: fileList([
					new File([PDF_BYTES], "invoice.pdf", { type: "application/pdf" }),
				]),
			},
		});
		expect(await screen.findByText(/Invoice file attached/)).toBeTruthy();
		expect(seen).toEqual(["application/pdf"]);
		expect(onChange).toHaveBeenCalledWith(
			expect.objectContaining({
				invoices: [expect.objectContaining({ invoiceFile: STORAGE_ID })],
			}),
		);
	});

	it("refuses a file over 10MB before asking for an upload URL", async () => {
		const { fetchMock } = installStorage();
		const generateUploadUrl = vi.fn(async () => "http://127.0.0.1:3210/upload");
		const { onChange } = renderInvoices(generateUploadUrl);
		const huge = new File([PDF_BYTES], "huge.pdf", { type: "application/pdf" });
		Object.defineProperty(huge, "size", { value: 10 * 1024 * 1024 + 1 });
		fireEvent.change(screen.getByLabelText("Upload invoice file"), {
			target: { files: fileList([huge]) },
		});
		expect(await screen.findByText(/too large/i)).toBeTruthy();
		expect(generateUploadUrl).not.toHaveBeenCalled();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(onChange).not.toHaveBeenCalled();
	});

	it("shows the upload error when the upload URL cannot be issued", async () => {
		installStorage();
		const { onChange } = renderInvoices(async () => {
			throw new Error("User not found in database");
		});
		fireEvent.change(screen.getByLabelText("Upload invoice file"), {
			target: {
				files: fileList([
					new File([PDF_BYTES], "invoice.pdf", { type: "application/pdf" }),
				]),
			},
		});
		expect(
			await screen.findByText(
				"Failed to upload file. Check your connection and try again.",
			),
		).toBeTruthy();
		expect(screen.queryByText(/Invoice file attached/)).toBeNull();
		expect(onChange).not.toHaveBeenCalled();
	});
});
