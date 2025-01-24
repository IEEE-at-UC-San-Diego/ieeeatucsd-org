import PocketBase from "pocketbase";

interface AuthElements {
    loginButton: HTMLButtonElement;
    logoutButton: HTMLButtonElement;
    userInfo: HTMLDivElement;
    userName: HTMLParagraphElement;
    userEmail: HTMLParagraphElement;
    memberStatus: HTMLDivElement;
    lastLogin: HTMLParagraphElement;
    storeContent: HTMLDivElement;
    resumeUpload: HTMLInputElement;
    resumeName: HTMLParagraphElement;
    resumeDownload: HTMLAnchorElement;
    deleteResume: HTMLButtonElement;
    uploadStatus: HTMLParagraphElement;
    resumeActions: HTMLDivElement;
    memberIdInput: HTMLInputElement;
    saveMemberId: HTMLButtonElement;
    memberIdStatus: HTMLParagraphElement;
}

export class StoreAuth {
    private pb: PocketBase;
    private elements: AuthElements & { loadingSkeleton: HTMLDivElement };
    private isEditingMemberId: boolean = false;

    constructor() {
        this.pb = new PocketBase("https://pocketbase.ieeeucsd.org");
        this.elements = this.getElements();
        this.init();
    }

    private getElements(): AuthElements & { loadingSkeleton: HTMLDivElement } {
        // Fun typescript fixes
        const loginButton = document.getElementById("loginButton") as HTMLButtonElement;
        const logoutButton = document.getElementById("logoutButton") as HTMLButtonElement;
        const userInfo = document.getElementById("userInfo") as HTMLDivElement;
        const loadingSkeleton = document.getElementById("loadingSkeleton") as HTMLDivElement;
        
        // Add CSS for loading state transitions
        const style = document.createElement('style');
        style.textContent = `
            .loading-state {
                opacity: 0.5;
                transition: opacity 0.3s ease-in-out;
            }
            .content-ready {
                opacity: 1;
            }
        `;
        document.head.appendChild(style);

        const userName = document.getElementById("userName") as HTMLParagraphElement;
        const userEmail = document.getElementById("userEmail") as HTMLParagraphElement;
        const memberStatus = document.getElementById("memberStatus") as HTMLDivElement;
        const lastLogin = document.getElementById("lastLogin") as HTMLParagraphElement;
        const storeContent = document.getElementById("storeContent") as HTMLDivElement;
        const resumeUpload = document.getElementById("resumeUpload") as HTMLInputElement;
        const resumeName = document.getElementById("resumeName") as HTMLParagraphElement;
        const resumeDownload = document.getElementById("resumeDownload") as HTMLAnchorElement;
        const deleteResume = document.getElementById("deleteResume") as HTMLButtonElement;
        const uploadStatus = document.getElementById("uploadStatus") as HTMLParagraphElement;
        const resumeActions = document.getElementById("resumeActions") as HTMLDivElement;
        const memberIdInput = document.getElementById("memberIdInput") as HTMLInputElement;
        const saveMemberId = document.getElementById("saveMemberId") as HTMLButtonElement;
        const memberIdStatus = document.getElementById("memberIdStatus") as HTMLParagraphElement;

        if (!loginButton || !logoutButton || !userInfo || !storeContent || !userName || !userEmail || 
            !memberStatus || !lastLogin || !resumeUpload || !resumeName || !loadingSkeleton ||
            !resumeDownload || !deleteResume || !uploadStatus || !resumeActions ||
            !memberIdInput || !saveMemberId || !memberIdStatus) {
            throw new Error("Required DOM elements not found");
        }

        return { 
            loginButton, logoutButton, userInfo, userName, userEmail, memberStatus, 
            lastLogin, storeContent, resumeUpload, resumeName, loadingSkeleton,
            resumeDownload, deleteResume, uploadStatus, resumeActions,
            memberIdInput, saveMemberId, memberIdStatus
        };
    }

    private updateMemberIdState() {
        const { memberIdInput, saveMemberId } = this.elements;
        const user = this.pb.authStore.model;

        if (user?.member_id && !this.isEditingMemberId) {
            // Has member ID and not editing - show update button and disable input
            memberIdInput.disabled = true;
            memberIdInput.value = user.member_id;
            saveMemberId.textContent = "Update";
            saveMemberId.classList.remove("btn-primary");
            saveMemberId.classList.add("btn-ghost");
        } else {
            // No member ID or editing - show save button and enable input
            memberIdInput.disabled = false;
            saveMemberId.textContent = "Save";
            saveMemberId.classList.remove("btn-ghost");
            saveMemberId.classList.add("btn-primary");
        }
    }

