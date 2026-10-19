import { cn } from "@/lib/utils";

export type DotTone =
	| "gray"
	| "blue"
	| "purple"
	| "teal"
	| "amber"
	| "red"
	| "green"
	| "pink";

const DOT: Record<DotTone, string> = {
	gray: "bg-ds-gray-600",
	blue: "bg-ds-blue-700",
	purple: "bg-ds-purple-700",
	teal: "bg-ds-teal-700",
	amber: "bg-ds-amber-700",
	red: "bg-ds-red-700",
	green: "bg-ds-green-700",
	pink: "bg-ds-pink-700",
};

/** Status/role/tier as a small colored dot plus plain text: no filled pill. */
export function DotLabel({
	tone = "gray",
	children,
	className,
}: {
	tone?: DotTone;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<span
			className={cn(
				"inline-flex items-center gap-1.5 text-sm text-foreground",
				className,
			)}
		>
			<span
				aria-hidden
				className={cn("size-1.5 shrink-0 rounded-full", DOT[tone])}
			/>
			{children}
		</span>
	);
}
