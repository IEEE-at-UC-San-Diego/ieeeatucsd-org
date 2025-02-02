import PocketBase from "pocketbase";
import yaml from "js-yaml";
import configYaml from "../../data/storeConfig.yaml?raw";

// Configuration type definitions
interface Role {
  name: string;
  badge: string;
  permissions: string[];
}

interface Config {
  api: {
    baseUrl: string;
    oauth2: {
      redirectPath: string;
      providerName: string;
    };
  };
  roles: {
    administrator: Role;
    officer: Role;
    sponsor: Role;
    member: Role;
  };
  resume: {
    allowedTypes: string[];
    maxSize: number;
    viewer: {
      width: string;
      maxWidth: string;
      height: string;
    };
  };
  ui: {
    transitions: {
      fadeDelay: number;
    };
    messages: {
      memberId: {
        saving: string;
        success: string;
        error: string;
        messageTimeout: number;
      };
      resume: {
        uploading: string;
        success: string;
        error: string;
        deleting: string;
        deleteSuccess: string;
        deleteError: string;
        messageTimeout: number;
      };
      auth: {
        loginError: string;
        notSignedIn: string;
        notVerified: string;
        notProvided: string;
        notAvailable: string;
        never: string;
      };
    };
    defaults: {
      pageSize: number;
      sortField: string;
    };
  };
  autoDetection: {
    officer: {
      emailDomain: string;
    };
  };
}

// Parse YAML configuration with type
const config = yaml.load(configYaml) as Config;

interface AuthElements {
  loginButton: HTMLButtonElement;
  logoutButton: HTMLButtonElement;
  userInfo: HTMLDivElement;
  userName: HTMLParagraphElement;
  userEmail: HTMLParagraphElement;
  memberStatus: HTMLDivElement;
  lastLogin: HTMLParagraphElement;
  storeContent: HTMLDivElement;
  officerViewToggle: HTMLDivElement;
  officerViewCheckbox: HTMLInputElement;
  officerContent: HTMLDivElement;
  profileEditor: HTMLDialogElement;
  editorName: HTMLInputElement;
  editorEmail: HTMLInputElement;
  editorPoints: HTMLInputElement;
  saveProfileButton: HTMLButtonElement;
  sponsorViewToggle: HTMLDivElement;
}

export class StoreAuth {
  private pb: PocketBase;
  private elements: AuthElements & { loadingSkeleton: HTMLDivElement };
  private cachedUsers: any[] = [];
  private config = config;

  constructor() {
    this.pb = new PocketBase(this.config.api.baseUrl);
    this.elements = this.getElements();
    this.init();
  }

  // Public method to get auth state
  public getAuthState() {
    return {
      isValid: this.pb.authStore.isValid,
      model: this.pb.authStore.model
    };
  }

  // Public method to handle login
  public async handleLogin() {
    try {
      const authMethods = await this.pb.collection("users").listAuthMethods();
      const oidcProvider = authMethods.oauth2?.providers?.find(
        (p: { name: string }) => p.name === this.config.api.oauth2.providerName
      );

      if (!oidcProvider) {
        throw new Error("OIDC provider not found");
      }

      localStorage.setItem("provider", JSON.stringify(oidcProvider));
      const redirectUrl = window.location.origin + this.config.api.oauth2.redirectPath;
      const authUrl = oidcProvider.authURL + encodeURIComponent(redirectUrl);
      window.location.href = authUrl;
    } catch (err) {
      console.error("Authentication error:", err);
      this.elements.userEmail.textContent = this.config.ui.messages.auth.loginError;
      this.elements.userName.textContent = "Error";
      throw err;
    }
  }

  // Public method to update profile settings
  public async updateProfileSettings(data: {
    major?: string | null;
    graduation_year?: number | null;
    member_id?: string | null;
  }) {
    const user = this.pb.authStore.model;
    if (!user?.id) {
      throw new Error("User ID not found");
    }

    return await this.pb.collection("users").update(user.id, data);
  }

