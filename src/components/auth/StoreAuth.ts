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
  resumeUpload: HTMLInputElement;
  resumeName: HTMLParagraphElement;
  resumeDownload: HTMLAnchorElement;
  deleteResume: HTMLButtonElement;
  uploadStatus: HTMLParagraphElement;
  resumeActions: HTMLDivElement;
  memberIdInput: HTMLInputElement;
  saveMemberId: HTMLButtonElement;
  memberIdStatus: HTMLParagraphElement;
  officerViewToggle: HTMLDivElement;
  officerViewCheckbox: HTMLInputElement;
  officerContent: HTMLDivElement;
  resumeList: HTMLTableSectionElement;
  refreshResumes: HTMLButtonElement;
  resumeSearch: HTMLInputElement;
  searchResumes: HTMLButtonElement;
  profileEditor: HTMLDialogElement;
  editorName: HTMLInputElement;
  editorEmail: HTMLInputElement;
  editorMemberId: HTMLInputElement;
  editorPoints: HTMLInputElement;
  editorResume: HTMLInputElement;
  editorCurrentResume: HTMLParagraphElement;
  saveProfileButton: HTMLButtonElement;
  sponsorViewToggle: HTMLDivElement;
  pdfViewer: HTMLDialogElement;
  pdfFrame: HTMLIFrameElement;
  pdfTitle: HTMLHeadingElement;
  pdfExternalLink: HTMLAnchorElement;
}

