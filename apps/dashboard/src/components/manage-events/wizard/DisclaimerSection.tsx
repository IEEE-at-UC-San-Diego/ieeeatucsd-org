import { AlertTriangle, CheckCircle2, Clock3, FileCheck2 } from "lucide-react";

const preparationItems = [
	"Confirm your room booking before submitting.",
	"Prepare itemized invoices for any funding request.",
	"Have the event description, attendance estimate, and graphics needs ready.",
];

export function DisclaimerSection() {
	return (
		<div className="space-y-5 pb-2">
			<div>
				<h2 className="text-lg font-semibold tracking-[-0.015em]">
					Before you begin
				</h2>
				<p className="mt-1 text-sm leading-6 text-muted-foreground">
					A complete request helps Operations review your event without delays.
				</p>
			</div>

			<ul className="grid gap-2 sm:grid-cols-3">
				{preparationItems.map((item) => (
					<li
						key={item}
						className="flex items-start gap-2 rounded-md border bg-muted/20 p-3 text-sm leading-5"
					>
						<CheckCircle2 className="mt-0.5 size-4 shrink-0 text-ds-green-700" />
						<span>{item}</span>
					</li>
				))}
			</ul>

			<section
				className="overflow-hidden rounded-md border"
				aria-labelledby="deadline-heading"
			>
				<div className="flex items-start gap-3 border-b bg-ds-amber-100/60 px-4 py-3">
					<Clock3 className="mt-0.5 size-4 shrink-0 text-ds-amber-900" />
					<div>
						<h3 id="deadline-heading" className="font-medium text-ds-amber-900">
							Submission deadlines
						</h3>
						<p className="text-xs leading-5 text-ds-amber-900/80">
							Use the longest deadline that applies and confirm current dates in
							Slack.
						</p>
					</div>
				</div>
				<div className="md:overflow-x-auto">
					{/* Mobile stacked rows */}
					<ul className="divide-y md:hidden">
						<li className="space-y-1 px-4 py-3">
							<p className="text-sm font-medium">AS funding</p>
							<p className="text-sm tabular-nums">
								Submit at least <span className="font-semibold">5 weeks</span>
							</p>
							<p className="text-xs text-muted-foreground">
								Also required: Itemized invoices
							</p>
						</li>
						<li className="space-y-1 px-4 py-3">
							<p className="text-sm font-medium">
								Food or flyers with AS funding
							</p>
							<p className="text-sm tabular-nums">
								Submit at least <span className="font-semibold">7 weeks</span>
							</p>
							<p className="text-xs text-muted-foreground">
								Also required: Confirm with VC Operations
							</p>
						</li>
						<li className="space-y-1 px-4 py-3">
							<p className="text-sm font-medium">
								Food or flyers without AS funding
							</p>
							<p className="text-sm tabular-nums">
								Submit at least <span className="font-semibold">4 weeks</span>
							</p>
							<p className="text-xs text-muted-foreground">
								Also required: Room booking first
							</p>
						</li>
					</ul>
					<table className="hidden w-full min-w-[520px] text-left text-sm md:table">
						<thead className="bg-muted/40 text-xs text-muted-foreground">
							<tr>
								<th className="px-4 py-2 font-medium">Request includes</th>
								<th className="px-4 py-2 font-medium">Submit at least</th>
								<th className="px-4 py-2 font-medium">Also required</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							<tr>
								<td className="px-4 py-2.5">AS funding</td>
								<td className="px-4 py-2.5 font-medium tabular-nums">
									5 weeks
								</td>
								<td className="px-4 py-2.5 text-muted-foreground">
									Itemized invoices
								</td>
							</tr>
							<tr>
								<td className="px-4 py-2.5">Food or flyers with AS funding</td>
								<td className="px-4 py-2.5 font-medium tabular-nums">
									7 weeks
								</td>
								<td className="px-4 py-2.5 text-muted-foreground">
									Confirm with VC Operations
								</td>
							</tr>
							<tr>
								<td className="px-4 py-2.5">
									Food or flyers without AS funding
								</td>
								<td className="px-4 py-2.5 font-medium tabular-nums">
									4 weeks
								</td>
								<td className="px-4 py-2.5 text-muted-foreground">
									Room booking first
								</td>
							</tr>
						</tbody>
					</table>
				</div>
			</section>

			<div className="space-y-2">
				<details className="group rounded-md border bg-background">
					<summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium marker:hidden">
						<FileCheck2 className="size-4 text-muted-foreground" />
						Funding, receipts, and graphics policy
					</summary>
					<div className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
						AS funding is limited to $5,000 per event. Upload itemized invoices,
						use approved vendors, include the AS logo on funded materials, and
						verify any AI-extracted receipt data before submission.
					</div>
				</details>
				<details className="group rounded-md border bg-background">
					<summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-3 font-medium marker:hidden">
						<AlertTriangle className="size-4 text-ds-red-800" />
						Safety, changes, and post-event requirements
					</summary>
					<div className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
						Use approved food vendors and follow university safety policy.
						Notify Operations immediately about cancellations or material
						changes. Upload post-event photos to the shared Drive within 48
						hours.
					</div>
				</details>
			</div>
		</div>
	);
}
