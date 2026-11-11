/**
 * @vitest-environment jsdom
 */

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Outlet,
	RouterProvider,
} from "@tanstack/react-router";
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { type ReactNode, Suspense } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmProvider } from "@/components/dashboard/ConfirmDialog";
import { EventViewModal } from "@/components/manage-events/modals/EventViewModal";
import type { EventRequest } from "@/components/manage-events/types";
import { FundingSection } from "@/components/manage-events/wizard/FundingSection";
import { LogisticsSection } from "@/components/manage-events/wizard/LogisticsSection";
import { Route as ManageRoute } from "@/routes/_dashboard/manage-reimbursements";
import { Route as ReimbursementRoute } from "@/routes/_dashboard/reimbursement";
import { Route as SettingsRoute } from "@/routes/_dashboard/settings";

const { auth, queryResult, navigate } = vi.hoisted(() => ({
	auth: {
		isAuthenticated: true,
		isLoading: false,
		isAuthResolved: true,
		authFailureReason: null,
		hasAdminAccess: true,
		logtoId: "user_1",
		convexSessionToken: null,
		userRole: "Executive Officer",
		user: {
			name: "Ada Lovelace",
			email: "ada@ucsd.edu",
			signedUp: false,
			role: "Officer",
			aiFeaturesEnabled: false,
			status: "active",
		},
		getAuthHeaders: async () => ({}),
	},
	queryResult: { current: undefined as unknown },
	navigate: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
	useAuth: () => auth,
}));

vi.mock("@/hooks/useAuthedConvex", () => ({
	useAuthedQuery: () => queryResult.current,
	useAuthedMutation: () => async () => {
		throw new Error("Authentication required");
	},
}));

vi.mock("sonner", () => ({
	toast: {
		error: vi.fn(),
		success: vi.fn(),
		info: vi.fn(),
	},
}));

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

function pdf(name: string, bytes = 32): File {
	const file = new File([new Uint8Array(Math.min(bytes, 64))], name, {
		type: "application/pdf",
	});
	if (bytes !== file.size) {
		Object.defineProperty(file, "size", { value: bytes });
	}
	return file;
}

function dropFiles(target: Element, files: File[]) {
	fireEvent.drop(target, { dataTransfer: { files: fileList(files) } });
}

function clipboardItems(
	entries: Array<{ kind: string; type: string; file?: File | null }>,
) {
	const items = entries.map((entry) => ({
		kind: entry.kind,
		type: entry.type,
		getAsFile: () => entry.file ?? null,
	}));
	const list: Record<number | string, unknown> = {
		length: items.length,
		item: (index: number) => items[index] ?? null,
		[Symbol.iterator]: function* iterator() {
			yield* items;
		},
	};
	items.forEach((item, index) => {
		list[index] = item;
	});
	return list;
}

function pasteOn(
	target: Element,
	entries: Array<{ kind: string; type: string; file?: File | null }>,
	files: File[] = [],
) {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { items: clipboardItems(entries), files: fileList(files) },
	});
	target.dispatchEvent(event);
	return event;
}

function fileEntry(file: File) {
	return { kind: "file", type: file.type, file };
}

function png(name: string, bytes = 32): File {
	const file = new File([new Uint8Array(Math.min(bytes, 64))], name, {
		type: "image/png",
	});
	if (bytes !== file.size) {
		Object.defineProperty(file, "size", { value: bytes });
	}
	return file;
}

function zoneFor(control: HTMLElement): HTMLElement {
	const zone = control.closest("[data-drag-state]");
	if (!(zone instanceof HTMLElement)) throw new Error("missing drop target");
	return zone;
}

function renderWithConfirm(ui: ReactNode) {
	return render(<ConfirmProvider>{ui}</ConfirmProvider>);
}