export class StoreAuth {
  private pb: PocketBase;
  private elements: AuthElements & { loadingSkeleton: HTMLDivElement };
  private isEditingMemberId: boolean = false;
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
    const resumeUpload = document.getElementById("resumeUpload") as HTMLInputElement;
    const resumeName = document.getElementById("resumeName") as HTMLParagraphElement;
    const resumeDownload = document.getElementById("resumeDownload") as HTMLAnchorElement;
    const deleteResume = document.getElementById("deleteResume") as HTMLButtonElement;
    const uploadStatus = document.getElementById("uploadStatus") as HTMLParagraphElement;
    const resumeActions = document.getElementById("resumeActions") as HTMLDivElement;
    const memberIdInput = document.getElementById("memberIdInput") as HTMLInputElement;
    const saveMemberId = document.getElementById("saveMemberId") as HTMLButtonElement;
    const memberIdStatus = document.getElementById("memberIdStatus") as HTMLParagraphElement;
    const officerViewToggle = document.getElementById("officerViewToggle") as HTMLDivElement;
    const officerViewCheckbox = officerViewToggle?.querySelector('input[type="checkbox"]') as HTMLInputElement;
    const officerContent = document.getElementById("officerContent") as HTMLDivElement;
    const resumeList = document.getElementById("resumeList") as HTMLTableSectionElement;
    const refreshResumes = document.getElementById("refreshResumes") as HTMLButtonElement;
    const resumeSearch = document.getElementById("resumeSearch") as HTMLInputElement;
    const searchResumes = document.getElementById("searchResumes") as HTMLButtonElement;
    const profileEditor = document.getElementById("profileEditor") as HTMLDialogElement;
    const editorName = document.getElementById("editorName") as HTMLInputElement;
    const editorEmail = document.getElementById("editorEmail") as HTMLInputElement;
    const editorMemberId = document.getElementById("editorMemberId") as HTMLInputElement;
    const editorPoints = document.getElementById("editorPoints") as HTMLInputElement;
    const editorResume = document.getElementById("editorResume") as HTMLInputElement;
    const editorCurrentResume = document.getElementById("editorCurrentResume") as HTMLParagraphElement;
    const saveProfileButton = document.getElementById("saveProfileButton") as HTMLButtonElement;
    const sponsorViewToggle = document.getElementById("sponsorViewToggle") as HTMLDivElement;
    const pdfViewer = document.getElementById("pdfViewer") as HTMLDialogElement;
    const pdfFrame = document.getElementById("pdfFrame") as HTMLIFrameElement;
    const pdfTitle = document.getElementById("pdfTitle") as HTMLHeadingElement;
    const pdfExternalLink = document.getElementById("pdfExternalLink") as HTMLAnchorElement;

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
      resumeUpload,
      resumeName,
      resumeDownload,
      deleteResume,
      uploadStatus,
      resumeActions,
      memberIdInput,
      saveMemberId,
      memberIdStatus,
      officerViewToggle,
      officerViewCheckbox,
      officerContent,
      resumeList,
      refreshResumes,
      resumeSearch,
      searchResumes,
      profileEditor,
      editorName,
      editorEmail,
      editorMemberId,
      editorPoints,
      editorResume,
      editorCurrentResume,
      saveProfileButton,
      sponsorViewToggle,
      pdfViewer,
      pdfFrame,
      pdfTitle,
      pdfExternalLink
    };
  }

  private async init() {
    // Initial UI update with loading state
    await this.updateUI();

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

    // Add resume view event listener
    document.addEventListener('viewResume', ((e: CustomEvent) => {
      this.handleResumeView(e.detail.url, e.detail.fileName);
    }) as EventListener);
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
      memberIdInput,
      saveMemberId,
      resumeUpload,
      resumeName,
      resumeDownload,
      resumeActions,
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

      // Update member ID input and state
      memberIdInput.value = user.member_id || "";
      memberIdInput.disabled = false;
      saveMemberId.disabled = false;

      // Update last login
      lastLogin.textContent = user.last_login
        ? new Date(user.last_login).toLocaleString()
        : this.config.ui.messages.auth.never;

      // Update resume section
      resumeUpload.disabled = false;
      if (user.resume && (!Array.isArray(user.resume) || user.resume.length > 0)) {
        const resumeUrl = user.resume.toString();
        const fileName = this.getFileNameFromUrl(resumeUrl);
        resumeName.textContent = fileName;
        const fullUrl = this.pb.files.getURL(user, resumeUrl);
        resumeDownload.href = "#";
        resumeDownload.onclick = (e) => {
          e.preventDefault();
          this.handleResumeView(fullUrl, fileName);
        };
        resumeActions.style.display = "flex";
      } else {
        resumeName.textContent = "No resume uploaded";
        resumeDownload.href = "#";
        resumeDownload.onclick = null;
        resumeActions.style.display = "none";
      }

      // Show/hide view toggles
      officerViewToggle.style.display = isOfficer ? "block" : "none";
      sponsorViewToggle.style.display = isSponsor ? "block" : "none";

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

      // Disable inputs
      memberIdInput.disabled = true;
      saveMemberId.disabled = true;
      resumeUpload.disabled = true;

      // Reset member ID
      memberIdInput.value = "";
      this.isEditingMemberId = false;

      // Reset resume section
      resumeName.textContent = "No resume uploaded";
      resumeDownload.href = "#";
      resumeDownload.onclick = null;
      resumeActions.style.display = "none";

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

  private async handleLogin() {
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
    }
  }

  private handleLogout() {
    this.pb.authStore.clear();
    this.cachedUsers = [];
    this.isEditingMemberId = false;
    this.updateUI();
  }

  private getFileNameFromUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split("/");
      return decodeURIComponent(pathParts[pathParts.length - 1]);
    } catch (e) {
      return url.split("/").pop() || "Unknown File";
    }
  }

  private handleResumeView(url: string, fileName: string) {
    const { pdfViewer, pdfFrame, pdfTitle, pdfExternalLink } = this.elements;
    pdfFrame.src = url;
    pdfTitle.textContent = fileName;
    pdfExternalLink.href = url;
    pdfViewer.showModal();
  }

  private async handleResumeUpload(file: File) {
    const { uploadStatus } = this.elements;
    try {
      const user = this.pb.authStore.model;
      if (!user?.id) {
        throw new Error("User ID not found");
      }

      const formData = new FormData();
      formData.append("resume", file);

      await this.pb.collection("users").update(user.id, formData);
      uploadStatus.textContent = this.config.ui.messages.resume.success;
      this.updateUI();

      setTimeout(() => {
        uploadStatus.textContent = "";
      }, this.config.ui.messages.resume.messageTimeout);
    } catch (err) {
      console.error("Resume upload error:", err);
      uploadStatus.textContent = this.config.ui.messages.resume.error;
    }
  }

  private async handleResumeDelete() {
    const { uploadStatus } = this.elements;
    try {
      const user = this.pb.authStore.model;
      if (!user?.id) {
        throw new Error("User ID not found");
      }

      await this.pb.collection("users").update(user.id, {
        resume: null
      });

      uploadStatus.textContent = this.config.ui.messages.resume.deleteSuccess;
      this.updateUI();

      setTimeout(() => {
        uploadStatus.textContent = "";
      }, this.config.ui.messages.resume.messageTimeout);
    } catch (err) {
      console.error("Resume deletion error:", err);
      uploadStatus.textContent = this.config.ui.messages.resume.deleteError;
    }
  }

  private async handleMemberIdButton() {
    const user = this.pb.authStore.model;
    if (user?.member_id && !this.isEditingMemberId) {
      this.isEditingMemberId = true;
      this.updateUI();
    } else {
      await this.handleMemberIdSave();
    }
  }

  private async handleMemberIdSave() {
    const { memberIdInput, memberIdStatus } = this.elements;
    const memberId = memberIdInput.value.trim();

    try {
      memberIdStatus.textContent = this.config.ui.messages.memberId.saving;

      const user = this.pb.authStore.model;
      if (!user?.id) {
        throw new Error("User ID not found");
      }

      await this.pb.collection("users").update(user.id, {
        member_id: memberId
      });

      memberIdStatus.textContent = this.config.ui.messages.memberId.success;
      this.isEditingMemberId = false;
      this.updateUI();

      setTimeout(() => {
        memberIdStatus.textContent = "";
      }, this.config.ui.messages.memberId.messageTimeout);
    } catch (err) {
      console.error("IEEE Member ID save error:", err);
      memberIdStatus.textContent = this.config.ui.messages.memberId.error;
    }
  }

  private async handleProfileSave() {
    const {
      profileEditor,
      editorName,
      editorEmail,
      editorMemberId,
      editorPoints,
      editorResume,
      saveProfileButton,
    } = this.elements;
    const userId = saveProfileButton.dataset.userId;

    if (!userId) {
      console.error("No user ID found for saving");
      return;
    }

    try {
      // First get the current user data to check existing resume
      const currentUser = await this.pb.collection("users").getOne(userId);

      const formData = new FormData();
      formData.append("name", editorName.value);
      formData.append("email", editorEmail.value);
      formData.append("member_id", editorMemberId.value);
      formData.append("points", editorPoints.value);

      // Only append resume if a new file is selected
      if (editorResume.files && editorResume.files.length > 0) {
        formData.append("resume", editorResume.files[0]);
      } else if (currentUser.resume) {
        // If no new file but there's an existing resume, keep it
        formData.append("resume", currentUser.resume);
      }

      await this.pb.collection("users").update(userId, formData);
      profileEditor.close();
      this.updateUI();
    } catch (err) {
      console.error("Failed to save user profile:", err);
    }
  }
}