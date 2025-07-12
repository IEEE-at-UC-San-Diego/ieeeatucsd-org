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
    this.contentEl.innerHTML = `
      <p class='text-red-500 text-2xl font-medium mb-4'>${message}</p>
      <a href="/" class="btn btn-primary">
        Return to Home
      </a>
    `;
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
      const authData = await this.pb
        .collection("users")
        .authWithOAuth2Code(
          "oidc",
          code,
          this.provider.codeVerifier,
          window.location.origin + "/oauth2-redirect",
          { emailVisibility: true },
        );

      // console.log("Auth successful:", authData);
      this.contentEl.innerHTML = `
                <p class="text-3xl font-bold text-green-500 mb-4">Authentication Successful!</p>
                <p class="text-2xl font-medium">Initializing your data...</p>
                <div class="mt-4">
                    <div class="loading loading-spinner loading-lg"></div>
                </div>
            `;

      try {
        // Update last login before redirecting
        await this.pb.collection("users").update(authData.record.id, {
          last_login: new Date().toISOString(),
        });

        // Initialize data sync
        await this.initializeDataSync();

        // Clean up and redirect
        localStorage.removeItem("provider");
        window.location.href = "/dashboard";
      } catch (err) {
        console.error("Failed to update last login or sync data:", err);
        // Still redirect even if last_login update fails
        localStorage.removeItem("provider");
        window.location.href = "/dashboard";
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      this.showError(`Failed to complete authentication: ${err.message}`);
    }
  }

  /**
   * Initialize data synchronization after successful authentication
   */
  private async initializeDataSync(): Promise<void> {
    try {
      // Dynamically import the AuthSyncService to avoid circular dependencies
      const { AuthSyncService } = await import("../database/AuthSyncService");

      // Get the instance and trigger a full sync
      const authSync = AuthSyncService.getInstance();
      const syncResult = await authSync.handleLogin();

      // console.log('Initial data sync completed successfully');
    } catch (error) {
      console.error("Failed to initialize data sync:", error);
      // Continue with login process even if sync fails
    }
  }
}