    private async updateUI() {
        const { loginButton, logoutButton, userInfo, userName, userEmail, memberStatus, 
                lastLogin, storeContent, resumeName, resumeDownload, resumeActions,
                memberIdInput, saveMemberId, resumeUpload, loadingSkeleton } = this.elements;

        // Hide buttons initially
        loginButton.style.display = 'none';
        logoutButton.style.display = 'none';

        if (this.pb.authStore.isValid && this.pb.authStore.model) {
            // Update all the user information first
            const user = this.pb.authStore.model;
            userName.textContent = user.name || "Name not provided";
            userEmail.textContent = user.email || "Email not available";
            
            // Update member status
            if (user.verified) {
                // Check and update member_type if not set
                if (!user.member_type) {
                    try {
                        const isIeeeOfficer = user.email?.toLowerCase().endsWith('@ieeeucsd.org') || false;
                        const newMemberType = isIeeeOfficer ? "IEEE Officer" : "Regular Member";
                        
                        await this.pb.collection("users").update(user.id, {
                            member_type: newMemberType
                        });
                        
                        user.member_type = newMemberType;
                    } catch (err) {
                        console.error("Failed to update member type:", err);
                    }
                }

                memberStatus.textContent = user.member_type || "Regular Member";
                memberStatus.classList.remove("badge-neutral", "badge-success", "badge-warning", "badge-info", "badge-error");
                
                // Set color based on member type
                if (user.member_type === "IEEE Administrator") {
                    memberStatus.classList.add("badge-warning"); // Red for administrators
                } else if (user.member_type === "IEEE Officer") {
                    memberStatus.classList.add("badge-info"); // Blue for officers
                } else {
                    memberStatus.classList.add("badge-neutral"); // Yellow for regular members
                }
            } else {
                memberStatus.textContent = "Not Verified";
                memberStatus.classList.remove("badge-info", "badge-warning", "badge-success", "badge-error");
                memberStatus.classList.add("badge-neutral");
            }

            // Update member ID input and state
            memberIdInput.value = user.member_id || "";
            this.updateMemberIdState();

            // Update last login
            const lastLoginDate = user.last_login ? new Date(user.last_login).toLocaleString() : "Never";
            lastLogin.textContent = lastLoginDate;

            // Update resume section
            if (user.resume && (!Array.isArray(user.resume) || user.resume.length > 0)) {
                const resumeUrl = user.resume.toString();
                resumeName.textContent = this.getFileNameFromUrl(resumeUrl);
                resumeDownload.href = this.pb.files.getURL(user, resumeUrl);
                resumeActions.style.display = 'flex';
            } else {
                resumeName.textContent = "No resume uploaded";
                resumeDownload.href = "#";
                resumeActions.style.display = 'none';
            }

            // After everything is updated, show the content
            loadingSkeleton.style.display = 'none';
            userInfo.classList.remove('hidden');
            // Use a small delay to ensure the transition works
            setTimeout(() => {
                userInfo.style.opacity = '1';
            }, 50);
            
            logoutButton.style.display = 'block';
        } else {
            // Update for logged out state
            userName.textContent = "Not signed in";
            userEmail.textContent = "Not signed in";
            memberStatus.textContent = "Not verified";
            memberStatus.classList.remove("badge-info", "badge-warning", "badge-success", "badge-error");
            memberStatus.classList.add("badge-neutral");
            lastLogin.textContent = "Never";
            
            // Reset member ID
            memberIdInput.value = "";
            memberIdInput.disabled = true;
            this.isEditingMemberId = false;
            this.updateMemberIdState();

            // Reset resume section
            resumeName.textContent = "No resume uploaded";
            resumeDownload.href = "#";
            resumeActions.style.display = 'none';

            // After everything is updated, show the content
            loadingSkeleton.style.display = 'none';
            userInfo.classList.remove('hidden');
            // Use a small delay to ensure the transition works
            setTimeout(() => {
                userInfo.style.opacity = '1';
            }, 50);
            
            loginButton.style.display = 'block';
        }
    }

    private getFileNameFromUrl(url: string): string {
        const parts = url.split("/");
        return parts[parts.length - 1];
    }

