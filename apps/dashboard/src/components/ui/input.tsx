import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
	({ className, type, ...props }, ref) => {
		return (
			<input
				ref={ref}
				type={type}
				data-slot="input"
				className={cn(
					"file:text-foreground placeholder:text-muted-foreground selection:bg-foreground selection:text-background border-input h-10 w-full min-w-0 rounded-[6px] border bg-background px-3 py-1 text-sm transition-[color,background-color,border-color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-ds-gray-100 disabled:text-ds-gray-700",
					"hover:border-[var(--ds-gray-alpha-500)] focus-visible:border-[var(--ds-gray-alpha-600)]",
					"aria-invalid:border-destructive aria-invalid:focus-visible:shadow-[0_0_0_2px_var(--focus-ring-gap),0_0_0_4px_var(--ds-red-800)]",
					className,
				)}
				{...props}
			/>
		);
	},
);
Input.displayName = "Input";

export { Input };
