import { Search } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ConstitutionSearchProps {
	sections: any[];
	onSelectSection: (id: string) => void;
}

const ConstitutionSearch: React.FC<ConstitutionSearchProps> = ({
	sections,
	onSelectSection,
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [showResults, setShowResults] = useState(false);

	const filteredSections = useMemo(() => {
		if (!searchQuery.trim()) return [];

		const query = searchQuery.toLowerCase();
		return sections.filter((section: any) => {
			return (
				section.title?.toLowerCase().includes(query) ||
				section.content?.toLowerCase().includes(query) ||
				section.type?.toLowerCase().includes(query)
			);
		});
	}, [sections, searchQuery]);

	const handleSearch = (value: string) => {
		setSearchQuery(value);
		setShowResults(!!value.trim());
	};

	return (
		<div className="relative">
			<div className="relative">
				<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					type="text"
					placeholder="Search sections..."
					value={searchQuery}
					onChange={(e) => handleSearch(e.target.value)}
					className="pl-10"
					onFocus={() => setShowResults(true)}
				/>
			</div>

			{showResults && filteredSections.length > 0 && (
				<div className="absolute z-10 w-full mt-1 bg-background rounded-md shadow-lg border border-border max-h-64 overflow-y-auto">
					{filteredSections.map((section: any) => (
						<Button
							variant="ghost"
							key={section.id}
							onClick={() => {
								onSelectSection(section.id);
								setSearchQuery("");
								setShowResults(false);
							}}
							className="w-full text-left px-4 py-2 hover:bg-muted text-sm text-foreground border-b border-border last:border-0"
						>
							<div className="font-medium">{section.title || "Untitled"}</div>
							<div className="text-xs text-muted-foreground capitalize">
								{section.type}
							</div>
						</Button>
					))}
				</div>
			)}

			{showResults && searchQuery && filteredSections.length === 0 && (
				<div className="absolute z-10 w-full mt-1 bg-background rounded-md shadow-lg border border-border p-4">
					<div className="text-sm text-muted-foreground text-center">
						No sections found
					</div>
				</div>
			)}
		</div>
	);
};

export default ConstitutionSearch;
