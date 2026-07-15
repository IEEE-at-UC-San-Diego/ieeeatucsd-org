import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
	return (
		<textarea
			data-slot="textarea"
			className={cn(
				"border-input placeholder:text-muted-foreground aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-[6px] border bg-background px-3 py-2 text-sm transition-[color,background-color,border-color,box-shadow] outline-none hover:border-[var(--ds-gray-alpha-500)] disabled:cursor-not-allowed disabled:bg-ds-gray-100 disabled:text-ds-gray-700",
				className,
			)}
			{...props}
		/>
	);
}

export { Textarea };