async function renderRouted(ui: ReactNode) {
	const rootRoute = createRootRoute({
		component: () => (
			<ConfirmProvider>
				<Outlet />
			</ConfirmProvider>
		),
	});
	const indexRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/",
		component: () => <Suspense fallback={null}>{ui}</Suspense>,
	});
	const router = createRouter({
		routeTree: rootRoute.addChildren([indexRoute]),
		history: createMemoryHistory({ initialEntries: ["/"] }),
	});
	await router.load();
	let view: ReturnType<typeof render> | undefined;
	await act(async () => {
		view = render(<RouterProvider router={router} />);
	});
	if (!view) throw new Error("page did not render");
	return view;
}

beforeEach(() => {
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: 1280,
	});
	HTMLElement.prototype.hasPointerCapture = () => false;
	HTMLElement.prototype.setPointerCapture = () => {};
	HTMLElement.prototype.releasePointerCapture = () => {};
	window.matchMedia = (query: string) =>
		({
			matches: window.innerWidth < 768,
			media: query,
			onchange: null,
			addEventListener: () => {},
			removeEventListener: () => {},
			addListener: () => {},
			removeListener: () => {},
			dispatchEvent: () => false,
		}) as unknown as MediaQueryList;
});

afterEach(() => {
	cleanup();
	queryResult.current = undefined;
	sessionStorage.clear();
	vi.restoreAllMocks();
});

