export interface EmailMessage {
	id: string;
	subject: string;
	from: string;
	date: string;
	preview: string;
	isRead: boolean;
	uid: number;
	attachmentCount?: number;
}

export interface InboxCredentials {
	email: string;
	password: string;
}

export type EmailInboxState =
	| { status: "signedOut" }
	| { status: "signingIn" }
	| { status: "failed"; message: string }
	| {
			status: "signedIn";
			credentials: InboxCredentials;
			emails: EmailMessage[];
			refreshing: boolean;
			refreshError: string | null;
	  };

export interface EmailNotice {
	kind: "error" | "success";
	message: string;
}

/** `generatedEmail` survives across phases so the address stays visible after creation. */
export type EmailGenerationState =
	| {
			status: "idle";
			generatedEmail: string | null;
			notice: EmailNotice | null;
	  }
	| { status: "generating"; generatedEmail: string | null }
	| { status: "resetting"; generatedEmail: string | null };

export interface PasswordValidation {
	isValid: boolean;
	strength: number;
	requirements: {
		minLength: boolean;
		hasUppercase: boolean;
		hasLowercase: boolean;
		hasNumber: boolean;
		hasSpecialChar: boolean;
	};
}
