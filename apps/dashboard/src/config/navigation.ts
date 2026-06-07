import {
	BarChart3,
	Boxes,
	Briefcase,
	Building2,
	Calendar,
	ClipboardList,
	Coins,
	CreditCard,
	DollarSign,
	FileText,
	Home,
	Link as LinkIcon,
	type LucideIcon,
	MessageSquare,
	RotateCcw,
	Settings,
	ShoppingBag,
	ShoppingCart,
	Trophy,
	UserPlus,
	Users,
} from "lucide-react";
import type { UserRole } from "../hooks/useAuth";

export interface NavigationItem {
	icon: LucideIcon;
	label: string;
	href: string;
}

export interface NavigationCategory {
	title: string;
	items: NavigationItem[];
	requiresRole?: UserRole[];
}

export const NAVIGATION_PATHS = {
	OVERVIEW: "/overview",
	EVENTS: "/events",
	REIMBURSEMENT: "/reimbursement",
	LEADERBOARD: "/leaderboard",
	LINKS: "/links",
	MANAGE_EVENTS: "/manage-events",
	MANAGE_REIMBURSEMENTS: "/manage-reimbursements",
	FUND_REQUESTS: "/fund-requests",
	MANAGE_FUND_REQUESTS: "/manage-fund-requests",
	SLACK_ACCESS: "/slack-access",
	MANAGE_USERS: "/manage-users",
	MANAGE_SPONSORS: "/manage-sponsors",
	ONBOARDING: "/onboarding",
	CONSTITUTION_BUILDER: "/constitution-builder",
	EXECUTIVE_ANALYTICS: "/executive-analytics",
	RESUME_DATABASE: "/sponsors/resume-database",
	SPONSOR_INFORMATION: "/sponsors/information",
	SETTINGS: "/settings",
	SIGNOUT: "/signout",
	GET_STARTED: "/get-started",
	OFFICER_CALENDAR: "/officer-calendar",
	STORE: "/store",
	STORE_CART: "/store/cart",
	STORE_CHECKOUT: "/store/checkout",
	STORE_ORDERS: "/store/orders",
	STORE_POINTS: "/store/points",
	MANAGE_STORE: "/manage-store/products",
	MANAGE_STORE_INVENTORY: "/manage-store/inventory",
	MANAGE_STORE_PICKUPS: "/manage-store/pickups",
	MANAGE_STORE_ORDERS: "/manage-store/orders",
	MANAGE_STORE_RETURNS: "/manage-store/returns",
	MANAGE_STORE_POLICIES: "/manage-store/policies",
	MANAGE_STORE_SETTINGS: "/manage-store/settings",
	MANAGE_STORE_POINTS: "/manage-store/points",
} as const;

export type NavigationPath =
	(typeof NAVIGATION_PATHS)[keyof typeof NAVIGATION_PATHS];

