import {
	CalendarClock,
	CheckCircle2,
	CircleDot,
	Copy,
	MapPin,
	QrCode,
	XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { MerchOrder } from "./types";
import { pacificDateTime, points } from "./types";

function statusVariant(status: MerchOrder["status"]) {
	if (status === "fulfilled") return "default" as const;
	if (status === "canceled") return "destructive" as const;
	return "secondary" as const;
}

export function OrderDetails({
	order,
	onCancel,
	canceling,
}: {
	order: MerchOrder;
	onCancel?: () => void;
	canceling?: boolean;
}) {
	const pickup = order.pickupSnapshot ?? order.pickup;
	const total = order.totalPoints ?? order.total ?? 0;
	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-start justify-between gap-3">
				<div>
					<p className="text-sm text-muted-foreground">Order</p>
					<h2 className="text-2xl font-semibold">{order.orderNumber}</h2>
					<p className="text-sm text-muted-foreground">
						Placed {pacificDateTime(order.createdAt)} PT
					</p>
				</div>
				<div className="flex gap-2">
					<Badge variant={statusVariant(order.status)} className="capitalize">
						{order.status}
					</Badge>
					{order.pickupHealth && order.status === "pending" && (
						<Badge
							variant={
								order.pickupHealth === "scheduled" ? "outline" : "destructive"
							}
							className="capitalize"
						>
							{order.pickupHealth.replace("_", " ")}
						</Badge>
					)}
				</div>
			</div>

			<div className="grid gap-4 lg:grid-cols-[1fr_300px]">
				<div className="space-y-4">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Receipt</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{order.lines.map((line, index) => (
								<div
									key={`${line.sku}-${index}`}
									className="flex items-center gap-3"
								>
									{line.imageUrl ? (
										<img
											src={line.imageUrl}
											alt=""
											className="size-14 rounded-md border object-cover"
										/>
									) : (
										<div className="size-14 rounded-md bg-muted" />
									)}
									<div className="min-w-0 flex-1">
										<p className="font-medium">{line.productName}</p>
										<p className="text-sm text-muted-foreground">
											{line.variantName ?? line.variantLabel ?? line.sku} · Qty{" "}
											{line.quantity}
										</p>
									</div>
									<p className="font-medium">
										{points(
											line.lineTotal ?? (line.unitPrice ?? 0) * line.quantity,
										)}
									</p>
								</div>
							))}
							<Separator />
							<div className="flex justify-between text-lg font-semibold">
								<span>Total</span>
								<span>{points(total)}</span>
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Pickup</CardTitle>
						</CardHeader>
						<CardContent className="space-y-2 text-sm">
							<div className="flex gap-2">
								<CalendarClock className="mt-0.5 size-4 text-muted-foreground" />
								<div>
									<p className="font-medium">
										{pickup?.name ?? pickup?.label ?? "Merch pickup"}
									</p>
									<p className="text-muted-foreground">
										{pacificDateTime(pickup?.startAt)} PT
									</p>
								</div>
							</div>
							<div className="flex gap-2">
								<MapPin className="mt-0.5 size-4 text-muted-foreground" />
								<span>
									{pickup?.address ??
										pickup?.location ??
										"Location to be confirmed"}
								</span>
							</div>
						</CardContent>
					</Card>

					<OrderTimeline order={order} />
				</div>
				<OrderCode order={order} />
			</div>

			{order.status === "pending" && order.canCancel === true && onCancel && (
				<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
					<p className="font-medium">Need to cancel?</p>
					<p className="mb-3 text-sm text-muted-foreground">
						Eligible pending orders are refunded exactly and returned to
						inventory.
					</p>
					<Button variant="destructive" onClick={onCancel} disabled={canceling}>
						{canceling ? "Canceling…" : "Cancel order"}
					</Button>
				</div>
			)}
		</div>
	);
}

