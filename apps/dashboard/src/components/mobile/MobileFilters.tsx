import { SlidersHorizontal, X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type MobileFilterChip = {
	id: string;
	label: string;
	onClear: () => void;
};

type MobileFiltersProps = {
	searchValue: string;
	onSearchChange: (value: string) => void;
	searchPlaceholder?: string;
	inlineFilter?: React.ReactNode;
	activeChips?: MobileFilterChip[];
	onClearAll?: () => void;
	sheetTitle?: string;
	sheetContent?: React.ReactNode;
	onApply?: () => void;
	onReset?: () => void;
	className?: string;
	activeFilterCount?: number;
};

export function MobileFilters({
	searchValue,
	onSearchChange,
	searchPlaceholder = "Search…",
	inlineFilter,
	activeChips = [],
	onClearAll,
	sheetTitle = "Filters",
	sheetContent,
	onApply,
	onReset,
	className,
	activeFilterCount = 0,
}: MobileFiltersProps) {
	const [open, setOpen] = React.useState(false);
	const hasSheet = Boolean(sheetContent);

	return (
		<div className={cn("space-y-3", className)}>
			<div className="flex min-w-0 items-center gap-2">
				<div className="min-w-0 flex-1">
					<Input
						value={searchValue}
						onChange={(e) => onSearchChange(e.target.value)}
						placeholder={searchPlaceholder}
						className="h-11 text-base md:h-9 md:text-sm"
						type="search"
						enterKeyHint="search"
						autoComplete="off"
					/>
				</div>
				{inlineFilter}
				{hasSheet && (
					<Drawer open={open} onOpenChange={setOpen}>
						<DrawerTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="relative size-11 shrink-0 md:size-9"
								aria-label="Open filters"
							>
								<SlidersHorizontal className="size-4" />
								{activeFilterCount > 0 && (
									<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-ieee-blue px-1 text-[10px] font-semibold text-on-accent">
										{activeFilterCount}
									</span>
								)}
							</Button>
						</DrawerTrigger>
						<DrawerContent>
							<DrawerHeader className="text-left">
								<DrawerTitle>{sheetTitle}</DrawerTitle>
							</DrawerHeader>
							<div className="max-h-[60dvh] overflow-y-auto px-4 pb-2">
								{sheetContent}
							</div>
							<DrawerFooter className="flex-row gap-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
								{onReset && (
									<Button
										variant="outline"
										className="h-11 flex-1"
										onClick={() => {
											onReset();
										}}
									>
										Reset
									</Button>
								)}
								<DrawerClose asChild>
									<Button
										className="h-11 flex-1"
										onClick={() => {
											onApply?.();
											setOpen(false);
										}}
									>
										Apply
									</Button>
								</DrawerClose>
							</DrawerFooter>
						</DrawerContent>
					</Drawer>
				)}
			</div>

			{activeChips.length > 0 && (
				<div className="flex items-center gap-2 overflow-x-auto scrollbar-quiet pb-0.5">
					{activeChips.map((chip) => (
						<button
							key={chip.id}
							type="button"
							onClick={chip.onClear}
							className="motion-press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-ieee-blue/30 bg-ds-blue-100/80 px-2.5 text-xs font-medium text-tone-link"
						>
							{chip.label}
							<X className="size-3" />
						</button>
					))}
					{onClearAll && (
						<button
							type="button"
							onClick={onClearAll}
							className="shrink-0 px-2 text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
						>
							Clear all
						</button>
					)}
				</div>
			)}
		</div>
	);
}
