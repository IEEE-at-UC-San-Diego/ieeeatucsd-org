import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const evidenceDir =
	process.env.VERIFY_EVIDENCE_DIR ?? "/tmp/verify-dashboard-evidence";
const dashboard = process.env.DASHBOARD_URL ?? "http://localhost:3000";
const officerPath = process.env.IEEE_DEV_OFFICER_JSON;
const puppeteerPath =
	process.env.PUPPETEER_CORE ??
	"/tmp/verify-dashboard-pw/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js";

function chromeExecutable() {
	if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
	for (const name of [
		"google-chrome",
		"google-chrome-stable",
		"chromium",
		"chromium-browser",
	]) {
		try {
			const found = execFileSync("which", [name], { encoding: "utf8" }).trim();
			if (found) return found;
		} catch {
			continue;
		}
	}
	throw new Error("Set CHROME_PATH to a Chrome or Chromium binary");
}

const bridge = officerPath
	? JSON.parse(readFileSync(officerPath, "utf8"))
	: null;
mkdirSync(evidenceDir, { recursive: true });
const puppeteer = await import(puppeteerPath);

const browser = await puppeteer.launch({
	executablePath: chromeExecutable(),
	headless: true,
	args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 1400 });
const consoleLines = [];
const network = [];
page.on("console", (msg) => {
	consoleLines.push({ type: msg.type(), text: msg.text() });
});
page.on("pageerror", (err) => {
	consoleLines.push({ type: "pageerror", text: String(err) });
});
page.on("response", async (response) => {
	const url = response.url();
	if (!url.includes("/api/storage/upload")) return;
	let body = "";
	try {
		body = await response.text();
	} catch {
		body = "";
	}
	network.push({
		url: url.split("?")[0],
		status: response.status(),
		body: body.slice(0, 500),
	});
});

if (bridge) {
	await page.evaluateOnNewDocument((value) => {
		localStorage.setItem("ieeeDevOfficer", JSON.stringify(value));
	}, bridge);
}

async function clickLabel(label) {
	const clicked = await page.evaluate((text) => {
		const nodes = [
			...document.querySelectorAll(
				"button, label, [role='option'], [role='combobox']",
			),
		];
		const node = nodes.find((el) => (el.textContent ?? "").includes(text));
		if (!node) return false;
		node.click();
		return true;
	}, label);
	if (!clicked) throw new Error(`Could not click ${label}`);
}

await page.goto(`${dashboard}/manage-events`, {
	waitUntil: "domcontentloaded",
	timeout: 60000,
});
await page.waitForFunction(
	() => {
		const text = document.body.innerText;
		return (
			text.includes("New Event Request") || text.includes("Continue with Google")
		);
	},
	{ timeout: 30000 },
);
const signedIn = await page.evaluate(() =>
	document.body.innerText.includes("New Event Request"),
);
if (!signedIn) {
	await page.screenshot({ path: `${evidenceDir}/signin-wall.png` });
	console.error(
		"Sign-in wall. The DEV officer bridge is missing from this dashboard build.",
	);
	await browser.close();
	process.exit(2);
}

await page.screenshot({ path: `${evidenceDir}/events-list.png` });
await clickLabel("New Event Request");
await page.waitForFunction(() =>
	document.body.innerText.includes("Before You Begin"),
);
await clickLabel("I have read the requirements");
await clickLabel("Next");
await page.waitForSelector("input[name='eventName']");
await page.type("input[name='eventName']", "Invoice PDF Social");
await page.type(
	"textarea[name='eventDescription']",
	"A small social to check invoice PDFs.",
);
await clickLabel("Select event type");
await page.waitForFunction(() =>
	[...document.querySelectorAll("[role='option']")].some((el) =>
		(el.textContent ?? "").includes("Social"),
	),
);
await clickLabel("Social");
await clickLabel("Next");
await page.waitForSelector("input[name='location']");
await page.type("input[name='location']", "Price Center");
await page.type("input[name='eventCode']", "INV42");
await clickLabel("Next");
await clickLabel("Next");
await page.waitForFunction(() =>
	document.body.innerText.includes("Upload an invoice to get started"),
);

const dropInfo = await page.evaluate(() => {
	const input = document.querySelector(
		'input[aria-label="Upload invoice file"]',
	);
	const zone = input?.closest("fieldset");
	if (!input || !zone) return { error: "missing invoice drop target" };
	const bytes = new Uint8Array([
		0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
	]);
	const file = new File([bytes], "invoice.pdf", { type: "" });
	const dt = new DataTransfer();
	dt.items.add(file);
	const added = dt.files[0];
	zone.dispatchEvent(
		new DragEvent("drop", {
			bubbles: true,
			cancelable: true,
			dataTransfer: dt,
		}),
	);
	return {
		constructedType: file.type,
		addedType: added?.type ?? null,
		addedName: added?.name ?? null,
	};
});

await page.waitForFunction(
	() => {
		const text = document.body.innerText;
		return (
			text.includes("Invoice file attached") ||
			text.includes("Failed to upload file")
		);
	},
	{ timeout: 15000 },
);
await page.evaluate(() => {
	const nodes = [...document.querySelectorAll("p, span, div")];
	const attached = nodes.find((node) =>
		node.textContent?.trim().startsWith("Invoice file attached"),
	);
	attached?.scrollIntoView({ block: "center" });
});
const visible = await page.evaluate(() => {
	const text = document.body.innerText;
	return {
		attached: text.includes("Invoice file attached"),
		uploadError: text.includes("Failed to upload file"),
		excerpt: text
			.split("\n")
			.filter((line) => /invoice|upload|fail|attached|error|pdf/i.test(line))
			.slice(0, 30),
	};
});
await page.screenshot({ path: `${evidenceDir}/invoice-upload.png` });
const report = { feature: "invoice-upload", dropInfo, visible, network, consoleLines };
writeFileSync(`${evidenceDir}/invoice-upload.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ dropInfo, visible, network }, null, 2));
await browser.close();
if (!visible.attached) process.exit(1);
