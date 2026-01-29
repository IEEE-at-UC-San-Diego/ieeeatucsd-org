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

export interface EmailInboxState {
    isAuthenticated: boolean;
    isLoading: boolean;
    isRefreshing: boolean;
    emails: EmailMessage[];
    error: string | null;
    credentials: {
        email: string;
        password: string;
    } | null;
}

export interface EmailGenerationState {
    isGenerating: boolean;
    isResetting: boolean;
    generatedEmail: string | null;
    error: string | null;
    success: string | null;
}
