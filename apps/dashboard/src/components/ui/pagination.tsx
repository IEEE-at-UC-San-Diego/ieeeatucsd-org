import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PaginationProps {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	className?: string;
}

function Pagination({
	currentPage,
	totalPages,
	onPageChange,
	className,
}: PaginationProps) {
	if (totalPages <= 1) return null;

	const getVisiblePages = () => {
		const pages: (number | "ellipsis")[] = [];
		if (totalPages <= 7) {
			for (let i = 1; i <= totalPages; i++) pages.push(i);
		} else {
			pages.push(1);
			if (currentPage > 3) pages.push("ellipsis");
			const start = Math.max(2, currentPage - 1);
			const end = Math.min(totalPages - 1, currentPage + 1);
			for (let i = start; i <= end; i++) pages.push(i);
			if (currentPage < totalPages - 2) pages.push("ellipsis");
			pages.push(totalPages);
		}
		return pages;
	};

	return (
		<nav
			aria-label="Pagination"
			className={cn("flex items-center justify-center gap-1", className)}
		>
			<Button
				variant="outline"
				size="sm"
				className="h-8 w-8 p-0"
				onClick={() => onPageChange(currentPage - 1)}
				disabled={currentPage <= 1}
				aria-label="Previous Page"
			>
				<ChevronLeft className="h-4 w-4" />
			</Button>
			{getVisiblePages().map((page, i) =>
				page === "ellipsis" ? (
					<span
						key={`ellipsis-${i}`}
						className="flex h-8 w-8 items-center justify-center"
					>
						<MoreHorizontal className="h-4 w-4 text-muted-foreground" />
					</span>
				) : (
					<Button
						key={page}
						variant={currentPage === page ? "default" : "outline"}
						size="sm"
						className="h-8 w-8 p-0 tabular-nums"
						onClick={() => onPageChange(page)}
						aria-label={`Page ${page}`}
						aria-current={currentPage === page ? "page" : undefined}
					>
						{page}
					</Button>
				),
			)}
			<Button
				variant="outline"
				size="sm"
				className="h-8 w-8 p-0"
				onClick={() => onPageChange(currentPage + 1)}
				disabled={currentPage >= totalPages}
				aria-label="Next Page"
			>
				<ChevronRight className="h-4 w-4" />
			</Button>
		</nav>
	);
}

export { Pagination };
