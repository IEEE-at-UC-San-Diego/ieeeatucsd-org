import { api } from "@convex/_generated/api";
import { Bell, Check, CheckCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useConfirm } from "@/components/dashboard/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { formatRelativeTime } from "@/lib/formatters";

export function NotificationBell() {
	const { logtoId } = useAuth();
	const [open, setOpen] = useState(false);
	const confirm = useConfirm();

	const unreadCount = useAuthedQuery(
		api.notifications.unreadCount,
		logtoId ? { logtoId } : "skip",
	);
	const notifications = useAuthedQuery(
		api.notifications.listMine,
		logtoId && open ? { logtoId } : "skip",
	);
	const markAsRead = useAuthedMutation(api.notifications.markAsRead);
	const markAllAsRead = useAuthedMutation(api.notifications.markAllAsRead);
	const removeNotification = useAuthedMutation(api.notifications.remove);

	const count = unreadCount ?? 0;

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					className="relative h-8 w-8"
					aria-label={
						count > 0 ? `Notifications, ${count} unread` : "Notifications"
					}
				>
					<Bell className="h-4 w-4" />
					{count > 0 && (
						<span
							aria-hidden="true"
							className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium tabular-nums text-destructive-foreground"
						>
							{count > 99 ? "99+" : count}
						</span>
					)}
				</Button>
			</PopoverTrigger>
			{open && (
				<PopoverContent align="end" className="w-80 p-0">
					<div className="flex items-center justify-between border-b px-4 py-3">
						<h4 className="text-sm font-semibold">Notifications</h4>
						{count > 0 && logtoId && (
							<Button
								variant="ghost"
								size="sm"
								className="h-7 text-xs"
								onClick={() => markAllAsRead({ logtoId })}
							>
								<CheckCheck className="mr-1 h-3 w-3" />
								Mark All as Read
							</Button>
						)}
					</div>
					<ScrollArea className="max-h-80 overscroll-contain">
						{!notifications || notifications.length === 0 ? (
							<div className="flex flex-col items-center justify-center py-8 text-center">
								<Bell className="mb-2 h-8 w-8 text-muted-foreground/30" />
								<p className="text-sm text-muted-foreground">
									No notifications
								</p>
							</div>
						) : (
							<div className="divide-y">
								{notifications.map((notification) => (
									<div
										key={notification._id}
										className={`group flex gap-3 px-4 py-3 transition-colors ${
											!notification.read ? "bg-accent/50" : ""
										}`}
									>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium leading-tight break-words">
												{notification.title}
											</p>
											<p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 break-words">
												{notification.message}
											</p>
											<p className="mt-1 text-[10px] text-muted-foreground/70">
												{formatRelativeTime(
													notification.createdAt ?? notification._creationTime,
												)}
											</p>
										</div>
										<div className="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
											{!notification.read && logtoId && (
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6"
													aria-label={`Mark “${notification.title}” as read`}
													onClick={() =>
														markAsRead({ logtoId, id: notification._id })
													}
												>
													<Check className="h-3 w-3" />
												</Button>
											)}
											{logtoId && (
												<Button
													variant="ghost"
													size="icon"
													className="h-6 w-6 text-muted-foreground hover:text-destructive"
													aria-label={`Delete notification “${notification.title}”`}
													onClick={async () => {
														if (
															!(await confirm({
																title: "Delete Notification?",
																description: "This can’t be undone.",
																confirmLabel: "Delete Notification",
																destructive: true,
															}))
														)
															return;
														await removeNotification({
															logtoId,
															id: notification._id,
														});
													}}
												>
													<Trash2 className="h-3 w-3" />
												</Button>
											)}
										</div>
									</div>
								))}
							</div>
						)}
					</ScrollArea>
				</PopoverContent>
			)}
		</Popover>
	);
}