describe("invoice drop", () => {
	function renderInvoices() {
		const onChange = vi.fn();
		const generateUploadUrl = vi.fn(async () => {
			throw new Error("storage down");
		});
		renderWithConfirm(
			<FundingSection
				aiEnabled={false}
				data={{
					needsASFunding: false,
					asFundingRequired: false,
					invoices: [],
				}}
				onChange={onChange}
				generateUploadUrl={generateUploadUrl}
			/>,
		);
		return { onChange, generateUploadUrl };
	}

	it("shares type, size, and count checks between the picker and the drop target", async () => {
		const { generateUploadUrl } = renderInvoices();
		const input = screen.getByLabelText("Upload invoice file");
		input.focus();
		expect(document.activeElement).toBe(input);

		fireEvent.click(screen.getByRole("button", { name: /Upload Invoice/ }));
		const empty = screen.getByRole("button", {
			name: /Upload an invoice to get started/,
		});
		const zone = zoneFor(empty);

		dropFiles(zone, [pdf("a.pdf"), pdf("b.pdf")]);
		expect(
			await screen.findByText(
				"Drop one file. These were not added: a.pdf, b.pdf.",
			),
		).toBeTruthy();
		expect(generateUploadUrl).not.toHaveBeenCalled();

		dropFiles(zone, [new File(["hi"], "notes.txt", { type: "text/plain" })]);
		expect(
			await screen.findByText(
				"notes.txt: Unsupported file type. Use PDF, JPG, PNG, GIF, or WebP.",
			),
		).toBeTruthy();

		const huge = pdf("huge.pdf", 10 * 1024 * 1024 + 1);
		dropFiles(zone, [huge]);
		await waitFor(() => {
			const text = document.body.textContent ?? "";
			if (!text.includes("too large")) {
				throw new Error(`size=${huge.size} tail=${text.slice(-500)}`);
			}
		});

		fireEvent.change(input, {
			target: { files: fileList([pdf("invoice.pdf")]) },
		});
		expect(
			await screen.findByText(
				"Failed to upload file. Check your connection and try again.",
			),
		).toBeTruthy();
		expect(generateUploadUrl).toHaveBeenCalledTimes(1);

		fireEvent.change(input, {
			target: { files: fileList([pdf("retry.pdf")]) },
		});
		await waitFor(() => expect(generateUploadUrl).toHaveBeenCalledTimes(2));
	});

	it("ignores a second drop while the upload is still pending", async () => {
		let release: (() => void) | undefined;
		const generateUploadUrl = vi.fn(
			() =>
				new Promise<string>((resolve) => {
					release = () => resolve("http://127.0.0.1:9/upload");
				}),
		);
		renderWithConfirm(
			<FundingSection
				aiEnabled={false}
				data={{
					needsASFunding: false,
					asFundingRequired: false,
					invoices: [],
				}}
				onChange={vi.fn()}
				generateUploadUrl={generateUploadUrl}
			/>,
		);
		const zone = zoneFor(screen.getByLabelText("Upload invoice file"));
		dropFiles(zone, [pdf("one.pdf")]);
		dropFiles(zone, [pdf("two.pdf")]);
		await waitFor(() => expect(generateUploadUrl).toHaveBeenCalledTimes(1));
		pasteOn(zone, [fileEntry(png("shot.png"))]);
		expect(generateUploadUrl).toHaveBeenCalledTimes(1);
		release?.();
		await waitFor(() => expect(screen.queryByText("Uploading…")).toBeNull());
		pasteOn(zone, [fileEntry(png("retry.png"))]);
		await waitFor(() => expect(generateUploadUrl).toHaveBeenCalledTimes(2));
	});

	it("pastes an image through the same checks as the picker", async () => {
		const { generateUploadUrl } = renderInvoices();
		expect(screen.getByText(/Paste with Cmd/)).toBeTruthy();
		expect(screen.getByText(/Ctrl/)).toBeTruthy();
		const empty = screen.getByRole("button", {
			name: /Upload an invoice to get started/,
		});
		const zone = zoneFor(empty);
		zone.focus();
		expect(document.activeElement).toBe(zone);
		expect(zone.className).toContain("focus-within:ring-2");

		const textOnly = pasteOn(zone, [{ kind: "string", type: "text/plain" }]);
		expect(textOnly.defaultPrevented).toBe(false);
		expect(generateUploadUrl).not.toHaveBeenCalled();

		pasteOn(zone, [
			{ kind: "string", type: "text/plain" },
			fileEntry(png("a.png")),
			fileEntry(png("b.png")),
		]);
		expect(
			await screen.findByText(
				"Drop one file. These were not added: a.png, b.png.",
			),
		).toBeTruthy();
		expect(generateUploadUrl).not.toHaveBeenCalled();

		const unnamed = new File([new Uint8Array([1])], "", { type: "image/bmp" });
		pasteOn(zone, [{ kind: "file", type: "image/bmp", file: unnamed }]);
		expect(
			await screen.findByText(/Pasted image 1\.bmp: Unsupported file type/),
		).toBeTruthy();

		pasteOn(zone, [fileEntry(png("huge.png", 10 * 1024 * 1024 + 1))]);
		expect(await screen.findByText(/huge\.png: File too large/)).toBeTruthy();
		expect(generateUploadUrl).not.toHaveBeenCalled();

		pasteOn(zone, [fileEntry(png("invoice.png"))]);
		expect(
			await screen.findByText(
				"Failed to upload file. Check your connection and try again.",
			),
		).toBeTruthy();
		expect(generateUploadUrl).toHaveBeenCalledTimes(1);

		fireEvent.click(screen.getByRole("button", { name: /Upload Invoice/ }));
		dropFiles(zone, [pdf("still-drops.pdf")]);
		await waitFor(() => expect(generateUploadUrl).toHaveBeenCalledTimes(2));
	});

	it("does not take a paste from the vendor field", async () => {
		const generateUploadUrl = vi.fn(async () => "http://127.0.0.1:9/upload");
		renderWithConfirm(
			<FundingSection
				aiEnabled={false}
				data={{
					needsASFunding: false,
					asFundingRequired: false,
					invoices: [
						{
							_id: "inv_1",
							vendor: "Campus cafe",
							items: [],
							tax: 0,
							tip: 0,
							additionalFiles: [],
							subtotal: 0,
							total: 0,
							amount: 0,
							description: "",
						},
					],
				}}
				onChange={vi.fn()}
				generateUploadUrl={generateUploadUrl}
			/>,
		);
		expect(screen.getByText(/Paste with Cmd/)).toBeTruthy();
		const vendor = screen.getByLabelText("Vendor");
		vendor.focus();
		const pasted = pasteOn(vendor, [fileEntry(png("shot.png"))]);
		expect(pasted.defaultPrevented).toBe(false);
		expect((vendor as HTMLInputElement).value).toBe("Campus cafe");
		expect(generateUploadUrl).not.toHaveBeenCalled();
		expect(
			screen.queryByRole("button", {
				name: /Upload an invoice to get started/,
			}),
		).toBeNull();
	});
});

