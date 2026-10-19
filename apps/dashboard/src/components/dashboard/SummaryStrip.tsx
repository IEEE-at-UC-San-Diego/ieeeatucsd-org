import { Skeleton } from "@/components/ui/skeleton";

interface SummaryItem {
	label: string;
	value: React.ReactNode;
}

/**
 * One quiet line of figures under a page header ("22 members · 21 active").
 * Replaces rows of metric cards: the numbers are context, not the page.
 */
export function SummaryStrip({
	items,
	loading = false,
}: {
	items: SummaryItem[];
	loading?: boolean;
}) {
	if (loading) {
		return <Skeleton className="h-5 w-72 rounded-[4px]" />;
	}
	return (
		<dl className="flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm">
			{items.map((item) => (
				<div key={item.label} className="flex items-baseline gap-1.5">
					<dd className="font-semibold tabular-nums text-foreground">
						{item.value}
					</dd>
					<dt className="text-muted-foreground">{item.label}</dt>
				</div>
			))}
		</dl>
	);
}
