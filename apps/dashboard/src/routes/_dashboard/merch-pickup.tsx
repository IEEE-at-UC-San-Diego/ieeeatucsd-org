import { api } from "@convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
	AlertCircle,
	Camera,
	CameraOff,
	CheckCircle2,
	CircleSlash2,
	Keyboard,
	Loader2,
	Pause,
	Play,
	RefreshCw,
	ScanLine,
	ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { pacificDateTime } from "@/components/dashboard/merch/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { usePermissions } from "@/hooks/usePermissions";

export const Route = createFileRoute("/_dashboard/merch-pickup")({
	component: MerchPickupPage,
});

type ScanState = "idle" | "scanning" | "paused";
type ResultState =
	| "success"
	| "already_fulfilled"
	| "canceled"
	| "invalid"
	| "unauthorized"
	| "network"
	| "pickup_mismatch";

function MerchPickupPage() {
	const { hasOfficerAccess, isLoading } = usePermissions();
	const [token, setToken] = useState("");
	const [lookupToken, setLookupToken] = useState("");
	const [scanState, setScanState] = useState<ScanState>("idle");
	const [cameraId, setCameraId] = useState("");
	const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
	const [cameraError, setCameraError] = useState("");
	const [result, setResult] = useState<{
		state: ResultState;
		message: string;
	}>();
	const [confirming, setConfirming] = useState(false);
	const videoRef = useRef<HTMLVideoElement>(null);
	const streamRef = useRef<MediaStream | undefined>(undefined);
	const scanStateRef = useRef<ScanState>("idle");
	const previewResult = useAuthedQuery(
		api.merchFulfillment.previewByToken,
		lookupToken ? { token: lookupToken } : "skip",
	);
	const confirm = useAuthedMutation(api.merchFulfillment.confirm);
	const preview = previewResult;

	useEffect(() => {
		scanStateRef.current = scanState;
	}, [scanState]);
	const stopCamera = useCallback(() => {
		streamRef.current?.getTracks().forEach((track) => track.stop());
		streamRef.current = undefined;
		if (videoRef.current) videoRef.current.srcObject = null;
		scanStateRef.current = "idle";
		setScanState("idle");
	}, []);
	useEffect(() => stopCamera, [stopCamera]);

	const acceptCode = useCallback((value: string) => {
		const clean = value.trim();
		if (!clean) return;
		setLookupToken(clean);
		setToken(clean);
		setResult(undefined);
		scanStateRef.current = "paused";
		setScanState("paused");
	}, []);

	const startCamera = async (requestedCameraId?: string) => {
		setCameraError("");
		setResult(undefined);
		try {
			if (!("BarcodeDetector" in window))
				throw new Error(
					"This browser does not support QR detection. Use manual code entry below.",
				);
			streamRef.current?.getTracks().forEach((track) => track.stop());
			const deviceId = requestedCameraId ?? cameraId;
			const stream = await navigator.mediaDevices.getUserMedia({
				video: deviceId
					? { deviceId: { exact: deviceId } }
					: { facingMode: { ideal: "environment" } },
				audio: false,
			});
			streamRef.current = stream;
			if (videoRef.current) {
				videoRef.current.srcObject = stream;
				await videoRef.current.play();
			}
			const devices = (await navigator.mediaDevices.enumerateDevices()).filter(
				(device) => device.kind === "videoinput",
			);
			setCameras(devices);
			if (!cameraId)
				setCameraId(
					stream.getVideoTracks()[0]?.getSettings().deviceId ??
						devices[0]?.deviceId ??
						"",
				);
			scanStateRef.current = "scanning";
			setScanState("scanning");
			const Detector = (window as any).BarcodeDetector;
			const detector = new Detector({ formats: ["qr_code"] });
			const detect = async () => {
				if (!videoRef.current || !streamRef.current) return;
				if (
					scanStateRef.current === "scanning" &&
					videoRef.current.readyState >= 2
				) {
					try {
						const codes = await detector.detect(videoRef.current);
						if (codes[0]?.rawValue) acceptCode(codes[0].rawValue);
					} catch {
						/* transient frames can fail */
					}
				}
				if (streamRef.current) requestAnimationFrame(detect);
			};
			requestAnimationFrame(detect);
		} catch (error: any) {
			setCameraError(
				error?.name === "NotAllowedError"
					? "Camera permission was denied. You can still enter the pickup code manually."
					: (error?.message ?? "Could not start the camera."),
			);
			stopCamera();
		}
	};

	const submitManual = (event: React.FormEvent) => {
		event.preventDefault();
		acceptCode(token);
	};
	const reset = () => {
		const next = streamRef.current ? "scanning" : "idle";
		setLookupToken("");
		setToken("");
		setResult(undefined);
		scanStateRef.current = next;
		setScanState(next);
	};

	const confirmPickup = async () => {
		if (!preview?.orderId || confirming) return;
		setConfirming(true);
		try {
			const response = await confirm({
				token: lookupToken,
				orderId: preview.orderId,
				requestId: crypto.randomUUID(),
			});
			if (response.result === "canceled") {
				setResult({
					state: "canceled",
					message: `This order was canceled${response.cancellationReason ? `: ${response.cancellationReason}` : "."} Do not hand out merchandise.`,
				});
				return;
			}
			const already = response.result === "already_fulfilled";
			setResult({
				state: already ? "already_fulfilled" : "success",
				message: already
					? `This order was already fulfilled${response.fulfilledByName ? ` by ${response.fulfilledByName}` : ""}${response.fulfilledAt ? ` on ${pacificDateTime(response.fulfilledAt)} PT` : ""}.`
					: "Pickup confirmed. The order is now fulfilled.",
			});
			toast.success(
				already ? "Order was already fulfilled" : "Pickup confirmed",
			);
		} catch (error: any) {
			const code = error?.data?.code ?? error?.code;
			const state: ResultState =
				code === "CANCELED"
					? "canceled"
					: code === "UNAUTHORIZED"
						? "unauthorized"
						: code === "PICKUP_MISMATCH"
							? "pickup_mismatch"
							: code === "INVALID_TOKEN" || code === "NOT_FOUND"
								? "invalid"
								: "network";
			setResult({
				state,
				message:
					error?.data?.message ??
					error?.message ??
					"The server did not confirm fulfillment. The order has not been changed.",
			});
		} finally {
			setConfirming(false);
		}
	};

	if (isLoading)
		return (
			<div className="flex min-h-[60vh] items-center justify-center">
				<Loader2 className="size-8 animate-spin" />
			</div>
		);
	if (!hasOfficerAccess)
		return (
			<Dialog open>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Access denied</DialogTitle>
						<DialogDescription>
							Merch pickup is available to General Officers, Executive Officers,
							and Administrators.
						</DialogDescription>
					</DialogHeader>
				</DialogContent>
			</Dialog>
		);

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<div>
				<h1 className="text-3xl font-bold tracking-tight">Merch Pickup</h1>
				<p className="text-muted-foreground">
					Scan, verify, then explicitly confirm. Scanning never fulfills an
					order by itself.
				</p>
			</div>
			<div className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="flex items-center gap-2">
								<ScanLine className="size-5" /> Scanner
							</CardTitle>
							{scanState !== "idle" && (
								<Badge variant="outline" className="capitalize">
									{scanState}
								</Badge>
							)}
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="relative aspect-video overflow-hidden rounded-lg bg-slate-950">
							<video
								ref={videoRef}
								muted
								playsInline
								className="size-full object-cover"
							/>
							{scanState === "idle" && (
								<div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300">
									<Camera className="mb-2 size-12" />
									<p className="text-sm">Camera is off</p>
								</div>
							)}
							{scanState !== "idle" && (
								<div className="pointer-events-none absolute inset-[15%] rounded-xl border-2 border-white/80 shadow-[0_0_0_999px_rgb(0_0_0/.25)]" />
							)}
						</div>
						{cameraError && (
							<div className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
								<AlertCircle className="mt-0.5 size-4 shrink-0" />
								<p>{cameraError}</p>
							</div>
						)}
						<div className="flex flex-wrap gap-2">
							{scanState === "idle" ? (
								<Button onClick={() => startCamera()}>
									<Camera className="size-4" />
									Start camera
								</Button>
							) : (
								<>
									<Button
										variant="outline"
										onClick={() => {
											const next =
												scanState === "scanning" ? "paused" : "scanning";
											scanStateRef.current = next;
											setScanState(next);
										}}
									>
										{scanState === "scanning" ? (
											<>
												<Pause />
												Pause
											</>
										) : (
											<>
												<Play />
												Resume
											</>
										)}
									</Button>
									<Button variant="outline" onClick={stopCamera}>
										<CameraOff />
										Stop
									</Button>
								</>
							)}
							{cameras.length > 1 && (
								<Select
									value={cameraId}
									onValueChange={(value) => {
										setCameraId(value);
										void startCamera(value);
									}}
								>
									<SelectTrigger className="min-w-48">
										<SelectValue placeholder="Choose camera" />
									</SelectTrigger>
									<SelectContent>
										{cameras.map((camera, index) => (
											<SelectItem key={camera.deviceId} value={camera.deviceId}>
												{camera.label || `Camera ${index + 1}`}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)}
						</div>
						<Separator />
						<form onSubmit={submitManual} className="space-y-2">
							<Label htmlFor="manual-code" className="flex items-center gap-2">
								<Keyboard className="size-4" />
								Manual fallback code
							</Label>
							<div className="flex gap-2">
								<Input
									id="manual-code"
									value={token}
									onChange={(event) =>
										setToken(event.target.value.toUpperCase())
									}
									placeholder="Enter the code below the QR"
									autoComplete="off"
									spellCheck={false}
									className="font-mono"
								/>
								<Button type="submit" disabled={!token.trim()}>
									Preview
								</Button>
							</div>
						</form>
					</CardContent>
				</Card>
				<div>
					{lookupToken ? (
						previewResult === undefined ? (
							<Card>
								<CardContent className="flex h-64 items-center justify-center">
									<Loader2 className="size-7 animate-spin text-primary" />
								</CardContent>
							</Card>
						) : preview?.orderId ? (
							<PickupPreview
								order={preview as FulfillmentPreview}
								result={result}
								confirming={confirming}
								onConfirm={confirmPickup}
								onReset={reset}
							/>
						) : (
							<ResultCard
								state="invalid"
								message="No order matches this pickup code."
								onReset={reset}
							/>
						)
					) : (
						<Card>
							<CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
								<CircleSlash2 className="mb-3 size-10 text-muted-foreground" />
								<p className="font-semibold">Waiting for a code</p>
								<p className="text-sm text-muted-foreground">
									An order preview will appear here. Verify the member and every
									item before confirming pickup.
								</p>
							</CardContent>
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}

type FulfillmentPreview = {
	orderId: import("@convex/_generated/dataModel").Id<"merchOrders">;
	orderNumber: string;
	memberName: string;
	items: Array<{
		productName: string;
		variantName: string;
		sku: string;
		quantity: number;
	}>;
	status: "pending" | "fulfilled" | "canceled";
	pickupSnapshot: {
		label: string;
		address: string;
		startAt: number;
		endAt: number;
	};
	pickupMismatch: boolean;
	fulfilledAt?: number;
	fulfilledByName?: string;
};

function PickupPreview({
	order,
	result,
	confirming,
	onConfirm,
	onReset,
}: {
	order: FulfillmentPreview;
	result?: { state: ResultState; message: string };
	confirming: boolean;
	onConfirm: () => void;
	onReset: () => void;
}) {
	if (result) return <ResultCard {...result} onReset={onReset} />;
	if (order.status === "fulfilled")
		return (
			<ResultCard
				state="already_fulfilled"
				message={`This order was already fulfilled${order.fulfilledByName ? ` by ${order.fulfilledByName}` : ""}${order.fulfilledAt ? ` on ${pacificDateTime(order.fulfilledAt)} PT` : ""}. Do not hand out merchandise again.`}
				onReset={onReset}
			/>
		);
	if (order.status === "canceled")
		return (
			<ResultCard
				state="canceled"
				message="This order was canceled and refunded. Do not hand out merchandise."
				onReset={onReset}
			/>
		);
	const pickup = order.pickupSnapshot;
	return (
		<Card>
			<CardHeader>
				<div className="flex justify-between gap-2">
					<div>
						<p className="text-sm text-muted-foreground">Verify order</p>
						<CardTitle>{order.orderNumber}</CardTitle>
					</div>
					<Badge>Pending</Badge>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="rounded-lg bg-primary/5 p-4">
					<p className="text-xs uppercase tracking-wide text-muted-foreground">
						Member
					</p>
					<p className="text-xl font-semibold">{order.memberName}</p>
				</div>
				<div>
					<p className="mb-2 text-sm font-semibold">Items to hand out</p>
					<div className="space-y-2">
						{order.items.map((line, index) => (
							<div
								key={`${line.sku}-${index}`}
								className="flex justify-between rounded-md border p-3"
							>
								<div>
									<p className="font-medium">{line.productName}</p>
									<p className="text-sm text-muted-foreground">
										{line.variantName ?? line.sku}
									</p>
								</div>
								<Badge variant="secondary" className="h-fit text-base">
									×{line.quantity}
								</Badge>
							</div>
						))}
					</div>
				</div>
				<div className="text-sm">
					<p className="font-semibold">Expected pickup</p>
					<p>{pickup.label}</p>
					<p>
						{pacificDateTime(pickup.startAt)} PT · {pickup.address}
					</p>
					{order.pickupMismatch && (
						<div className="mt-2 flex gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-amber-900">
							<AlertCircle className="mt-0.5 size-4 shrink-0" />
							This is outside the expected pickup time. Verify with a manager
							before fulfilling.
						</div>
					)}
				</div>
				<Separator />
				<div className="flex gap-2">
					<Button variant="outline" className="flex-1" onClick={onReset}>
						Scan another
					</Button>
					<Button className="flex-1" onClick={onConfirm} disabled={confirming}>
						{confirming ? (
							<>
								<Loader2 className="animate-spin" />
								Confirming…
							</>
						) : (
							<>
								<CheckCircle2 />
								Confirm pickup
							</>
						)}
					</Button>
				</div>
				<p className="text-center text-xs text-muted-foreground">
					Only a successful server response marks this order fulfilled.
				</p>
			</CardContent>
		</Card>
	);
}

function ResultCard({
	state,
	message,
	onReset,
}: {
	state: ResultState;
	message: string;
	onReset: () => void;
}) {
	const config =
		state === "success"
			? {
					icon: CheckCircle2,
					title: "Pickup confirmed",
					color: "text-green-700",
					bg: "bg-green-50 border-green-300",
				}
			: state === "already_fulfilled"
				? {
						icon: AlertCircle,
						title: "Already fulfilled",
						color: "text-amber-700",
						bg: "bg-amber-50 border-amber-300",
					}
				: state === "unauthorized"
					? {
							icon: ShieldAlert,
							title: "Not authorized",
							color: "text-destructive",
							bg: "bg-destructive/5 border-destructive/30",
						}
					: state === "pickup_mismatch"
						? {
								icon: AlertCircle,
								title: "Wrong pickup",
								color: "text-amber-700",
								bg: "bg-amber-50 border-amber-300",
							}
						: state === "network"
							? {
									icon: RefreshCw,
									title: "Server not confirmed",
									color: "text-destructive",
									bg: "bg-destructive/5 border-destructive/30",
								}
							: {
									icon: CircleSlash2,
									title:
										state === "canceled" ? "Order canceled" : "Invalid code",
									color: "text-destructive",
									bg: "bg-destructive/5 border-destructive/30",
								};
	const Icon = config.icon;
	return (
		<Card className={config.bg}>
			<CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
				<Icon className={`mb-3 size-12 ${config.color}`} />
				<p className="text-xl font-semibold">{config.title}</p>
				<p className="mt-2 max-w-sm text-sm">{message}</p>
				{state === "network" && (
					<p className="mt-3 text-xs font-semibold">
						No fulfillment is claimed without a confirmed response.
					</p>
				)}
				<Button className="mt-6" variant="outline" onClick={onReset}>
					<ScanLine />
					Scan another order
				</Button>
			</CardContent>
		</Card>
	);
}