export const navigationCategories: NavigationCategory[] = [
	{
		title: "Member Actions",
		items: [
			{ icon: Home, label: "Overview", href: NAVIGATION_PATHS.OVERVIEW },
			{ icon: LinkIcon, label: "Links", href: NAVIGATION_PATHS.LINKS },
			{ icon: Calendar, label: "Events", href: NAVIGATION_PATHS.EVENTS },
			{
				icon: CreditCard,
				label: "Reimbursement",
				href: NAVIGATION_PATHS.REIMBURSEMENT,
			},
			{
				icon: Trophy,
				label: "Leaderboard",
				href: NAVIGATION_PATHS.LEADERBOARD,
			},
		],
	},
	{
		title: "Store",
		items: [
			{
				icon: ShoppingBag,
				label: "Merch Store",
				href: NAVIGATION_PATHS.STORE,
			},
			{
				icon: ShoppingCart,
				label: "Cart",
				href: NAVIGATION_PATHS.STORE_CART,
			},
			{
				icon: ClipboardList,
				label: "My Orders",
				href: NAVIGATION_PATHS.STORE_ORDERS,
			},
			{
				icon: Coins,
				label: "Points",
				href: NAVIGATION_PATHS.STORE_POINTS,
			},
		],
	},
	{
		title: "General Officers",
		requiresRole: ["General Officer", "Executive Officer", "Administrator"],
		items: [
			{
				icon: Calendar,
				label: "Manage Events",
				href: NAVIGATION_PATHS.MANAGE_EVENTS,
			},
			{
				icon: Calendar,
				label: "Officer Calendar",
				href: NAVIGATION_PATHS.OFFICER_CALENDAR,
			},
			{
				icon: ClipboardList,
				label: "Fund Requests",
				href: NAVIGATION_PATHS.FUND_REQUESTS,
			},
			{
				icon: MessageSquare,
				label: "Slack Access",
				href: NAVIGATION_PATHS.SLACK_ACCESS,
			},
		],
	},
	{
		title: "Store Management",
		requiresRole: ["General Officer", "Executive Officer", "Administrator"],
		items: [
			{
				icon: ShoppingBag,
				label: "Manage Products",
				href: NAVIGATION_PATHS.MANAGE_STORE,
			},
			{
				icon: Boxes,
				label: "Inventory",
				href: NAVIGATION_PATHS.MANAGE_STORE_INVENTORY,
			},
			{
				icon: ClipboardList,
				label: "Orders",
				href: NAVIGATION_PATHS.MANAGE_STORE_ORDERS,
			},
			{
				icon: Calendar,
				label: "Pickups",
				href: NAVIGATION_PATHS.MANAGE_STORE_PICKUPS,
			},
			{
				icon: RotateCcw,
				label: "Returns",
				href: NAVIGATION_PATHS.MANAGE_STORE_RETURNS,
			},
		],
	},
	{
		title: "Executive Officers",
		requiresRole: ["Executive Officer", "Administrator"],
		items: [
			{
				icon: DollarSign,
				label: "Manage Reimbursements",
				href: NAVIGATION_PATHS.MANAGE_REIMBURSEMENTS,
			},
			{
				icon: ClipboardList,
				label: "Manage Fund Requests",
				href: NAVIGATION_PATHS.MANAGE_FUND_REQUESTS,
			},
			{
				icon: Users,
				label: "Manage Users",
				href: NAVIGATION_PATHS.MANAGE_USERS,
			},
			{
				icon: Building2,
				label: "Manage Sponsors",
				href: NAVIGATION_PATHS.MANAGE_SPONSORS,
			},
			{
				icon: UserPlus,
				label: "Onboarding",
				href: NAVIGATION_PATHS.ONBOARDING,
			},
			{
				icon: FileText,
				label: "Constitution Builder",
				href: NAVIGATION_PATHS.CONSTITUTION_BUILDER,
			},
			{
				icon: BarChart3,
				label: "Executive Analytics",
				href: NAVIGATION_PATHS.EXECUTIVE_ANALYTICS,
			},
		],
	},
	{
		title: "Store Administration",
		requiresRole: ["Executive Officer", "Administrator"],
		items: [
			{
				icon: Coins,
				label: "Store Points",
				href: NAVIGATION_PATHS.MANAGE_STORE_POINTS,
			},
			{
				icon: FileText,
				label: "Store Policies",
				href: NAVIGATION_PATHS.MANAGE_STORE_POLICIES,
			},
			{
				icon: Settings,
				label: "Store Settings",
				href: NAVIGATION_PATHS.MANAGE_STORE_SETTINGS,
			},
		],
	},
	{
		title: "Sponsors",
		requiresRole: ["Sponsor", "Administrator"],
		items: [
			{
				icon: Briefcase,
				label: "Resume Database",
				href: NAVIGATION_PATHS.RESUME_DATABASE,
			},
			{
				icon: Building2,
				label: "Sponsor Information",
				href: NAVIGATION_PATHS.SPONSOR_INFORMATION,
			},
		],
	},
];

export const PATH_LABELS: Record<string, string> = {
	"/overview": "Overview",
	"/events": "Events",
	"/reimbursement": "Reimbursement",
	"/leaderboard": "Leaderboard",
	"/links": "Links",
	"/manage-events": "Manage Events",
	"/manage-reimbursements": "Manage Reimbursements",
	"/fund-requests": "Fund Requests",
	"/manage-fund-requests": "Manage Fund Requests",
	"/slack-access": "Slack Access",
	"/manage-users": "Manage Users",
	"/manage-sponsors": "Manage Sponsors",
	"/onboarding": "Onboarding",
	"/constitution-builder": "Constitution Builder",
	"/executive-analytics": "Executive Analytics",
	"/sponsors/resume-database": "Resume Database",
	"/sponsors/information": "Sponsor Information",
	"/settings": "Settings",
	"/get-started": "Get Started",
	"/officer-calendar": "Officer Calendar",
	"/store": "Merch Store",
	"/store/cart": "Cart",
	"/store/checkout": "Checkout",
	"/store/orders": "My Orders",
	"/store/points": "Points",
	"/manage-store/products": "Manage Products",
	"/manage-store/inventory": "Inventory",
	"/manage-store/pickups": "Manage Store Pickups",
	"/manage-store/orders": "Store Orders",
	"/manage-store/returns": "Returns",
	"/manage-store/policies": "Store Policies",
	"/manage-store/settings": "Store Settings",
	"/manage-store/points": "Manage Store Points",
};

export const LEGAL_VERSIONS = {
	TOS_VERSION: "1.2",
	TOS_EFFECTIVE_DATE: "2024-12-29",
	TOS_URL: "/terms-of-service",
	PRIVACY_POLICY_VERSION: "1.2",
	PRIVACY_POLICY_EFFECTIVE_DATE: "2024-12-29",
	PRIVACY_POLICY_URL: "/privacy-policy",
};