describe("room booking drop", () => {
	it("keeps the valid files, names the rejects, and ignores a drop while pending", async () => {
		let release: (() => void) | undefined;
		const onUploadRoomBooking = vi.fn(
			(_files: File[]) =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		renderWithConfirm(
			<LogisticsSection
				data={{
					location: "Price Center",
					startDate: Date.now(),
					endDate: Date.now() + 3_600_000,
					eventCode: "WS",
					pointsToReward: 1,
					hasFood: false,
					willOrHaveRoomBooking: true,
					roomBookingFiles: [],
					foodDrinksBeingServed: false,
				}}
				onChange={vi.fn()}
				onUploadRoomBooking={onUploadRoomBooking}
			/>,
		);
		const input = screen.getByLabelText("Room booking files");
		input.focus();
		expect(document.activeElement).toBe(input);
		const zone = zoneFor(input);
		dropFiles(zone, [
			pdf("room.pdf"),
			new File(["x"], "notes.txt", { type: "text/plain" }),
		]);
		expect(
			await screen.findByText(
				"notes.txt: Use a PDF, JPG, PNG, DOC, or DOCX file.",
			),
		).toBeTruthy();
		await waitFor(() => expect(onUploadRoomBooking).toHaveBeenCalledTimes(1));
		expect(onUploadRoomBooking.mock.calls[0]?.[0]).toHaveLength(1);
		dropFiles(zone, [pdf("other.pdf")]);
		expect(onUploadRoomBooking).toHaveBeenCalledTimes(1);
		release?.();
		await waitFor(() =>
			expect(screen.queryByText("Uploading room booking files…")).toBeNull(),
		);
		dropFiles(zone, [pdf("again.pdf")]);
		await waitFor(() => expect(onUploadRoomBooking).toHaveBeenCalledTimes(2));
	});

	it("pastes images through the room booking control", async () => {
		let release: (() => void) | undefined;
		const onUploadRoomBooking = vi.fn(
			(_files: File[]) =>
				new Promise<void>((resolve) => {
					release = resolve;
				}),
		);
		renderWithConfirm(
			<LogisticsSection
				data={{
					location: "Price Center",
					startDate: Date.now(),
					endDate: Date.now() + 3_600_000,
					eventCode: "WS",
					pointsToReward: 1,
					hasFood: false,
					willOrHaveRoomBooking: true,
					roomBookingFiles: [],
					foodDrinksBeingServed: false,
				}}
				onChange={vi.fn()}
				onUploadRoomBooking={onUploadRoomBooking}
			/>,
		);
		expect(screen.getByText(/Paste with Cmd/)).toBeTruthy();
		const input = screen.getByLabelText("Room booking files");
		const zone = zoneFor(input);
		zone.focus();
		expect(document.activeElement).toBe(zone);
		expect(zone.className).toContain("focus-within:ring-2");

		const textOnly = pasteOn(input, [{ kind: "string", type: "text/plain" }]);
		expect(textOnly.defaultPrevented).toBe(false);
		expect(onUploadRoomBooking).not.toHaveBeenCalled();

		pasteOn(zone, [
			fileEntry(new File(["g"], "shot.gif", { type: "image/gif" })),
		]);
		expect(
			await screen.findByText(
				"shot.gif: Use a PDF, JPG, PNG, DOC, or DOCX file.",
			),
		).toBeTruthy();
		expect(onUploadRoomBooking).not.toHaveBeenCalled();

		const location = screen.getByLabelText(/Location/);
		location.focus();
		const inField = pasteOn(location, [fileEntry(png("shot.png"))]);
		expect(inField.defaultPrevented).toBe(false);
		expect(onUploadRoomBooking).not.toHaveBeenCalled();

		pasteOn(zone, [
			{ kind: "string", type: "text/plain" },
			fileEntry(png("room.png")),
			fileEntry(new File(["x"], "notes.txt", { type: "text/plain" })),
		]);
		expect(
			await screen.findByText(
				"notes.txt: Use a PDF, JPG, PNG, DOC, or DOCX file.",
			),
		).toBeTruthy();
		await waitFor(() => expect(onUploadRoomBooking).toHaveBeenCalledTimes(1));
		expect(onUploadRoomBooking.mock.calls[0]?.[0]).toHaveLength(1);

		pasteOn(zone, [fileEntry(png("other.png"))]);
		expect(onUploadRoomBooking).toHaveBeenCalledTimes(1);
		release?.();
		await waitFor(() =>
			expect(screen.queryByText("Uploading room booking files…")).toBeNull(),
		);
		pasteOn(zone, [fileEntry(png("again.png"))]);
		await waitFor(() => expect(onUploadRoomBooking).toHaveBeenCalledTimes(2));
		release?.();
		await waitFor(() =>
			expect(screen.queryByText("Uploading room booking files…")).toBeNull(),
		);

		fireEvent.click(input);
		dropFiles(zone, [pdf("dropped.pdf")]);
		await waitFor(() => expect(onUploadRoomBooking).toHaveBeenCalledTimes(3));
	});
});

describe("graphics drop", () => {
	const event = {
		_id: "event_1",
		_creationTime: 1,
		eventName: "Workshop",
		eventDescription: "Soldering night",
		eventType: "technical",
		location: "Room 101",
		startDate: 1,
		endDate: 2,
		eventCode: "WS",
		pointsToReward: 1,
		hasFood: false,
		needsFlyers: false,
		needsGraphics: true,
		needsASFunding: false,
		estimatedAttendance: 12,
		status: "approved",
		files: [],
		invoices: [],
		createdBy: "Ada",
	} as EventRequest;

	it("rejects a bad file before upload and retries after a failed upload", async () => {
		renderWithConfirm(
			<EventViewModal
				isOpen
				onClose={vi.fn()}
				event={event}
				onUpdateGraphics={vi.fn()}
			/>,
		);
		fireEvent.mouseDown(screen.getByRole("tab", { name: "Graphics" }));
		fireEvent.click(screen.getByRole("tab", { name: "Graphics" }));
		const input = await screen.findByLabelText("Upload graphics file");
		input.focus();
		expect(document.activeElement).toBe(input);
		const zone = zoneFor(input);
		expect(screen.queryByText(/Paste with Cmd/)).toBeNull();
		const graphicsPaste = pasteOn(input, [fileEntry(pdf("poster.pdf"))]);
		expect(graphicsPaste.defaultPrevented).toBe(false);
		expect(screen.queryByText(/Upload failed/)).toBeNull();
		dropFiles(zone, [pdf("a.pdf"), pdf("b.pdf")]);
		expect(
			await screen.findByText(
				"Drop one file. These were not added: a.pdf, b.pdf.",
			),
		).toBeTruthy();
		dropFiles(zone, [pdf("huge.pdf", 25 * 1024 * 1024 + 1)]);
		expect(await screen.findByText(/File is larger than 25/)).toBeTruthy();
		dropFiles(zone, [pdf("poster.pdf")]);
		expect(
			await screen.findByText(
				"Upload failed. Check your connection and try again.",
			),
		).toBeTruthy();
		dropFiles(zone, [pdf("retry.pdf")]);
		await waitFor(() =>
			expect(
				screen.getAllByText(
					"Upload failed. Check your connection and try again.",
				).length,
			).toBeGreaterThan(0),
		);
	});

	it("hides the graphics picker once the event is published", async () => {
		renderWithConfirm(
			<EventViewModal
				isOpen
				onClose={vi.fn()}
				event={{ ...event, status: "published" }}
				onUpdateGraphics={vi.fn()}
			/>,
		);
		fireEvent.mouseDown(screen.getByRole("tab", { name: "Graphics" }));
		fireEvent.click(screen.getByRole("tab", { name: "Graphics" }));
		expect(await screen.findByText("Graphics Needed")).toBeTruthy();
		expect(screen.queryByLabelText("Upload graphics file")).toBeNull();
	});
});

describe("settings resume drop", () => {
	it("selects a PDF from the keyboard control and names an invalid drop", async () => {
		const SettingsPage = SettingsRoute.options.component;
		if (!SettingsPage) throw new Error("missing settings page");
		await renderRouted(<SettingsPage />);
		const input = await screen.findByLabelText(
			"Resume PDF",
			{},
			{ timeout: 8000 },
		);
		input.focus();
		expect(document.activeElement).toBe(input);
		expect(screen.queryByText(/Paste with Cmd/)).toBeNull();
		pasteOn(input, [
			fileEntry(
				new File(["x"], "resume.docx", {
					type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
				}),
			),
		]);
		expect(screen.queryByText(/Resume must be a PDF file/)).toBeNull();
		dropFiles(zoneFor(input), [
			new File(["x"], "resume.docx", {
				type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			}),
		]);
		expect(
			await screen.findByText("resume.docx: Resume must be a PDF file"),
		).toBeTruthy();
		fireEvent.change(input, { target: { files: fileList([pdf("ada.pdf")]) } });
		await waitFor(() =>
			expect(screen.queryByText(/Resume must be a PDF file/)).toBeNull(),
		);
		fireEvent.change(input, { target: { files: fileList([]) } });
		expect(screen.queryByRole("alert")).toBeNull();
	});

	it("keeps a chosen PDF on the phone sheet after an empty picker result", async () => {
		Object.defineProperty(window, "innerWidth", {
			configurable: true,
			value: 390,
		});
		const SettingsPage = SettingsRoute.options.component;
		if (!SettingsPage) throw new Error("missing settings page");
		await renderRouted(<SettingsPage />);
		const choose = await screen.findByRole("button", { name: "Choose PDF" });
		dropFiles(zoneFor(choose), [pdf("ada.pdf")]);
		expect(await screen.findByText("Selected: ada.pdf")).toBeTruthy();
		fireEvent.click(choose);
		const input = await screen.findByLabelText(
			"Resume PDF",
			{},
			{ timeout: 8000 },
		);
		input.focus();
		expect(document.activeElement).toBe(input);
		fireEvent.change(input, { target: { files: fileList([]) } });
		expect(screen.getByText("Selected: ada.pdf")).toBeTruthy();
	});
});

describe("member receipt drop", () => {
	beforeEach(() => {
		sessionStorage.setItem(
			"reimbursement-draft-v1",
			JSON.stringify({
				formData: {
					title: "Conference",
					department: "events",
					paymentMethod: "Zelle",
					additionalInfo: "",
					businessPurpose: "IEEE conference travel",
				},
				receipts: [
					{
						id: "receipt-1",
						vendorName: "",
						location: "",
						dateOfPurchase: 1,
						lineItems: [
							{
								id: "line-1",
								description: "",
								category: "other",
								amount: 0,
							},
						],
						notes: "",
						subtotal: 0,
						tax: 0,
						tip: 0,
						shipping: 0,
						total: 0,
						expenseType: "receipt",
					},
				],
				step: 3,
				maxVisitedStep: 3,
				savedAt: 1,
			}),
		);
		Object.assign(ReimbursementRoute, {
			useSearch: () => ({
				view: "create",
				id: undefined,
				q: "",
				status: "all",
			}),
			useNavigate: () => navigate,
		});
	});

	it("keeps the camera capture and rejects a multi-file drop before upload", async () => {
		const Page = ReimbursementRoute.options.component;
		if (!Page) throw new Error("missing reimbursement page");
		await renderRouted(<Page />);
		const input = await screen.findByLabelText(
			"Select Receipt File",
			{},
			{ timeout: 8000 },
		);
		input.focus();
		expect(document.activeElement).toBe(input);
		expect(screen.queryByLabelText("Take Receipt Photo")).toBeNull();
		expect(screen.queryByText(/Paste with Cmd/)).toBeNull();
		const receiptPaste = pasteOn(input, [
			fileEntry(pdf("a.pdf")),
			fileEntry(pdf("b.pdf")),
		]);
		expect(receiptPaste.defaultPrevented).toBe(false);
		expect(screen.queryByText(/Drop one file/)).toBeNull();
		dropFiles(zoneFor(input), [pdf("a.pdf"), pdf("b.pdf")]);
		expect(
			await screen.findByText(
				"Drop one file. These were not added: a.pdf, b.pdf.",
			),
		).toBeTruthy();
		dropFiles(zoneFor(input), [pdf("huge.pdf", 10 * 1024 * 1024 + 1)]);
		expect(await screen.findByText(/File too large/)).toBeTruthy();
		fireEvent.change(input, {
			target: {
				files: fileList([new File(["x"], "notes.txt", { type: "text/plain" })]),
			},
		});
		expect(await screen.findByText(/not an accepted file type/)).toBeTruthy();
	});

	it("keeps the receipt camera outside the drop target on a phone", async () => {
		Object.defineProperty(window, "innerWidth", {
			configurable: true,
			value: 390,
		});
		const Page = ReimbursementRoute.options.component;
		if (!Page) throw new Error("missing reimbursement page");
		await renderRouted(<Page />);
		const camera = await screen.findByLabelText("Take Receipt Photo");
		expect(camera.getAttribute("capture")).toBe("environment");
		expect(camera.getAttribute("accept")).toBe("image/*");
		expect(camera.closest("[data-drag-state]")).toBeNull();
	});
});

describe("payment proof drop", () => {
	beforeEach(() => {
		queryResult.current = [
			{
				_id: "req_1",
				_creationTime: 1,
				title: "Conference travel",
				department: "events",
				status: "approved",
				additionalInfo: "",
				businessPurpose: "Conference",
				submittedBy: "ada",
				submittedByName: "Ada",
				totalAmount: 42,
				receipts: [],
			},
		];
		Object.assign(ManageRoute, {
			useSearch: () => ({
				q: "",
				status: ["approved"],
				sort: "_creationTime",
				dir: "desc",
				page: 1,
				id: "req_1",
			}),
			useNavigate: () => navigate,
		});
	});

	it("selects one proof and names every file from a multi-file drop", async () => {
		const Page = ManageRoute.options.component;
		if (!Page) throw new Error("missing manage page");
		await renderRouted(<Page />);
		fireEvent.click(
			await screen.findByRole(
				"button",
				{ name: "Mark as Paid" },
				{ timeout: 8000 },
			),
		);
		const input = await screen.findByLabelText("Upload proof of payment");
		input.focus();
		expect(document.activeElement).toBe(input);
		dropFiles(zoneFor(input), [pdf("a.pdf"), pdf("b.pdf")]);
		expect(
			await screen.findByText(
				"Drop one file. These were not added: a.pdf, b.pdf.",
			),
		).toBeTruthy();
		expect(screen.queryByText("Ready to process")).toBeNull();
		dropFiles(zoneFor(input), [pdf("proof.pdf")]);
		expect(await screen.findByText("proof.pdf")).toBeTruthy();
		expect(screen.getByText("Ready to process")).toBeTruthy();
		dropFiles(zoneFor(input), [
			new File(["x"], "notes.txt", { type: "text/plain" }),
		]);
		expect(await screen.findByText(/not an accepted file type/)).toBeTruthy();
		expect(screen.getByText("proof.pdf")).toBeTruthy();
		expect(screen.queryByText(/Paste with Cmd/)).toBeNull();
		pasteOn(input, [fileEntry(png("shot.png"))]);
		expect(await screen.findByText("shot.png")).toBeTruthy();
	});
});
