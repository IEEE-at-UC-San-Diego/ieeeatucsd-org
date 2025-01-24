import PocketBase from "pocketbase";

export class RedirectHandler {
    private pb: PocketBase;
    private contentEl: HTMLElement;
    private params: URLSearchParams;
    private provider: any;

    constructor() {
        this.pb = new PocketBase("https://pocketbase.ieeeucsd.org");
        this.contentEl = this.getContentElement();
        this.params = new URLSearchParams(window.location.search);
        this.provider = this.getStoredProvider();
        this.handleRedirect();
    }

    private getContentElement(): HTMLElement {
        const contentEl = document.getElementById("content");
        if (!contentEl) {
            throw new Error("Content element not found");
        }
        return contentEl;
    }

    private getStoredProvider() {
        return JSON.parse(localStorage.getItem("provider") || "{}");
    }

    private showError(message: string) {
        this.contentEl.innerHTML = `<p class='text-red-500'>${message}</p>`;
    }

    private async handleRedirect() {
        const code = this.params.get("code");
        const state = this.params.get("state");

        if (!code) {
            this.showError("No authorization code found in URL.");
            return;
        }

        if (state !== this.provider.state) {
            this.showError("Invalid state parameter.");
            return;
        }

        try {
            const authData = await this.pb.collection("users").authWithOAuth2Code(
                "oidc",
                code,
                this.provider.codeVerifier,
                window.location.origin + "/oauth2-redirect",
                { emailVisibility: false }
            );

            console.log("Auth successful:", authData);
            this.contentEl.innerHTML = `
                <p class="text-3xl font-bold text-green-500 mb-4">Authentication Successful!</p>
                <p class="text-2xl font-medium">Redirecting to store...</p>
                <div class="mt-4">
                    <div class="loading loading-spinner loading-lg"></div>
                </div>
            `;
            
            try {
                // Update last login before redirecting
                await this.pb.collection("users").update(authData.record.id, {
                    last_login: new Date().toISOString()
                });
                
                // Clean up and redirect
                localStorage.removeItem("provider");
                window.location.href = "/online-store";
            } catch (err) {
                console.error("Failed to update last login:", err);
                // Still redirect even if last_login update fails
                localStorage.removeItem("provider");
                window.location.href = "/online-store";
            }
        } catch (err: any) {
            console.error("Auth error:", err);
            this.showError(`Failed to complete authentication: ${err.message}`);
        }
    }
} 