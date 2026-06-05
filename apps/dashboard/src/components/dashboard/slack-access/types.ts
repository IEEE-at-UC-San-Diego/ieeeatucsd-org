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
