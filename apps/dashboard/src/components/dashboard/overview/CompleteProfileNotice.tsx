import { Link } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CompleteProfileNotice() {
	return (
		<section className="flex flex-col gap-4 rounded-[6px] border border-ds-amber-400 bg-ds-amber-100 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
			<div className="flex items-start gap-3">
				<AlertCircle className="mt-0.5 size-4 shrink-0 text-tone-warning" />
				<div className="space-y-1">
					<h2 className="text-sm font-semibold leading-5 text-foreground">
						Finish setting up your profile
					</h2>
					<p className="max-w-prose text-xs leading-5 text-pretty text-muted-foreground">
						Complete your account to unlock event check-ins, points, and
						reimbursements.
					</p>
				</div>
			</div>
			<Button asChild size="sm" className="w-full px-3 sm:w-auto">
				<Link to="/get-started">Finish setup</Link>
			</Button>
		</section>
	);
}