function OrderCode({ order }: { order: MerchOrder }) {
	const [url, setUrl] = useState<string>();
	const token = order.qrToken ?? order.fallbackCode;
	const readableToken = token
		?.replace(/[^a-zA-Z0-9]/g, "")
		.toUpperCase()
		.match(/.{1,4}/g)
		?.join("-");
	useEffect(() => {
		let active = true;
		if (!token || order.status === "canceled") return;
		import("qrcode")
			.then((module) =>
				module.toDataURL(token, {
					width: 480,
					margin: 2,
					errorCorrectionLevel: "M",
				}),
			)
			.then((next) => {
				if (active) setUrl(next);
			})
			.catch(() => setUrl(undefined));
		return () => {
			active = false;
		};
	}, [token, order.status]);

	if (order.status === "canceled")
		return (
			<Card className="h-fit border-destructive/30 bg-destructive/5">
				<CardContent className="flex flex-col items-center gap-3 py-8 text-center">
					<XCircle className="size-12 text-destructive" />
					<p className="font-semibold">Order canceled</p>
					<p className="text-sm text-muted-foreground">
						This pickup code is no longer valid.
					</p>
				</CardContent>
			</Card>
		);
	return (
		<Card className={cn("h-fit", order.status === "fulfilled" && "opacity-75")}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<QrCode className="size-5" /> Pickup code
				</CardTitle>
			</CardHeader>
			<CardContent className="text-center">
				{url ? (
					<img
						src={url}
						alt={`QR code for order ${order.orderNumber}`}
						className="mx-auto aspect-square w-full max-w-64"
					/>
				) : (
					<div className="mx-auto flex aspect-square max-w-64 items-center justify-center rounded-md bg-muted">
						<QrCode className="size-16 text-muted-foreground" />
					</div>
				)}
				{order.status === "fulfilled" && (
					<Badge className="-mt-4 mb-3 relative">
						<CheckCircle2 className="size-3" /> Used
					</Badge>
				)}
				<p className="mt-3 text-xs uppercase tracking-wide text-muted-foreground">
					Readable fallback code
				</p>
				<button
					type="button"
					className="mx-auto mt-1 flex max-w-full items-center gap-2 break-all rounded-md font-mono text-sm font-semibold hover:underline"
					onClick={() => {
						if (readableToken) navigator.clipboard.writeText(readableToken);
						toast.success("Pickup code copied");
					}}
				>
					{readableToken ?? "Unavailable"}
					<Copy className="size-4 shrink-0" />
				</button>
				<p className="mt-3 text-xs text-muted-foreground">
					Present this to an officer. The code does not fulfill an order on its
					own.
				</p>
			</CardContent>
		</Card>
	);
}

function OrderTimeline({ order }: { order: MerchOrder }) {
	const events = order.events?.length
		? order.events
		: [
				...(order.createdAt
					? [{ label: "Order placed", createdAt: order.createdAt }]
					: []),
				...(order.fulfilledAt
					? [
							{
								label: "Picked up",
								createdAt: order.fulfilledAt,
								actorName: order.fulfilledByName,
							},
						]
					: []),
				...(order.canceledAt
					? [
							{
								label: "Canceled and refunded",
								createdAt: order.canceledAt,
								reason: order.cancelReason,
							},
						]
					: []),
			];
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Order timeline</CardTitle>
			</CardHeader>
			<CardContent>
				<ol className="space-y-4">
					{events.map((event, index) => (
						<li
							key={event._id ?? `${event.createdAt}-${index}`}
							className="flex gap-3"
						>
							<CircleDot className="mt-0.5 size-4 shrink-0 text-primary" />
							<div>
								<p className="text-sm font-medium capitalize">
									{event.label ??
										event.action?.replaceAll("_", " ") ??
										event.type?.replaceAll("_", " ")}
								</p>
								<p className="text-xs text-muted-foreground">
									{pacificDateTime(event.createdAt)} PT
									{event.actorName ? ` · ${event.actorName}` : ""}
									{event.reason ? ` · ${event.reason}` : ""}
								</p>
							</div>
						</li>
					))}
				</ol>
			</CardContent>
		</Card>
	);
}
