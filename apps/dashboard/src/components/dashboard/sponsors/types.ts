export interface UserWithResume {
	id: string;
	name: string;
	email: string;
	major?: string;
	graduationYear?: number;
	resume?: string;
	fileName?: string;
	role:
		| "Member"
		| "General Officer"
		| "Executive Officer"
		| "Member at Large"
		| "Past Officer"
		| "Sponsor"
		| "Administrator";
	position?: string;
}
