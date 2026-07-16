import * as React from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useVisualViewportBottom } from "@/hooks/useVisualViewportBottom";
import { cn } from "@/lib/utils";

export type ResponsiveOverlayVariant = "sheet" | "large-sheet" | "fullscreen";

type ResponsiveOverlayProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: React.ReactNode;
	description?: React.ReactNode;
	children: React.ReactNode;
	footer?: React.ReactNode;
	variant?: ResponsiveOverlayVariant;
	className?: string;
	/** Force desktop dialog even on mobile (rare). */
	forceDialog?: boolean;
};

/**
 * Adaptive overlay:
 * - sheet / large-sheet → Vaul drawer on compact, Dialog on desktop
 * - fullscreen → full-viewport task surface on compact, Dialog on desktop
 */
export function ResponsiveOverlay({
	open,
	onOpenChange,
	title,
	description,
	children,
	footer,
	variant = "sheet",
	className,
	forceDialog = false,
}: ResponsiveOverlayProps) {
	const isMobile = useIsMobile();
	const keyboardInset = useVisualViewportBottom();
	const useDrawer = isMobile && !forceDialog;

	if (useDrawer) {
		const isFullscreen = variant === "fullscreen";
		const isLarge = variant === "large-sheet" || isFullscreen;

		return (
			<Drawer open={open} onOpenChange={onOpenChange}>
				<DrawerContent
					className={cn(
						"flex flex-col",
						isLarge &&
							"data-[vaul-drawer-direction=bottom]:mt-4 data-[vaul-drawer-direction=bottom]:max-h-[96dvh]",
						isFullscreen && "h-[100dvh] rounded-none border-0",
						className,
					)}
					style={
						keyboardInset > 0 ? { paddingBottom: keyboardInset } : undefined
					}
				>
					<DrawerHeader className="shrink-0 text-left">
						<DrawerTitle>{title}</DrawerTitle>
						{description && (
							<DrawerDescription>{description}</DrawerDescription>
						)}
					</DrawerHeader>
					<div
						className={cn(
							"min-h-0 flex-1 overflow-y-auto overscroll-contain px-4",
							isFullscreen && "px-4",
						)}
					>
						{children}
					</div>
					{footer && (
						<DrawerFooter className="shrink-0 border-t pb-[max(1rem,env(safe-area-inset-bottom))]">
							{footer}
						</DrawerFooter>
					)}
				</DrawerContent>
			</Drawer>
		);
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent
				className={cn(
					"flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg",
					variant === "fullscreen" && "sm:max-w-2xl",
					variant === "large-sheet" && "sm:max-w-xl",
					className,
				)}
			>
				<DialogHeader className="shrink-0 space-y-1.5 border-b px-6 py-4 text-left">
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
					{children}
				</div>
				{footer && (
					<DialogFooter className="shrink-0 border-t px-6 py-4 sm:justify-end">
						{footer}
					</DialogFooter>
				)}
			</DialogContent>
		</Dialog>
	);
}

export { DrawerClose };
