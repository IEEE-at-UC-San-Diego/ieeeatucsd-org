import {
	ArrowDown,
	ArrowUp,
	ChevronDown,
	ChevronRight,
	FileText,
	Plus,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { ResponsiveOverlay } from "@/components/mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConstitutionSection } from "./types";
import { getSectionDisplayTitle } from "./utils/constitutionUtils";

interface ConstitutionSidebarProps {
	sections: ConstitutionSection[];
	selectedSection: string | null;
	expandedSections: Set<string>;
	onSelectSection: (id: string) => void;
	onToggleExpand: (id: string) => void;
	onAddSection: (
		type: ConstitutionSection["type"],
		parentId?: string,
		title?: string,
		content?: string,
	) => void;
	updateSection: (
		sectionId: string,
		updates: Partial<ConstitutionSection>,
	) => void;
}

const ConstitutionSidebar: React.FC<ConstitutionSidebarProps> = ({
	sections,
	selectedSection,
	expandedSections,
	onSelectSection,
	onToggleExpand,
	onAddSection,
	updateSection,
}) => {
	const [showAddSection, setShowAddSection] = useState(false);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const selectedSectionRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	const [addSectionType, setAddSectionType] =
		useState<ConstitutionSection["type"]>("article");
	const [addSectionParent, setAddSectionParent] = useState("");
	const [addSectionTitle, setAddSectionTitle] = useState("");
	const [addSectionContent, setAddSectionContent] = useState("");

	// Auto-scroll to selected section
	useEffect(() => {
		if (selectedSection && scrollContainerRef.current) {
			const selectedElement = selectedSectionRefs.current.get(selectedSection);
			if (selectedElement) {
				selectedElement.scrollIntoView({
					behavior: "smooth",
					block: "center",
				});
			}
		}
	}, [selectedSection]);

	const moveSection = async (sectionId: string, direction: "up" | "down") => {
		const currentSection = sections.find((s) => s.id === sectionId);
		if (!currentSection) return;

		const siblings = sections
			.filter((s) =>
				currentSection.parentId
					? s.parentId === currentSection.parentId
					: !s.parentId,
			)
			.sort((a, b) => a.order - b.order);

		const currentIndex = siblings.findIndex((s) => s.id === sectionId);
		if (currentIndex === -1) return;

		const newIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
		if (newIndex < 0 || newIndex >= siblings.length) return;

		const targetSection = siblings[newIndex];

		await Promise.all([
			updateSection(currentSection.id, { order: targetSection.order }),
			updateSection(targetSection.id, { order: currentSection.order }),
		]);
	};

	const handleAddSection = () => {
		onAddSection(
			addSectionType,
			addSectionParent || undefined,
			addSectionTitle || undefined,
			addSectionContent || undefined,
		);
		setShowAddSection(false);
		setAddSectionTitle("");
		setAddSectionContent("");
		setAddSectionParent("");
	};

	const handleTypeChange = (newType: ConstitutionSection["type"]) => {
		setAddSectionType(newType);
		if (newType === "article") {
			setAddSectionContent("");
		}
		if (newType === "preamble") {
			setAddSectionTitle("");
		}
	};

	const parentOptions = sections.filter((s) => {
		if (addSectionType === "section") {
			return s.type === "article";
		}
		if (addSectionType === "subsection") {
			return s.type === "section" || s.type === "subsection";
		}
		return false;
	});

	const renderSectionHierarchy = (
		allSections: ConstitutionSection[],
		parentId: string | null,
	): React.ReactNode => {
		const childSections = allSections
			.filter((s) =>
				parentId === null ? !s.parentId : s.parentId === parentId,
			)
			.sort((a, b) => a.order - b.order);

		return (
			<>
				{childSections.map((section, index) => {
					const isExpanded = expandedSections.has(section.id);
					const hasChildren = allSections.some(
						(s) => s.parentId === section.id,
					);

					return (
						<div key={section.id}>
							<SectionNavigationItem
								section={section}
								isSelected={selectedSection === section.id}
								isExpanded={isExpanded}
								onSelect={onSelectSection}
								onToggleExpand={onToggleExpand}
								allSections={sections}
								onMoveUp={() => moveSection(section.id, "up")}
								onMoveDown={() => moveSection(section.id, "down")}
								canMoveUp={index > 0}
								canMoveDown={index < childSections.length - 1}
								sectionRefs={selectedSectionRefs}
							/>
							{hasChildren && isExpanded && (
								<div className="ml-4">
									{renderSectionHierarchy(allSections, section.id)}
								</div>
							)}
						</div>
					);
				})}
			</>
		);
	};

	return (
		<div className="flex flex-col">
			<div className="bg-background rounded-lg border border-border flex flex-col max-h-[500px] md:max-h-[450px] lg:max-h-[600px] min-h-[350px]">
				<div className="flex flex-col gap-3 p-3 md:p-4 border-b border-border flex-shrink-0">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 md:gap-3">
						<div className="min-w-0 flex-1">
							<h2 className="font-semibold text-foreground text-sm md:text-base">
								Document Structure
							</h2>
							<p className="text-xs text-muted-foreground hidden md:block">
								Adopted since September 2006
							</p>
						</div>
						<Button
							onClick={() => setShowAddSection(true)}
							className="lg:hidden inline-flex items-center justify-center px-2 md:px-3 py-2 bg-ds-blue-700 text-white rounded-md hover:bg-ds-blue-800 transition-colors text-sm shadow-sm min-h-[40px] md:min-h-[44px] w-full sm:w-auto"
						>
							<Plus className="h-4 w-4 mr-1" />
							<span className="hidden sm:inline">Add Section</span>
							<span className="sm:hidden">Add</span>
						</Button>
					</div>

					<div className="hidden lg:block">
						<Button
							onClick={() => setShowAddSection(true)}
							className="w-full inline-flex items-center justify-center px-4 py-2.5 bg-ds-blue-700 text-white rounded-md hover:bg-ds-blue-800 transition-colors text-sm font-medium shadow-sm min-h-[44px]"
						>
							<Plus className="h-4 w-4 mr-2" />
							Add Block
						</Button>
					</div>
				</div>

				<div
					ref={scrollContainerRef}
					className="flex-1 overflow-y-auto p-3 md:p-4 constitution-sidebar-scroll"
				>
					{sections.length === 0 ? (
						<div className="text-center py-6 md:py-8">
							<FileText className="h-10 w-10 md:h-12 md:w-12 text-muted-foreground mx-auto mb-3 md:mb-4" />
							<h3 className="text-sm font-medium text-foreground mb-2">
								No sections yet
							</h3>
							<p className="text-xs md:text-sm text-muted-foreground mb-3 md:mb-4">
								Start building your constitution by adding a preamble or first
								article.
							</p>
							<Button
								onClick={() => setShowAddSection(true)}
								className="inline-flex items-center px-3 py-2 bg-ds-blue-700 text-white rounded-md hover:bg-ds-blue-800 transition-colors text-sm min-h-[40px]"
							>
								<Plus className="h-4 w-4 mr-2" />
								Add First Section
							</Button>
						</div>
					) : (
						<div className="space-y-1">
							{renderSectionHierarchy(sections, null)}
						</div>
					)}
				</div>
			</div>

			<ResponsiveOverlay
				open={showAddSection}
				onOpenChange={setShowAddSection}
				title="Add New Section"
				variant="large-sheet"
				className="sm:max-w-md"
				footer={
					<div className="flex w-full gap-3">
						<Button
							onClick={() => setShowAddSection(false)}
							variant="outline"
							className="h-11 flex-1"
						>
							Cancel
						</Button>
						<Button onClick={handleAddSection} className="h-11 flex-1">
							Add Section
						</Button>
					</div>
				}
			>
				<div className="space-y-4 pb-2">
					<div>
						<label className="block text-sm font-medium text-foreground mb-2">
							Section Type
						</label>
						<Select
							value={addSectionType}
							onValueChange={(value) => {
								handleTypeChange(value as ConstitutionSection["type"]);
								setAddSectionParent("");
							}}
						>
							<SelectTrigger className="h-11 w-full sm:h-9">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="preamble">
									Preamble - Opening statement of purpose
								</SelectItem>
								<SelectItem value="article">
									Article - Main constitutional division
								</SelectItem>
								<SelectItem value="section">
									Section - Must be under an article
								</SelectItem>
								<SelectItem value="subsection">
									Subsection - Subdivision of a section
								</SelectItem>
								<SelectItem value="amendment">
									Amendment - Constitutional modification
								</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{parentOptions.length > 0 && (
						<div>
							<label className="block text-sm font-medium text-foreground mb-2">
								Parent Section
							</label>
							<Select
								value={addSectionParent}
								onValueChange={setAddSectionParent}
							>
								<SelectTrigger className="h-11 w-full sm:h-9">
									<SelectValue placeholder="Select parent..." />
								</SelectTrigger>
								<SelectContent>
									{parentOptions.map((section) => (
										<SelectItem key={section.id} value={section.id}>
											{getSectionDisplayTitle(section, sections)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					)}

					{addSectionType !== "preamble" && (
						<div>
							<label className="block text-sm font-medium text-foreground mb-2">
								Title{" "}
								{addSectionType === "article" ? "(required)" : "(optional)"}
							</label>
							<Input
								type="text"
								value={addSectionTitle}
								onChange={(e) => setAddSectionTitle(e.target.value)}
								placeholder="Enter section title..."
								required={addSectionType === "article"}
								className="h-11 text-base sm:h-9 sm:text-sm"
							/>
						</div>
					)}

					<div>
						<label className="block text-sm font-medium text-foreground mb-2">
							Content{" "}
							{addSectionType === "preamble"
								? "(required)"
								: addSectionType === "article"
									? "(not needed)"
									: "(optional)"}
						</label>
						<Textarea
							value={addSectionContent}
							onChange={(e) => setAddSectionContent(e.target.value)}
							placeholder={
								addSectionType === "preamble"
									? "Enter preamble content..."
									: addSectionType === "article"
										? "Articles typically do not have content..."
										: "Enter section content..."
							}
							rows={4}
							disabled={addSectionType === "article"}
							className="text-base sm:text-sm"
						/>
					</div>
				</div>
			</ResponsiveOverlay>
		</div>
	);
};

// Section Navigation Item Component
const SectionNavigationItem: React.FC<{
	section: ConstitutionSection;
	isSelected: boolean;
	isExpanded: boolean;
	onSelect: (id: string) => void;
	onToggleExpand: (id: string) => void;
	allSections: ConstitutionSection[];
	onMoveUp: () => void;
	onMoveDown: () => void;
	canMoveUp: boolean;
	canMoveDown: boolean;
	sectionRefs: { current: Map<string, HTMLDivElement> };
}> = ({
	section,
	isSelected,
	isExpanded,
	onSelect,
	onToggleExpand,
	allSections,
	onMoveUp,
	onMoveDown,
	canMoveUp,
	canMoveDown,
	sectionRefs,
}) => {
	const hasChildren = allSections.some((s) => s.parentId === section.id);

	return (
		<div
			ref={(el) => {
				if (el) {
					sectionRefs.current.set(section.id, el);
				} else {
					sectionRefs.current.delete(section.id);
				}
			}}
			className={`flex items-center gap-1 md:gap-2 p-2 rounded-md cursor-pointer transition-colors ${
				isSelected ? "bg-ds-blue-100 text-ds-blue-700" : "hover:bg-muted"
			}`}
			onClick={() => onSelect(section.id)}
		>
			<div className="flex flex-col">
				<Button
					variant="ghost"
					size="icon"
					onClick={(e) => {
						e.stopPropagation();
						onMoveUp();
					}}
					disabled={!canMoveUp}
					className="p-0.5 md:p-1 hover:bg-ds-gray-300 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[24px] min-w-[24px] flex items-center justify-center"
					title="Move up"
				>
					<ArrowUp className="h-3 w-3 text-muted-foreground" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					onClick={(e) => {
						e.stopPropagation();
						onMoveDown();
					}}
					disabled={!canMoveDown}
					className="p-0.5 md:p-1 hover:bg-ds-gray-300 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed min-h-[24px] min-w-[24px] flex items-center justify-center"
					title="Move down"
				>
					<ArrowDown className="h-3 w-3 text-muted-foreground" />
				</Button>
			</div>

			{hasChildren && (
				<Button
					variant="ghost"
					size="icon"
					onClick={(e) => {
						e.stopPropagation();
						onToggleExpand(section.id);
					}}
					className="p-0.5 md:p-1 hover:bg-ds-gray-300 rounded min-h-[24px] min-w-[24px] flex items-center justify-center"
				>
					{isExpanded ? (
						<ChevronDown className="h-3 w-3" />
					) : (
						<ChevronRight className="h-3 w-3" />
					)}
				</Button>
			)}

			<div className="flex-1 min-w-0">
				<div className="text-xs md:text-sm font-medium truncate">
					{getSectionDisplayTitle(section, allSections)}
				</div>
				<div className="text-xs text-muted-foreground capitalize">
					{section.type}
				</div>
			</div>
		</div>
	);
};

export default ConstitutionSidebar;
