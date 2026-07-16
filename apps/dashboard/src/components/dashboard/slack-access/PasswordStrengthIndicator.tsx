import { Check } from "lucide-react";
import type { PasswordValidation } from "./types";

interface PasswordStrengthIndicatorProps {
	validation: PasswordValidation;
}

export function PasswordStrengthIndicator({
	validation,
}: PasswordStrengthIndicatorProps) {
	const getStrengthColor = (strength: number) => {
		if (strength <= 2) return "bg-ds-red-800";
		if (strength <= 3) return "bg-ds-amber-700";
		if (strength <= 4) return "bg-ds-blue-700";
		return "bg-ds-green-700";
	};

	const getStrengthText = (strength: number) => {
		if (strength <= 2) return "Weak";
		if (strength <= 3) return "Fair";
		if (strength <= 4) return "Good";
		return "Strong";
	};

	return (
		<div className="mt-2 space-y-2">
			{/* Strength Bar */}
			<div className="flex items-center space-x-2">
				<div className="flex-1 bg-muted rounded-full h-2">
					<div
						className={`h-2 rounded-full transition-colors duration-150 ease-[ease] ${getStrengthColor(validation.strength)}`}
						style={{ width: `${(validation.strength / 5) * 100}%` }}
					/>
				</div>
				<span
					className={`text-xs font-medium ${validation.strength <= 2 ? "text-tone-danger" : validation.strength <= 3 ? "text-tone-warning" : validation.strength <= 4 ? "text-tone-info" : "text-tone-success"}`}
				>
					{getStrengthText(validation.strength)}
				</span>
			</div>

			{/* Requirements List */}
			<div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
				<div
					className={`flex items-center space-x-1 ${validation.requirements.minLength ? "text-tone-success" : "text-muted-foreground"}`}
				>
					<Check
						className={`w-3 h-3 ${validation.requirements.minLength ? "text-tone-success" : "text-muted-foreground"}`}
					/>
					<span>8+ characters</span>
				</div>
				<div
					className={`flex items-center space-x-1 ${validation.requirements.hasUppercase ? "text-tone-success" : "text-muted-foreground"}`}
				>
					<Check
						className={`w-3 h-3 ${validation.requirements.hasUppercase ? "text-tone-success" : "text-muted-foreground"}`}
					/>
					<span>Uppercase letter</span>
				</div>
				<div
					className={`flex items-center space-x-1 ${validation.requirements.hasLowercase ? "text-tone-success" : "text-muted-foreground"}`}
				>
					<Check
						className={`w-3 h-3 ${validation.requirements.hasLowercase ? "text-tone-success" : "text-muted-foreground"}`}
					/>
					<span>Lowercase letter</span>
				</div>
				<div
					className={`flex items-center space-x-1 ${validation.requirements.hasNumber ? "text-tone-success" : "text-muted-foreground"}`}
				>
					<Check
						className={`w-3 h-3 ${validation.requirements.hasNumber ? "text-tone-success" : "text-muted-foreground"}`}
					/>
					<span>Number</span>
				</div>
				<div
					className={`flex items-center space-x-1 ${validation.requirements.hasSpecialChar ? "text-tone-success" : "text-muted-foreground"}`}
				>
					<Check
						className={`w-3 h-3 ${validation.requirements.hasSpecialChar ? "text-tone-success" : "text-muted-foreground"}`}
					/>
					<span>Special character</span>
				</div>
			</div>
		</div>
	);
}
