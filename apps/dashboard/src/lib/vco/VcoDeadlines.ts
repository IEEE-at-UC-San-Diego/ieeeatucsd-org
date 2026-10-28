/**
 * VCO funding-pipeline deadline and flag math.
 *
 * Deadlines are calendar dates in America/Los_Angeles unless a caller
 * overrides `timeZone`. Date-only arithmetic uses UTC midnight of the
 * Y-M-D triple so DST does not shift day-of-week or day counts.
 */
export type VcoPhase =
	| "officer_plan"
	| "prog_app"
	| "tres_start"
	| "invoices_tres_finish";

export type VcoTresOwner = "vco" | "president";

export type CalendarDate = {
	year: number;
	month: number;
	day: number;
};

export type FinalsWeek = {
	start: CalendarDate;
	end: CalendarDate;
};

export type QuarterStartSettings = {
	fallWeek0Start?: string;
	winterWeek1Start?: string;
	springWeek1Start?: string;
};

export type VcoDeadlineConfig = {
	timeZone?: string;
	finalsWeeks?: FinalsWeek[];
	foodCapPerHead?: number;
	nowMs?: number;
};

export type VcoInvoiceInput = {
	total?: number;
	vendor?: string;
	invoiceFile?: string;
	description?: string;
	items?: { description?: string }[];
};

export type VcoEventInput = {
	eventName: string;
	startDate?: number | null;
	dateTbd?: boolean;
	createdAt: number;
	location?: string | null;
	expectedAttendance?: number | null;
	invoices?: VcoInvoiceInput[];
	hasFood?: boolean;
	foodDrinksBeingServed?: boolean;
	needsAsFunding?: boolean;
	asFundingRequired?: boolean;
	funded?: boolean | null;
	tresOwner?: VcoTresOwner | null;
};

export type VcoFlag =
	| "missing_venue"
	| "missing_headcount"
	| "missing_invoice"
	| "late"
	| "food_over_cap"
	| "in_finals_week"
	| "overdue";

export type VcoPhaseDeadline = {
	phase: VcoPhase;
	label: string;
	date: CalendarDate;
	isoDate: string;
	daysUntil: number;
	overdue: boolean;
};

