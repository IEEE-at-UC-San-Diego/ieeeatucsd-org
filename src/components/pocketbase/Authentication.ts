import PocketBase from "pocketbase";
import yaml from "js-yaml";
import configYaml from "../../config/pocketbaseConfig.yml?raw";

// Configuration type definitions
interface Config {
  api: {
    baseUrl: string;
    oauth2: {
      redirectPath: string;
      providerName: string;
    };
  };
}

// Parse YAML configuration
const config = yaml.load(configYaml) as Config;

export class Authentication {
  private pb: PocketBase;
  private static instance: Authentication;
  private authChangeCallbacks: ((isValid: boolean) => void)[] = [];
  private isUpdating: boolean = false;

  private constructor() {
    // Use the baseUrl from the config file
    this.pb = new PocketBase(config.api.baseUrl);

    // Configure PocketBase client
    this.pb.autoCancellation(false); // Disable auto-cancellation globally

    // Listen for auth state changes
    this.pb.authStore.onChange(() => {
      if (!this.isUpdating) {
        this.notifyAuthChange();
      }
    });
  }

  /**
   * Get the singleton instance of Authentication
   */
  public static getInstance(): Authentication {
    if (!Authentication.instance) {
      Authentication.instance = new Authentication();
    }
    return Authentication.instance;
  }

  /**
   * Get the PocketBase instance
   */
  public getPocketBase(): PocketBase {
    return this.pb;
  }

  /**
   * Handle user login through OAuth2
   */
  public async login(): Promise<void> {
    try {
      const authMethods = await this.pb.collection("users").listAuthMethods();
      const oidcProvider = authMethods.oauth2?.providers?.find(
        (p: { name: string }) => p.name === config.api.oauth2.providerName,
      );

      if (!oidcProvider) {
        throw new Error("OIDC provider not found");
      }

      localStorage.setItem("provider", JSON.stringify(oidcProvider));
      const redirectUrl =
        window.location.origin + config.api.oauth2.redirectPath;
      const authUrl = oidcProvider.authURL + encodeURIComponent(redirectUrl);
      window.location.href = authUrl;
    } catch (err) {
      console.error("Authentication error:", err);
      throw err;
    }
  }

  /**
   * Handle user logout
   */
  public logout(): void {
    this.pb.authStore.clear();
  }

  /**
   * Check if user is currently authenticated
   */
  public isAuthenticated(): boolean {
    return this.pb.authStore.isValid;
  }

  /**
   * Get current user model
   */
  public getCurrentUser(): any {
    return this.pb.authStore.model;
  }

  /**
   * Subscribe to auth state changes
   * @param callback Function to call when auth state changes
   */
  public onAuthStateChange(callback: (isValid: boolean) => void): void {
    this.authChangeCallbacks.push(callback);
  }

  /**
   * Remove auth state change subscription
   * @param callback Function to remove from subscribers
   */
  public offAuthStateChange(callback: (isValid: boolean) => void): void {
    this.authChangeCallbacks = this.authChangeCallbacks.filter(
      (cb) => cb !== callback,
    );
  }

  /**
   * Set updating state to prevent auth change notifications during updates
   */
  public setUpdating(updating: boolean): void {
    this.isUpdating = updating;
  }

  /**
   * Notify all subscribers of auth state change
   */
  private notifyAuthChange(): void {
    const isValid = this.pb.authStore.isValid;
    this.authChangeCallbacks.forEach((callback) => callback(isValid));
  }
}