  /**
   * Handles uploading a resume file for the current user
   * @param file The resume file to upload
   * @returns Promise that resolves when the resume is uploaded
   */
  public async handleResumeUpload(file: File) {
    const user = this.pb.authStore.model;
    if (!user?.id) {
      throw new Error("User ID not found");
    }

    // Validate file type
    const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
    if (!allowedTypes.includes(file.type)) {
      throw new Error("Invalid file type. Please upload a PDF or Word document.");
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      throw new Error("File size too large. Maximum size is 5MB.");
    }

    // Create form data with the file
    const formData = new FormData();
    formData.append("resume", file);

    // Update the user record with the new resume
    return await this.pb.collection("users").update(user.id, formData);
  }

  private getElements(): AuthElements & { loadingSkeleton: HTMLDivElement } {
    // Get all required elements
    const loginButton = document.getElementById("contentLoginButton") as HTMLButtonElement;
    const logoutButton = document.getElementById("contentLogoutButton") as HTMLButtonElement;
    const userInfo = document.getElementById("userInfo") as HTMLDivElement;
    const loadingSkeleton = document.getElementById("loadingSkeleton") as HTMLDivElement;
    const userName = document.getElementById("userName") as HTMLParagraphElement;
    const userEmail = document.getElementById("userEmail") as HTMLParagraphElement;
    const memberStatus = document.getElementById("memberStatus") as HTMLDivElement;
    const lastLogin = document.getElementById("lastLogin") as HTMLParagraphElement;
    const storeContent = document.getElementById("storeContent") as HTMLDivElement;
    const officerViewToggle = document.getElementById("officerViewToggle") as HTMLDivElement;
    const officerViewCheckbox = officerViewToggle?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const officerContent = document.getElementById("officerContent") as HTMLDivElement;
    const profileEditor = document.getElementById("profileEditor") as HTMLDialogElement;
    const editorName = document.getElementById("editorName") as HTMLInputElement;
    const editorEmail = document.getElementById("editorEmail") as HTMLInputElement;
    const editorPoints = document.getElementById("editorPoints") as HTMLInputElement;
    const saveProfileButton = document.getElementById("saveProfileButton") as HTMLButtonElement;
    const sponsorViewToggle = document.getElementById("sponsorViewToggle") as HTMLDivElement;

    // Add CSS for loading state transitions
    const style = document.createElement("style");
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

    return {
      loginButton,
      logoutButton,
      userInfo,
      loadingSkeleton,
      userName,
      userEmail,
      memberStatus,
      lastLogin,
      storeContent,
      officerViewToggle,
      officerViewCheckbox,
      officerContent,
      profileEditor,
      editorName,
      editorEmail,
      editorPoints,
      saveProfileButton,
      sponsorViewToggle
    };
  }

  private async init() {
    // Initial UI update with loading state
    await this.updateUI();

    // Setup event listeners
    this.elements.loginButton.addEventListener("click", () => this.handleLogin());
    this.elements.logoutButton.addEventListener("click", () => this.handleLogout());

    // Listen for auth state changes
    this.pb.authStore.onChange(() => {
      console.log("Auth state changed. IsValid:", this.pb.authStore.isValid);
      this.updateUI();
    });

    // Profile editor event listeners
    const { profileEditor, saveProfileButton } = this.elements;

    // Close dialog when clicking outside
    profileEditor.addEventListener("click", (e) => {
      if (e.target === profileEditor) {
        profileEditor.close();
      }
    });

    // Save profile button
    saveProfileButton.addEventListener("click", (e) => {
      e.preventDefault();
      this.handleProfileSave();
    });
  }

