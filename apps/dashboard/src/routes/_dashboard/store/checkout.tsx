import { api } from "@convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthedMutation, useAuthedQuery } from "@/hooks/useAuthedConvex";
import { prefetchAuthedQuery } from "@/lib/prefetch/prefetch";

export const Route = createFileRoute("/_dashboard/store/checkout")({
	loader: (ctx) => {
		prefetchAuthedQuery(api.merch.cart.getCart, undefined, ctx);
		prefetchAuthedQuery(
			api.merch.checkout.listCompatiblePickupOptions,
			undefined,
			ctx,
		);
	},
	component: StoreCheckoutPage,
});

function StoreCheckoutPage() {
	const navigate = useNavigate();
	const cart = useAuthedQuery(api.merch.cart.getCart);
	const pickupOptions = useAuthedQuery(
		api.merch.checkout.listCompatiblePickupOptions,
	);
	const confirmCheckout = useAuthedMutation(api.merch.checkout.confirmCheckout);
	const publishedPolicy = useAuthedQuery(api.merch.policies.getPublished);
	const acceptPolicy = useAuthedMutation(api.merch.policies.accept);

	const [pickupOptionId, setPickupOptionId] = useState("");
	const [acceptRevised, setAcceptRevised] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [acceptingPolicy, setAcceptingPolicy] = useState(false);

	const validation = useAuthedQuery(
		api.merch.checkout.validateCheckout,
		pickupOptionId ? { pickupOptionId } : "skip",
	);

	const selectedPickup = useMemo(
		() => pickupOptions?.find((p) => p.pickupOptionId === pickupOptionId),
		[pickupOptions, pickupOptionId],
	);

	if (cart === undefined || pickupOptions === undefined) {
		return (
			<div className="p-8 space-y-4 max-w-3xl mx-auto">
				<Skeleton className="h-10 w-56" />
				<Skeleton className="h-64 w-full" />
			</div>
		);
	}

	if (cart.items.length === 0) {
		return (
			<div className="flex-1 flex items-center justify-center min-h-[60vh] bg-[#F8F9FB]">
				<div className="text-center space-y-3">
					<p className="text-muted-foreground">Your cart is empty.</p>
					<Link to="/store/cart">
						<Button variant="outline">Back to cart</Button>
					</Link>
				</div>
			</div>
		);
	}

	const storeDisabled = validation ? validation.storeEnabled === false : false;
	const needsPolicyAcceptance = Boolean(
		validation &&
			!validation.policyAccepted &&
			validation.publishedPolicyVersion,
	);

	const handleAcceptPolicy = async () => {
		if (!validation?.publishedPolicyVersion) return;
		setAcceptingPolicy(true);
		try {
			await acceptPolicy({ policyVersion: validation.publishedPolicyVersion });
			toast.success("Policy accepted");
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Failed to accept policy",
			);
		} finally {
			setAcceptingPolicy(false);
		}
	};

	const canSubmit =
		pickupOptionId &&
		validation &&
		validation.validLines.length > 0 &&
		!validation.insufficientPoints &&
		!storeDisabled &&
		!needsPolicyAcceptance &&
		(validation.ready || (validation.requiresConfirmation && acceptRevised));

	const handleConfirm = async () => {
		if (!pickupOptionId) {
			toast.error("Select a pickup option");
			return;
		}

		setSubmitting(true);
		try {
			const result = await confirmCheckout({
				pickupOptionId,
				idempotencyKey: `checkout:${crypto.randomUUID()}`,
				acceptRevisedOrder: acceptRevised || undefined,
			});
			toast.success(`Order ${result.displayNumber} confirmed`);
			await navigate({
				to: "/store/orders/$orderId",
				params: { orderId: result.orderId },
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Checkout failed");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<div className="flex-1 overflow-auto bg-[#F8F9FB] min-h-screen">
			<main className="max-w-3xl mx-auto px-5 py-10 space-y-8">
				<div>
					<h1 className="text-[34px] font-bold tracking-[-0.5px] text-gray-900">
						Checkout
					</h1>
					<p className="text-muted-foreground mt-1">
						Choose pickup and confirm your points-only order.
					</p>
				</div>

				<div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
					<div className="flex items-center gap-2">
						<MapPin className="h-4 w-4 text-muted-foreground" />
						<h2 className="font-semibold">Pickup</h2>
					</div>
					{pickupOptions.length === 0 ? (
						<p className="text-sm text-muted-foreground">
							No compatible pickup options are available for your cart.
						</p>
					) : (
						<div className="space-y-2">
							<Label htmlFor="pickup">Pickup option</Label>
							<Select value={pickupOptionId} onValueChange={setPickupOptionId}>
								<SelectTrigger id="pickup">
									<SelectValue placeholder="Select pickup" />
								</SelectTrigger>
								<SelectContent>
									{pickupOptions.map((option) => (
										<SelectItem
											key={option.pickupOptionId}
											value={option.pickupOptionId}
										>
											{option.label} · cutoff{" "}
											{new Date(option.cutoffAt).toLocaleString()}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedPickup && (
								<p className="text-xs text-muted-foreground">
									Cutoff: {new Date(selectedPickup.cutoffAt).toLocaleString()}
								</p>
							)}
						</div>
					)}
				</div>

				<div className="rounded-xl border bg-white p-5 shadow-sm space-y-4">
					<h2 className="font-semibold">Order summary</h2>
					<ul className="divide-y">
						{cart.items.map((item) => (
							<li
								key={item.variantId}
								className="py-3 flex justify-between gap-4 text-sm"
							>
								<div>
									<p className="font-medium">{item.productName}</p>
									<p className="text-muted-foreground">
										{item.variantLabel} × {item.quantity}
									</p>
								</div>
								<p className="font-semibold tabular-nums shrink-0">
									{item.lineTotal} pts
								</p>
							</li>
						))}
					</ul>
					<div className="flex justify-between font-bold text-lg pt-2 border-t">
						<span>Total</span>
						<span className="tabular-nums">{cart.pointTotal} pts</span>
					</div>
				</div>

				{storeDisabled && (
					<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex gap-2">
						<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
						<p>
							The merch store is not currently open for checkout. Orders cannot
							be placed yet.
						</p>
					</div>
				)}

				{needsPolicyAcceptance && (
					<div className="rounded-xl border bg-white p-5 shadow-sm space-y-3">
						<h2 className="font-semibold">Merch store policy</h2>
						<div className="max-h-60 overflow-auto rounded-md border bg-gray-50 p-3 text-sm whitespace-pre-line">
							{publishedPolicy?.content ?? "Loading policy…"}
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input
								type="checkbox"
								checked={false}
								disabled={acceptingPolicy || !publishedPolicy}
								onChange={handleAcceptPolicy}
							/>
							I have read and accept the merch store policy (v
							{validation?.publishedPolicyVersion}).
						</label>
					</div>
				)}

				{validation && pickupOptionId && (
					<div className="space-y-3">
						{validation.insufficientPoints && (
							<div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex gap-2">
								<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
								<p>
									Insufficient spendable points. You have{" "}
									{validation.spendablePoints} pts but need{" "}
									{validation.pointTotal} pts.
								</p>
							</div>
						)}

						{validation.requiresConfirmation && (
							<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
								<div className="flex gap-2 text-sm text-amber-900">
									<AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
									<div>
										<p className="font-medium">Order changes required</p>
										<ul className="mt-2 space-y-1 list-disc pl-4">
											{validation.issues.map((issue, index) => (
												<li key={`${issue.code}-${index}`}>{issue.message}</li>
											))}
										</ul>
									</div>
								</div>
								<label className="flex items-center gap-2 text-sm">
									<input
										type="checkbox"
										checked={acceptRevised}
										onChange={(e) => setAcceptRevised(e.target.checked)}
									/>
									Confirm revised order ({validation.pointTotal} pts)
								</label>
							</div>
						)}

						{validation.ready && (
							<div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex gap-2">
								<CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
								<p>Ready to checkout for {validation.pointTotal} pts.</p>
							</div>
						)}
					</div>
				)}

				<div className="flex flex-col sm:flex-row gap-3 sm:justify-between">
					<Link to="/store/cart">
						<Button variant="outline">Back to cart</Button>
					</Link>
					<Button disabled={!canSubmit || submitting} onClick={handleConfirm}>
						{submitting ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Confirming…
							</>
						) : (
							"Confirm order"
						)}
					</Button>
				</div>
			</main>
		</div>
	);
}
