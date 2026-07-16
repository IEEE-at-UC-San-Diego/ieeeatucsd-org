"use client";

import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

interface CheckInModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (code: string, foodPreference?: string) => void;
	eventHasFood: boolean;
	eventName?: string;
	isSubmitting?: boolean;
}

const FOOD_PREFERENCES = [
	{ value: "vegetarian", label: "Vegetarian" },
	{ value: "vegan", label: "Vegan" },
	{ value: "gluten-free", label: "Gluten Free" },
	{ value: "halal", label: "Halal" },
	{ value: "kosher", label: "Kosher" },
	{ value: "no-preference", label: "No Preference" },
];

export function CheckInModal({
	isOpen,
	onClose,
	onSubmit,
	eventHasFood,
	eventName = "this event",
	isSubmitting = false,
}: CheckInModalProps) {
	const [step, setStep] = useState<1 | 2>(1);
	const [code, setCode] = useState("");
	const [foodPreference, setFoodPreference] = useState("");
	const [error, setError] = useState("");

	const handleCodeSubmit = () => {
		if (!code.trim()) {
			setError("Please enter the event code");
			return;
		}
		setError("");
		if (eventHasFood) {
			setStep(2);
		} else {
			onSubmit(code.trim().toUpperCase());
		}
	};

	const handleFoodSubmit = () => {
		onSubmit(code.trim().toUpperCase(), foodPreference || undefined);
	};

	const handleClose = () => {
		onClose();
		setTimeout(() => {
			setStep(1);
			setCode("");
			setFoodPreference("");
			setError("");
		}, 150);
	};

	return (
		<ResponsiveOverlay
			open={isOpen}
			onOpenChange={(open) => {
				if (!open) handleClose();
			}}
			title={step === 1 ? "Enter Event Code" : "Food Preference"}
			description={
				step === 1
					? `Enter the code to check in to ${eventName}`
					: "Select your dietary preference for this event"
			}
			variant="sheet"
			className="sm:max-w-md"
			footer={
				<div className="flex w-full gap-2">
					{step === 2 && (
						<Button
							variant="outline"
							onClick={() => setStep(1)}
							disabled={isSubmitting}
							className="h-11 flex-1 sm:h-9 sm:flex-none"
						>
							Back
						</Button>
					)}
					<Button
						onClick={step === 1 ? handleCodeSubmit : handleFoodSubmit}
						disabled={isSubmitting || (step === 1 && !code.trim())}
						className="h-11 flex-1 sm:h-9"
					>
						{isSubmitting ? (
							<>
								<Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
								Checking in...
							</>
						) : step === 1 ? (
							<>
								Continue
								<ArrowRight className="w-3.5 h-3.5 ml-1.5" />
							</>
						) : (
							<>
								Complete Check-in
								<Check className="w-3.5 h-3.5 ml-1.5" />
							</>
						)}
					</Button>
				</div>
			}
		>
			{step === 1 ? (
				<div className="space-y-3 pb-2">
					<div className="space-y-2">
						<Label
							htmlFor="event-code"
							className="text-xs font-medium text-muted-foreground"
						>
							Event Code
						</Label>
						<Input
							id="event-code"
							placeholder="e.g. IEEE2024"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleCodeSubmit();
							}}
							className="text-center text-lg font-mono tracking-wider uppercase h-12"
							autoFocus
						/>
						{error && <p className="text-xs text-destructive">{error}</p>}
					</div>
				</div>
			) : (
				<div className="space-y-3 pb-2">
					<div className="flex items-center gap-2 rounded-lg border px-3 py-2">
						<div className="w-1.5 h-1.5 rounded-full bg-ds-green-1000" />
						<span className="text-xs font-medium">Code accepted</span>
					</div>
					<div className="space-y-2">
						<Label
							htmlFor="food-preference"
							className="text-xs font-medium text-muted-foreground"
						>
							Dietary Preference (Optional)
						</Label>
						<Select value={foodPreference} onValueChange={setFoodPreference}>
							<SelectTrigger id="food-preference" className="h-11 sm:h-9">
								<SelectValue placeholder="Select your preference" />
							</SelectTrigger>
							<SelectContent>
								{FOOD_PREFERENCES.map((pref) => (
									<SelectItem key={pref.value} value={pref.value}>
										{pref.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<p className="text-[11px] text-muted-foreground">
							This helps us prepare the right amount of food.
						</p>
					</div>
				</div>
			)}
		</ResponsiveOverlay>
	);
}