  private async updateUI() {
    const {
      loginButton,
      logoutButton,
      userInfo,
      userName,
      userEmail,
      memberStatus,
      lastLogin,
      loadingSkeleton,
      officerViewToggle,
      sponsorViewToggle,
    } = this.elements;

    // Get all login and logout buttons using classes
    const allLoginButtons = document.querySelectorAll('.login-button');
    const allLogoutButtons = document.querySelectorAll('.logout-button');

    // Hide all buttons initially
    allLoginButtons.forEach(btn => btn.classList.add("hidden"));
    allLogoutButtons.forEach(btn => btn.classList.add("hidden"));

    if (this.pb.authStore.isValid && this.pb.authStore.model) {
      // Show logout buttons for authenticated users
      allLogoutButtons.forEach(btn => btn.classList.remove("hidden"));

      const user = this.pb.authStore.model;
      const isSponsor = user.member_type === this.config.roles.sponsor.name;
      const isOfficer = [
        this.config.roles.officer.name,
        this.config.roles.administrator.name
      ].includes(user.member_type || "");

      userName.textContent = user.name || this.config.ui.messages.auth.notProvided;
      userEmail.textContent = user.email || this.config.ui.messages.auth.notAvailable;

      // Update member status badge
      if (user.member_type) {
        memberStatus.textContent = user.member_type;
        memberStatus.classList.remove("badge-neutral");
        
        if (isOfficer) {
          memberStatus.classList.add("badge-primary");
        } else if (isSponsor) {
          memberStatus.classList.add("badge-warning");
        } else {
          memberStatus.classList.add("badge-info");
        }
      } else {
        memberStatus.textContent = this.config.ui.messages.auth.notVerified;
        memberStatus.classList.remove("badge-info", "badge-warning", "badge-primary");
        memberStatus.classList.add("badge-neutral");
      }

      // Update last login
      lastLogin.textContent = user.last_login
        ? new Date(user.last_login).toLocaleString()
        : this.config.ui.messages.auth.never;

      // Show/hide view toggles and update view visibility
      officerViewToggle.style.display = isOfficer ? "block" : "none";
      sponsorViewToggle.style.display = isSponsor ? "block" : "none";

      // If not an officer, ensure default view is shown and officer view is hidden
      if (!isOfficer) {
        const defaultView = document.getElementById("defaultView");
        const officerView = document.getElementById("officerView");
        const mainTabs = document.querySelector(".tabs.tabs-boxed");
        const officerContent = document.getElementById("officerContent");
        const settingsView = document.getElementById("settingsView");

        if (defaultView && officerView && mainTabs && officerContent && settingsView) {
          // Show default view and its tabs
          defaultView.classList.remove("hidden");
          mainTabs.classList.remove("hidden");
          // Hide officer view
          officerView.classList.add("hidden");
          officerContent.classList.add("hidden");
          // Also uncheck the toggle if it exists
          const officerViewCheckbox = officerViewToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
          if (officerViewCheckbox) {
            officerViewCheckbox.checked = false;
          }
        }
      }

      // After everything is updated, show the content
      loadingSkeleton.style.display = "none";
      userInfo.classList.remove("hidden");
      setTimeout(() => {
        userInfo.style.opacity = "1";
      }, 50);
    } else {
      // Show login buttons for unauthenticated users
      allLoginButtons.forEach(btn => btn.classList.remove("hidden"));

      // Reset all fields to default state
      userName.textContent = this.config.ui.messages.auth.notSignedIn;
      userEmail.textContent = this.config.ui.messages.auth.notSignedIn;
      memberStatus.textContent = this.config.ui.messages.auth.notVerified;
      memberStatus.classList.remove("badge-info", "badge-warning", "badge-primary");
      memberStatus.classList.add("badge-neutral");
      lastLogin.textContent = this.config.ui.messages.auth.never;

      // Hide view toggles
      officerViewToggle.style.display = "none";
      sponsorViewToggle.style.display = "none";

      // Show content
      loadingSkeleton.style.display = "none";
      userInfo.classList.remove("hidden");
      setTimeout(() => {
        userInfo.style.opacity = "1";
      }, 50);
    }
  }

  private handleLogout() {
    this.pb.authStore.clear();
    this.cachedUsers = [];
    this.updateUI();
  }

  private async handleProfileSave() {
    const {
      profileEditor,
      editorName,
      editorEmail,
      editorPoints,
      saveProfileButton,
    } = this.elements;
    const userId = saveProfileButton.dataset.userId;

    if (!userId) {
      console.error("No user ID found for saving");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("name", editorName.value);
      formData.append("email", editorEmail.value);
      formData.append("points", editorPoints.value);

      await this.pb.collection("users").update(userId, formData);
      profileEditor.close();
      this.updateUI();
    } catch (err) {
      console.error("Failed to save user profile:", err);
    }
  }
}