export type VcoPipelineStatus = {
	needsDate: boolean;
	eventDate: CalendarDate | null;
	funded: boolean;
	tresOwner: VcoTresOwner;
	phases: VcoPhaseDeadline[];
	nextDeadline: VcoPhaseDeadline | null;
	flags: VcoFlag[];
	foodCostPerHead: number | null;
	invoiceTotal: number;
	invoiceIn: boolean;
	inFinalsWeek: boolean;
	lateCreated: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const PHASE_LABELS: Record<VcoPhase, string> = {
	officer_plan: "Officer plan",
	prog_app: "Prog app",
	tres_start: "T-Res START",
	invoices_tres_finish: "Invoices / T-Res FINISH",
};

const TBD_LOCATION = /^(tbd|tba|to be (determined|announced)|n\/?a)?$/i;
const GBM_OR_TABLING = /\b(gbm|tabling)\b/i;
const FOOD_COST_SIGNAL =
	/\b(food|cater|pizza|costco|restaurant|grocery|snack|meal|lunch|dinner|breakfast|beverage|drink|chipotle|panera|doordash|uber\s*eats)\b/i;
const NON_FOOD_COST_SIGNAL =
	/\b(equipment|rental|projector|microphone|speaker|banner|flyer|print|t-?shirt|swag|decal|camera|audio|visual|\bav\b|lighting)\b/i;

export class VcoDeadlines {
	static readonly TIME_ZONE = "America/Los_Angeles";
	static readonly FOOD_CAP_PER_HEAD = 10;
	static readonly DEFAULT_FINALS_WEEKS: FinalsWeek[] = [
		{
			start: { year: 2026, month: 12, day: 7 },
			end: { year: 2026, month: 12, day: 13 },
		},
	];

	static toCalendarDate(
		ms: number,
		timeZone: string = VcoDeadlines.TIME_ZONE,
	): CalendarDate {
		const parts = new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(new Date(ms));
		const year = Number(parts.find((part) => part.type === "year")?.value);
		const month = Number(parts.find((part) => part.type === "month")?.value);
		const day = Number(parts.find((part) => part.type === "day")?.value);
		if (!year || !month || !day) {
			throw new Error("Unable to convert timestamp to a calendar date");
		}
		return { year, month, day };
	}

	static parseIsoDate(value: string): CalendarDate | null {
		const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
		if (!match) return null;
		const year = Number(match[1]);
		const month = Number(match[2]);
		const day = Number(match[3]);
		const probe = new Date(Date.UTC(year, month - 1, day));
		if (
			probe.getUTCFullYear() !== year ||
			probe.getUTCMonth() !== month - 1 ||
			probe.getUTCDate() !== day
		) {
			return null;
		}
		return { year, month, day };
	}

	static formatIsoDate(date: CalendarDate): string {
		const month = String(date.month).padStart(2, "0");
		const day = String(date.day).padStart(2, "0");
		return `${date.year}-${month}-${day}`;
	}

	static compare(a: CalendarDate, b: CalendarDate): number {
		if (a.year !== b.year) return a.year - b.year;
		if (a.month !== b.month) return a.month - b.month;
		return a.day - b.day;
	}

	static addDays(date: CalendarDate, days: number): CalendarDate {
		const utc = Date.UTC(date.year, date.month - 1, date.day);
		const next = new Date(utc + days * MS_PER_DAY);
		return {
			year: next.getUTCFullYear(),
			month: next.getUTCMonth() + 1,
			day: next.getUTCDate(),
		};
	}

	static dayOfWeek(date: CalendarDate): number {
		return new Date(Date.UTC(date.year, date.month - 1, date.day)).getUTCDay();
	}

	static isWeekend(date: CalendarDate): boolean {
		const day = VcoDeadlines.dayOfWeek(date);
		return day === 0 || day === 6;
	}

	static mondayOnOrBefore(date: CalendarDate): CalendarDate {
		const daysSinceMonday = (VcoDeadlines.dayOfWeek(date) + 6) % 7;
		return VcoDeadlines.addDays(date, -daysSinceMonday);
	}

	static moveWeekendToFriday(date: CalendarDate): CalendarDate {
		const day = VcoDeadlines.dayOfWeek(date);
		if (day === 6) return VcoDeadlines.addDays(date, -1);
		if (day === 0) return VcoDeadlines.addDays(date, -2);
		return date;
	}

	static isInRange(
		date: CalendarDate,
		start: CalendarDate,
		end: CalendarDate,
	): boolean {
		return (
			VcoDeadlines.compare(date, start) >= 0 &&
			VcoDeadlines.compare(date, end) <= 0
		);
	}

	static isInFinalsWeek(
		date: CalendarDate,
		finalsWeeks: FinalsWeek[] = VcoDeadlines.DEFAULT_FINALS_WEEKS,
	): boolean {
		return finalsWeeks.some((week) =>
			VcoDeadlines.isInRange(date, week.start, week.end),
		);
	}

	static fridayOnOrBefore(date: CalendarDate): CalendarDate {
		return VcoDeadlines.addDays(
			date,
			-((VcoDeadlines.dayOfWeek(date) + 2) % 7),
		);
	}

	static moveOutOfFinalsWeek(
		date: CalendarDate,
		finalsWeeks: FinalsWeek[] = VcoDeadlines.DEFAULT_FINALS_WEEKS,
	): CalendarDate {
		const containing = finalsWeeks.find((week) =>
			VcoDeadlines.isInRange(date, week.start, week.end),
		);
		if (!containing) return date;
		const beforeStart = VcoDeadlines.addDays(containing.start, -1);
		return VcoDeadlines.fridayOnOrBefore(beforeStart);
	}

	static programmingAppDeadline(eventDate: CalendarDate): CalendarDate {
		return VcoDeadlines.mondayOnOrBefore(VcoDeadlines.addDays(eventDate, -35));
	}

	static officerPlanDeadline(eventDate: CalendarDate): CalendarDate {
		return VcoDeadlines.addDays(
			VcoDeadlines.programmingAppDeadline(eventDate),
			-14,
		);
	}

	static tresStartDeadline(
		eventDate: CalendarDate,
		finalsWeeks: FinalsWeek[] = VcoDeadlines.DEFAULT_FINALS_WEEKS,
	): CalendarDate {
		return VcoDeadlines.moveOutOfFinalsWeek(
			VcoDeadlines.moveWeekendToFriday(VcoDeadlines.addDays(eventDate, -21)),
			finalsWeeks,
		);
	}

	static tresFinishDeadline(
		eventDate: CalendarDate,
		finalsWeeks: FinalsWeek[] = VcoDeadlines.DEFAULT_FINALS_WEEKS,
	): CalendarDate {
		return VcoDeadlines.moveOutOfFinalsWeek(
			VcoDeadlines.moveWeekendToFriday(VcoDeadlines.addDays(eventDate, -14)),
			finalsWeeks,
		);
	}

	static isLateCreated(
		createdAtMs: number,
		progAppDeadline: CalendarDate,
		timeZone: string = VcoDeadlines.TIME_ZONE,
	): boolean {
		const created = VcoDeadlines.toCalendarDate(createdAtMs, timeZone);
		return VcoDeadlines.compare(created, progAppDeadline) > 0;
	}

	static isMissingVenue(location?: string | null): boolean {
		const trimmed = location?.trim() ?? "";
		return trimmed.length === 0 || TBD_LOCATION.test(trimmed);
	}

	static isMissingHeadcount(expectedAttendance?: number | null): boolean {
		return (
			expectedAttendance === undefined ||
			expectedAttendance === null ||
			!Number.isFinite(expectedAttendance) ||
			expectedAttendance <= 0
		);
	}

	static invoiceTotal(invoices?: VcoInvoiceInput[]): number {
		if (!invoices?.length) return 0;
		return invoices.reduce((sum, invoice) => sum + (invoice.total ?? 0), 0);
	}

	static invoiceText(invoice: VcoInvoiceInput): string {
		return [
			invoice.vendor,
			invoice.description,
			...(invoice.items ?? []).map((item) => item.description),
		]
			.filter(Boolean)
			.join(" ");
	}

	static isServingFood(
		event?: Pick<VcoEventInput, "hasFood" | "foodDrinksBeingServed">,
	): boolean {
		return Boolean(event?.hasFood || event?.foodDrinksBeingServed);
	}

	static isFoodEligibleInvoice(
		invoice: VcoInvoiceInput,
		event?: Pick<VcoEventInput, "hasFood" | "foodDrinksBeingServed">,
	): boolean {
		const text = VcoDeadlines.invoiceText(invoice);
		const looksLikeFood = FOOD_COST_SIGNAL.test(text);
		const looksLikeNonFood = NON_FOOD_COST_SIGNAL.test(text);
		if (looksLikeFood) return true;
		if (looksLikeNonFood) return false;
		return VcoDeadlines.isServingFood(event);
	}

	static foodEligibleTotal(
		invoices: VcoInvoiceInput[] | undefined,
		event?: Pick<VcoEventInput, "hasFood" | "foodDrinksBeingServed">,
	): number {
		if (!invoices?.length) return 0;
		return invoices.reduce((sum, invoice) => {
			if (!VcoDeadlines.isFoodEligibleInvoice(invoice, event)) return sum;
			return sum + (invoice.total ?? 0);
		}, 0);
	}

	static hasInvoice(invoices?: VcoInvoiceInput[]): boolean {
		if (!invoices?.length) return false;
		return invoices.some(
			(invoice) =>
				Boolean(invoice.invoiceFile) ||
				(invoice.total ?? 0) > 0 ||
				Boolean(invoice.vendor?.trim()),
		);
	}

	static foodCostPerHead(
		invoices: VcoInvoiceInput[] | undefined,
		expectedAttendance?: number | null,
		event?: Pick<VcoEventInput, "hasFood" | "foodDrinksBeingServed">,
	): number | null {
		if (VcoDeadlines.isMissingHeadcount(expectedAttendance)) return null;
		if (!invoices?.length) return null;
		const total = VcoDeadlines.foodEligibleTotal(invoices, event);
		if (total <= 0) return null;
		return total / (expectedAttendance as number);
	}

	static isFoodOverCap(
		invoices: VcoInvoiceInput[] | undefined,
		expectedAttendance?: number | null,
		cap: number = VcoDeadlines.FOOD_CAP_PER_HEAD,
		event?: Pick<VcoEventInput, "hasFood" | "foodDrinksBeingServed">,
	): boolean {
		const perHead = VcoDeadlines.foodCostPerHead(
			invoices,
			expectedAttendance,
			event,
		);
		return perHead !== null && perHead > cap;
	}

	static isFunded(
		event: Pick<
			VcoEventInput,
			"funded" | "needsAsFunding" | "asFundingRequired"
		>,
	): boolean {
		if (event.funded === true) return true;
		if (event.funded === false) return false;
		return Boolean(event.needsAsFunding || event.asFundingRequired);
	}

	static inferTresOwner(
		event: Pick<VcoEventInput, "eventName" | "tresOwner">,
	): VcoTresOwner {
		if (event.tresOwner === "vco" || event.tresOwner === "president") {
			return event.tresOwner;
		}
		return GBM_OR_TABLING.test(event.eventName) ? "president" : "vco";
	}

	static finalsWeeksFromQuarterStarts(
		settings: QuarterStartSettings,
	): FinalsWeek[] {
		const weeks: FinalsWeek[] = [];
		const fallStart = settings.fallWeek0Start
			? VcoDeadlines.parseIsoDate(settings.fallWeek0Start)
			: null;
		if (fallStart) {
			const start = VcoDeadlines.addDays(fallStart, 11 * 7);
			weeks.push({ start, end: VcoDeadlines.addDays(start, 6) });
		}
		for (const raw of [settings.winterWeek1Start, settings.springWeek1Start]) {
			const quarterStart = raw ? VcoDeadlines.parseIsoDate(raw) : null;
			if (!quarterStart) continue;
			const start = VcoDeadlines.addDays(quarterStart, 10 * 7);
			weeks.push({ start, end: VcoDeadlines.addDays(start, 6) });
		}
		return weeks;
	}

	static resolveFinalsWeeks(
		settings?: QuarterStartSettings,
		explicit?: FinalsWeek[],
	): FinalsWeek[] {
		if (explicit?.length) return explicit;
		const derived = settings
			? VcoDeadlines.finalsWeeksFromQuarterStarts(settings)
			: [];
		return derived.length > 0 ? derived : VcoDeadlines.DEFAULT_FINALS_WEEKS;
	}

	static currentQuarterRange(
		today: CalendarDate,
		settings?: QuarterStartSettings,
	): { start: CalendarDate; end: CalendarDate } | null {
		const fallStart = settings?.fallWeek0Start
			? VcoDeadlines.parseIsoDate(settings.fallWeek0Start)
			: null;
		const winterStart = settings?.winterWeek1Start
			? VcoDeadlines.parseIsoDate(settings.winterWeek1Start)
			: null;
		const springStart = settings?.springWeek1Start
			? VcoDeadlines.parseIsoDate(settings.springWeek1Start)
			: null;

		if (fallStart && winterStart && springStart) {
			const fallEnd = VcoDeadlines.addDays(winterStart, -1);
			const winterEnd = VcoDeadlines.addDays(springStart, -1);
			const springEnd = VcoDeadlines.addDays(springStart, 11 * 7 - 1);
			const ranges = [
				{ start: fallStart, end: fallEnd },
				{ start: winterStart, end: winterEnd },
				{ start: springStart, end: springEnd },
			];
			return (
				ranges.find((range) =>
					VcoDeadlines.isInRange(today, range.start, range.end),
				) ?? null
			);
		}

		if (today.month >= 9) {
			return {
				start: { year: today.year, month: 9, day: 1 },
				end: { year: today.year, month: 12, day: 31 },
			};
		}
		if (today.month <= 3) {
			return {
				start: { year: today.year, month: 1, day: 1 },
				end: { year: today.year, month: 3, day: 31 },
			};
		}
		if (today.month <= 6) {
			return {
				start: { year: today.year, month: 4, day: 1 },
				end: { year: today.year, month: 6, day: 30 },
			};
		}
		return {
			start: { year: today.year, month: 7, day: 1 },
			end: { year: today.year, month: 8, day: 31 },
		};
	}

	static isInCurrentQuarter(
		eventDate: CalendarDate,
		today: CalendarDate,
		settings?: QuarterStartSettings,
	): boolean {
		const range = VcoDeadlines.currentQuarterRange(today, settings);
		if (!range) return false;
		return VcoDeadlines.isInRange(eventDate, range.start, range.end);
	}

	static compute(
		event: VcoEventInput,
		config: VcoDeadlineConfig = {},
	): VcoPipelineStatus {
		const timeZone = config.timeZone ?? VcoDeadlines.TIME_ZONE;
		const finalsWeeks = config.finalsWeeks ?? VcoDeadlines.DEFAULT_FINALS_WEEKS;
		const foodCap = config.foodCapPerHead ?? VcoDeadlines.FOOD_CAP_PER_HEAD;
		const nowMs = config.nowMs ?? Date.now();
		const today = VcoDeadlines.toCalendarDate(nowMs, timeZone);
		const funded = VcoDeadlines.isFunded(event);
		const tresOwner = VcoDeadlines.inferTresOwner(event);
		const needsDate = Boolean(event.dateTbd) || !event.startDate;
		const invoiceIn = VcoDeadlines.hasInvoice(event.invoices);
		const invoiceTotal = VcoDeadlines.invoiceTotal(event.invoices);
		const foodCostPerHead = VcoDeadlines.foodCostPerHead(
			event.invoices,
			event.expectedAttendance,
			event,
		);

		if (needsDate) {
			const flags: VcoFlag[] = [];
			if (VcoDeadlines.isMissingVenue(event.location)) {
				flags.push("missing_venue");
			}
			if (VcoDeadlines.isMissingHeadcount(event.expectedAttendance)) {
				flags.push("missing_headcount");
			}
			if (
				VcoDeadlines.isFoodOverCap(
					event.invoices,
					event.expectedAttendance,
					foodCap,
					event,
				)
			) {
				flags.push("food_over_cap");
			}
			return {
				needsDate: true,
				eventDate: null,
				funded,
				tresOwner,
				phases: [],
				nextDeadline: null,
				flags,
				foodCostPerHead,
				invoiceTotal,
				invoiceIn,
				inFinalsWeek: false,
				lateCreated: false,
			};
		}

		const eventDate = VcoDeadlines.toCalendarDate(
			event.startDate as number,
			timeZone,
		);
		const officerPlan = VcoDeadlines.moveOutOfFinalsWeek(
			VcoDeadlines.officerPlanDeadline(eventDate),
			finalsWeeks,
		);
		const progApp = VcoDeadlines.moveOutOfFinalsWeek(
			VcoDeadlines.programmingAppDeadline(eventDate),
			finalsWeeks,
		);
		const phases: VcoPhaseDeadline[] = [
			VcoDeadlines.toPhaseDeadline("officer_plan", officerPlan, today),
		];
		if (funded) {
			phases.push(VcoDeadlines.toPhaseDeadline("prog_app", progApp, today));
			phases.push(
				VcoDeadlines.toPhaseDeadline(
					"tres_start",
					VcoDeadlines.tresStartDeadline(eventDate, finalsWeeks),
					today,
				),
			);
			phases.push(
				VcoDeadlines.toPhaseDeadline(
					"invoices_tres_finish",
					VcoDeadlines.tresFinishDeadline(eventDate, finalsWeeks),
					today,
				),
			);
		}

		const overduePhase = phases.find((phase) => phase.overdue);
		const upcoming = phases.find((phase) => !phase.overdue);
		const nextDeadline =
			overduePhase ?? upcoming ?? phases[phases.length - 1] ?? null;
		const lateCreated = funded
			? VcoDeadlines.isLateCreated(event.createdAt, progApp, timeZone)
			: false;
		const inFinalsWeek = VcoDeadlines.isInFinalsWeek(eventDate, finalsWeeks);
		const invoicePhase = phases.find(
			(phase) => phase.phase === "invoices_tres_finish",
		);
		const invoicePhaseDue = Boolean(
			invoicePhase && invoicePhase.daysUntil <= 0,
		);

		const flags: VcoFlag[] = [];
		if (VcoDeadlines.isMissingVenue(event.location))
			flags.push("missing_venue");
		if (VcoDeadlines.isMissingHeadcount(event.expectedAttendance)) {
			flags.push("missing_headcount");
		}
		if (funded && invoicePhaseDue && !invoiceIn) flags.push("missing_invoice");
		if (lateCreated) flags.push("late");
		if (
			VcoDeadlines.isFoodOverCap(
				event.invoices,
				event.expectedAttendance,
				foodCap,
				event,
			)
		) {
			flags.push("food_over_cap");
		}
		if (inFinalsWeek) flags.push("in_finals_week");
		if (nextDeadline?.overdue) flags.push("overdue");

		return {
			needsDate: false,
			eventDate,
			funded,
			tresOwner,
			phases,
			nextDeadline,
			flags,
			foodCostPerHead,
			invoiceTotal,
			invoiceIn,
			inFinalsWeek,
			lateCreated,
		};
	}

	static sortByNextDeadline<T extends { status: VcoPipelineStatus }>(
		rows: T[],
	): T[] {
		return [...rows].sort((a, b) => {
			if (a.status.needsDate && b.status.needsDate) return 0;
			if (a.status.needsDate) return 1;
			if (b.status.needsDate) return -1;
			const aDate = a.status.nextDeadline?.date;
			const bDate = b.status.nextDeadline?.date;
			if (!aDate && !bDate) return 0;
			if (!aDate) return 1;
			if (!bDate) return -1;
			return VcoDeadlines.compare(aDate, bDate);
		});
	}

	private static toPhaseDeadline(
		phase: VcoPhase,
		date: CalendarDate,
		today: CalendarDate,
	): VcoPhaseDeadline {
		const daysUntil = Math.round(
			(Date.UTC(date.year, date.month - 1, date.day) -
				Date.UTC(today.year, today.month - 1, today.day)) /
				MS_PER_DAY,
		);
		return {
			phase,
			label: PHASE_LABELS[phase],
			date,
			isoDate: VcoDeadlines.formatIsoDate(date),
			daysUntil,
			overdue: daysUntil < 0,
		};
	}
}
