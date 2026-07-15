import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[6px] text-sm font-medium transition-[color,background-color,border-color,box-shadow,opacity,transform] duration-150 ease-[var(--ease-geist)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-ds-gray-100 disabled:text-ds-gray-700 disabled:opacity-100 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-transparent active:scale-[0.97] aria-invalid:ring-destructive/20 aria-invalid:border-destructive",
	{
		variants: {
			variant: {
				default:
					"bg-primary text-primary-foreground hover:bg-ds-gray-900 active:bg-ds-gray-800",
				destructive:
					"bg-destructive text-white hover:bg-ds-red-800/90 focus-visible:shadow-[0_0_0_2px_var(--focus-ring-gap),0_0_0_4px_var(--ds-red-800)]",
				outline:
					"border border-[var(--ds-gray-alpha-400)] bg-background hover:bg-ds-gray-100 hover:border-[var(--ds-gray-alpha-500)] active:bg-ds-gray-200 active:border-[var(--ds-gray-alpha-600)]",
				secondary:
					"border border-[var(--ds-gray-alpha-400)] bg-background text-foreground hover:bg-ds-gray-100 hover:border-[var(--ds-gray-alpha-500)] active:bg-ds-gray-200",
				ghost:
					"text-foreground hover:bg-[var(--ds-gray-alpha-200)] active:bg-[var(--ds-gray-alpha-300)]",
				link: "text-ds-blue-700 underline-offset-4 hover:underline",
			},
			size: {
				default: "h-10 px-2.5 has-[>svg]:px-2",
				xs: "h-6 gap-1 rounded-[6px] px-1.5 text-xs has-[>svg]:px-1 [&_svg:not([class*='size-'])]:size-3",
				sm: "h-8 rounded-[6px] gap-1.5 px-1.5 has-[>svg]:px-1.5",
				lg: "h-12 rounded-[6px] px-3.5 text-base has-[>svg]:px-3",
				icon: "size-10",
				"icon-xs": "size-6 rounded-[6px] [&_svg:not([class*='size-'])]:size-3",
				"icon-sm": "size-8",
				"icon-lg": "size-12",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	},
);

function Button({
	className,
	variant = "default",
	size = "default",
	asChild = false,
	...props
}: React.ComponentProps<"button"> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot.Root : "button";

	return (
		<Comp
			data-slot="button"
			data-variant={variant}
			data-size={size}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
