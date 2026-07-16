import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
	{
		value: "system",
		label: "System",
		description: "Match your device",
		icon: Monitor,
	},
	{
		value: "light",
		label: "Light",
		description: "Always light",
		icon: Sun,
	},
	{
		value: "dark",
		label: "Dark",
		description: "Always dark",
		icon: Moon,
	},
] as const;

type ThemeValue = (typeof OPTIONS)[number]["value"];

export function AppearancePicker() {
	const { theme, setTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const active = (mounted ? theme : "system") as ThemeValue;

	return (
		<div
			className="grid grid-cols-1 gap-2 sm:grid-cols-3"
			role="radiogroup"
			aria-label="Appearance"
		>
			{OPTIONS.map(({ value, label, description, icon: Icon }) => {
				const selected = active === value;
				return (
					<button
						key={value}
						type="button"
						role="radio"
						aria-checked={selected}
						onClick={() => setTheme(value)}
						className={cn(
							"motion-press group relative flex flex-col items-start gap-3 rounded-md border p-3 text-left transition-[background-color,border-color,box-shadow] duration-150 ease-[var(--ease-geist)]",
							"hover:bg-ds-gray-100",
							"focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--focus-ring-gap),0_0_0_4px_var(--ring)]",
							selected
								? "border-ds-gray-1000 bg-ds-gray-100 shadow-raised"
								: "border-border bg-background",
						)}
					>
						<div
							className={cn(
								"flex h-9 w-9 items-center justify-center rounded-[6px] border transition-colors",
								selected
									? "border-ds-gray-1000 bg-primary text-primary-foreground"
									: "border-border bg-muted text-muted-foreground group-hover:text-foreground",
							)}
						>
							<Icon className="h-4 w-4" aria-hidden />
						</div>
						<div className="min-w-0 space-y-0.5">
							<p className="text-sm font-medium leading-none">{label}</p>
							<p className="text-xs text-muted-foreground">{description}</p>
						</div>
						<span
							className={cn(
								"absolute right-3 top-3 h-2 w-2 rounded-full transition-opacity",
								selected ? "bg-ds-blue-700 opacity-100" : "opacity-0",
							)}
							aria-hidden
						/>
					</button>
				);
			})}
		</div>
	);
}
