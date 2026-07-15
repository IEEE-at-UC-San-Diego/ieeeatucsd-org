export interface Event {
	_id: string;
	eventName: string;
	eventDescription: string;
	eventCode: string;
	location: string;
	files: string[];
	pointsToReward: number;
	startDate: number;
	endDate: number;
	published: boolean;
	eventType:
		| "social"
		| "technical"
		| "outreach"
		| "professional"
		| "projects"
		| "other";
	hasFood: boolean;
	attendeeCount?: number;
	publicGoogleEventId?: string | null;
	publicGoogleEventUrl?: string | null;
	publicGoogleCalendarId?: string | null;
	publicGoogleCalendarSubscribeUrl?: string | null;
	publicGoogleCalendarIcsUrl?: string | null;
}

export type EventStatus = "live" | "upcoming" | "ended";

export function getEventStatus(event: Event): EventStatus {
	const now = Date.now();
	if (now >= event.startDate && now <= event.endDate) {
		return "live";
	}
	if (now < event.startDate) {
		return "upcoming";
	}
	return "ended";
}

export function formatEventDate(timestamp: number): string {
	return new Date(timestamp).toLocaleDateString(undefined, {
		weekday: "short",
		month: "short",
		day: "numeric",
	});
}

export function formatEventTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString([], {
		hour: "numeric",
		minute: "2-digit",
	});
}

export const EVENT_TYPE_LABELS: Record<Event["eventType"], string> = {
	social: "Social",
	technical: "Technical",
	outreach: "Outreach",
	professional: "Professional",
	projects: "Projects",
	other: "Other",
};

export const EVENT_TYPE_COLORS: Record<Event["eventType"], string> = {
	social: "bg-ds-pink-100 text-ds-pink-700",
	technical: "bg-ds-blue-100 text-ds-blue-700",
	outreach: "bg-ds-green-100 text-ds-green-700",
	professional: "bg-ds-purple-100 text-ds-purple-700",
	projects: "bg-ds-amber-100 text-ds-amber-900",
	other: "bg-muted text-foreground",
};