    private async handleMemberIdButton() {
        const user = this.pb.authStore.model;
        
        if (user?.member_id && !this.isEditingMemberId) {
            // If we have a member ID and we're not editing, switch to edit mode
            this.isEditingMemberId = true;
            this.updateMemberIdState();
        } else {
            // If we're editing or don't have a member ID, try to save
            await this.handleMemberIdSave();
        }
    }

    private async handleMemberIdSave() {
        const { memberIdInput, memberIdStatus } = this.elements;
        const memberId = memberIdInput.value.trim();
        
        try {
            memberIdStatus.textContent = "Saving member ID...";
            
            const user = this.pb.authStore.model;
            if (!user?.id) {
                throw new Error("User ID not found");
            }

            await this.pb.collection("users").update(user.id, {
                member_id: memberId
            });
            
            memberIdStatus.textContent = "IEEE Member ID saved successfully!";
            this.isEditingMemberId = false;
            this.updateUI();
            
            // Clear the status message after a delay
            setTimeout(() => {
                memberIdStatus.textContent = "";
            }, 3000);
        } catch (err: any) {
            console.error("IEEE Member ID save error:", err);
            memberIdStatus.textContent = "Failed to save IEEE Member ID. Please try again.";
        }
    }

    private async handleResumeUpload(file: File) {
        const { uploadStatus } = this.elements;
        
        try {
            uploadStatus.textContent = "Uploading resume...";
            
            const formData = new FormData();
            formData.append("resume", file);

            const user = this.pb.authStore.model;
            if (!user?.id) {
                throw new Error("User ID not found");
            }

            await this.pb.collection("users").update(user.id, formData);
            
            uploadStatus.textContent = "Resume uploaded successfully!";
            this.updateUI();

            // Clear the file input
            this.elements.resumeUpload.value = "";
            
            // Clear the status message after a delay
            setTimeout(() => {
                uploadStatus.textContent = "";
            }, 3000);
        } catch (err: any) {
            console.error("Resume upload error:", err);
            uploadStatus.textContent = "Failed to upload resume. Please try again.";
        }
    }

    private async handleResumeDelete() {
        const { uploadStatus } = this.elements;
        
        try {
            uploadStatus.textContent = "Deleting resume...";
            
            const user = this.pb.authStore.model;
            if (!user?.id) {
                throw new Error("User ID not found");
            }

            await this.pb.collection("users").update(user.id, {
                "resume": null
            });
            
            uploadStatus.textContent = "Resume deleted successfully!";
            this.updateUI();
            
            // Clear the status message after a delay
            setTimeout(() => {
                uploadStatus.textContent = "";
            }, 3000);
        } catch (err: any) {
            console.error("Resume deletion error:", err);
            uploadStatus.textContent = "Failed to delete resume. Please try again.";
        }
    }

    private async handleLogin() {
        console.log("Starting OAuth2 authentication...");
        try {
            const authMethods = await this.pb.collection("users").listAuthMethods();
            const oidcProvider = authMethods.oauth2?.providers?.find(
                (p: { name: string }) => p.name === "oidc"
            );

            if (!oidcProvider) {
                throw new Error("OIDC provider not found");
            }

            // Store provider info for the redirect page
            localStorage.setItem("provider", JSON.stringify(oidcProvider));

            // Redirect to the authorization URL
            const redirectUrl = window.location.origin + "/oauth2-redirect";
            const authUrl = oidcProvider.authURL + encodeURIComponent(redirectUrl);
            window.location.href = authUrl;
        } catch (err: any) {
            console.error("Authentication error:", err);
            this.elements.userEmail.textContent = "Failed to start authentication";
            this.elements.userName.textContent = "Error";
        }
    }

    private handleLogout() {
        this.pb.authStore.clear();
        this.updateUI();
    }

    private init() {
        // Initial UI update with loading state
        this.updateUI().catch(console.error);

        // Setup event listeners
        this.elements.loginButton.addEventListener("click", () => this.handleLogin());
        this.elements.logoutButton.addEventListener("click", () => this.handleLogout());
        
        // Resume upload event listener
        this.elements.resumeUpload.addEventListener("change", (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) {
                this.handleResumeUpload(file);
            }
        });

        // Resume delete event listener
        this.elements.deleteResume.addEventListener("click", () => this.handleResumeDelete());

        // Member ID save event listener
        this.elements.saveMemberId.addEventListener("click", () => this.handleMemberIdButton());

        // Listen for auth state changes
        this.pb.authStore.onChange(async (token) => {
            console.log("Auth state changed. IsValid:", this.pb.authStore.isValid);
            this.updateUI();
        });
    }
} 