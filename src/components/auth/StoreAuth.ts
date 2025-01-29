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
  private cachedUsers: any[] = []; // Store users data
  private config = config;

  constructor() {
    this.pb = new PocketBase(this.config.api.baseUrl);
    this.elements = this.getElements();
    this.init();
  }

  private getElements(): AuthElements & { loadingSkeleton: HTMLDivElement } {
    // Fun typescript fixes
    const loginButton = document.getElementById(
      "loginButton",
    ) as HTMLButtonElement;
    const logoutButton = document.getElementById(
      "logoutButton",
    ) as HTMLButtonElement;
    const userInfo = document.getElementById("userInfo") as HTMLDivElement;
    const loadingSkeleton = document.getElementById(
      "loadingSkeleton",
    ) as HTMLDivElement;

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

    const userName = document.getElementById(
      "userName",
    ) as HTMLParagraphElement;
    const userEmail = document.getElementById(
      "userEmail",
    ) as HTMLParagraphElement;
    const memberStatus = document.getElementById(
      "memberStatus",
    ) as HTMLDivElement;
    const lastLogin = document.getElementById(
      "lastLogin",
    ) as HTMLParagraphElement;
    const storeContent = document.getElementById(
      "storeContent",
    ) as HTMLDivElement;
    const resumeUpload = document.getElementById(
      "resumeUpload",
    ) as HTMLInputElement;
    const resumeName = document.getElementById(
      "resumeName",
    ) as HTMLParagraphElement;
    const resumeDownload = document.getElementById(
      "resumeDownload",
    ) as HTMLAnchorElement;
    const deleteResume = document.getElementById(
      "deleteResume",
    ) as HTMLButtonElement;
    const uploadStatus = document.getElementById(
      "uploadStatus",
    ) as HTMLParagraphElement;
    const resumeActions = document.getElementById(
      "resumeActions",
    ) as HTMLDivElement;
    const memberIdInput = document.getElementById(
      "memberIdInput",
    ) as HTMLInputElement;
    const saveMemberId = document.getElementById(
      "saveMemberId",
    ) as HTMLButtonElement;
    const memberIdStatus = document.getElementById(
      "memberIdStatus",
    ) as HTMLParagraphElement;
    const officerViewToggle = document.getElementById(
      "officerViewToggle",
    ) as HTMLDivElement;
    const officerViewCheckbox = officerViewToggle?.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement;
    const officerContent = document.getElementById(
      "officerContent",
    ) as HTMLDivElement;
    const resumeList = document.getElementById(
      "resumeList",
    ) as HTMLTableSectionElement;
    const refreshResumes = document.getElementById(
      "refreshResumes",
    ) as HTMLButtonElement;
    const resumeSearch = document.getElementById(
      "resumeSearch",
    ) as HTMLInputElement;
    const searchResumes = document.getElementById(
      "searchResumes",
    ) as HTMLButtonElement;

    const profileEditor = document.getElementById(
      "profileEditor",
    ) as HTMLDialogElement;
    const editorName = document.getElementById(
      "editorName",
    ) as HTMLInputElement;
    const editorEmail = document.getElementById(
      "editorEmail",
    ) as HTMLInputElement;
    const editorMemberId = document.getElementById(
      "editorMemberId",
    ) as HTMLInputElement;
    const editorPoints = document.getElementById(
      "editorPoints",
    ) as HTMLInputElement;
    const editorResume = document.getElementById(
      "editorResume",
    ) as HTMLInputElement;
    const editorCurrentResume = document.getElementById(
      "editorCurrentResume",
    ) as HTMLParagraphElement;
    const saveProfileButton = document.getElementById(
      "saveProfileButton",
    ) as HTMLButtonElement;

    const sponsorViewToggle = document.getElementById(
      "sponsorViewToggle",
    ) as HTMLDivElement;

    const pdfViewer = document.getElementById("pdfViewer") as HTMLDialogElement;
    const pdfFrame = document.getElementById("pdfFrame") as HTMLIFrameElement;
    const pdfTitle = document.getElementById("pdfTitle") as HTMLHeadingElement;
    const pdfExternalLink = document.getElementById("pdfExternalLink") as HTMLAnchorElement;

    if (
      !loginButton ||
      !logoutButton ||
      !userInfo ||
      !storeContent ||
      !userName ||
      !userEmail ||
      !memberStatus ||
      !lastLogin ||
      !resumeUpload ||
      !resumeName ||
      !loadingSkeleton ||
      !resumeDownload ||
      !deleteResume ||
      !uploadStatus ||
      !resumeActions ||
      !memberIdInput ||
      !saveMemberId ||
      !memberIdStatus ||
      !officerViewToggle ||
      !officerViewCheckbox ||
      !officerContent ||
      !resumeList ||
      !refreshResumes ||
      !resumeSearch ||
      !searchResumes ||
      !profileEditor ||
      !editorName ||
      !editorEmail ||
      !editorMemberId ||
      !editorPoints ||
      !editorResume ||
      !editorCurrentResume ||
      !saveProfileButton ||
      !sponsorViewToggle ||
      !pdfViewer ||
      !pdfFrame ||
      !pdfTitle ||
      !pdfExternalLink
    ) {
      throw new Error("Required DOM elements not found");
    }

    return {
      loginButton,
      logoutButton,
      userInfo,
      userName,
      userEmail,
      memberStatus,
      lastLogin,
      storeContent,
      resumeUpload,
      resumeName,
      loadingSkeleton,
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
      pdfExternalLink,
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
      saveMemberId.classList.remove("enabled:btn-primary");
      saveMemberId.classList.add("enabled:btn-ghost", "enabled:btn-outline");
    } else {
      // No member ID or editing - show save button and enable input
      memberIdInput.disabled = false;
      saveMemberId.textContent = "Save";
      saveMemberId.classList.remove("enabled:btn-ghost", "enabled:btn-outline");
      saveMemberId.classList.add("enabled:btn-primary");
    }
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
      storeContent,
      resumeName,
      resumeDownload,
      resumeActions,
      memberIdInput,
      saveMemberId,
      resumeUpload,
      loadingSkeleton,
      officerViewToggle,
      officerContent,
      sponsorViewToggle,
    } = this.elements;

    // Hide buttons initially
    loginButton.style.display = "none";
    logoutButton.style.display = "none";

    if (this.pb.authStore.isValid && this.pb.authStore.model) {
      // Update all the user information first
      const user = this.pb.authStore.model;
      const isSponsor = user.member_type === this.config.roles.sponsor.name;

      userName.textContent = user.name || this.config.ui.messages.auth.notProvided;
      userEmail.textContent = user.email || this.config.ui.messages.auth.notAvailable;

      // Hide member ID and resume sections for sponsors
      const memberIdSection = memberIdInput.closest('.space-y-1') as HTMLElement;
      const resumeSection = resumeUpload.closest('.space-y-2')?.parentElement as HTMLElement;
      const memberIdDivider = memberIdSection?.nextElementSibling as HTMLElement;
      const resumeDivider = resumeSection?.nextElementSibling as HTMLElement;

      if (isSponsor) {
        // Hide member ID and resume sections for sponsors
        if (memberIdSection) memberIdSection.style.display = 'none';
        if (memberIdDivider) memberIdDivider.style.display = 'none';
        if (resumeSection) resumeSection.style.display = 'none';
        if (resumeDivider) resumeDivider.style.display = 'none';
      } else {
        // Show and enable member ID input and save button for non-sponsors
        if (memberIdSection) memberIdSection.style.display = '';
        if (memberIdDivider) memberIdDivider.style.display = '';
        if (resumeSection) resumeSection.style.display = '';
        if (resumeDivider) resumeDivider.style.display = '';
        
        memberIdInput.disabled = false;
        saveMemberId.disabled = false;
        resumeUpload.disabled = false;
      }

      // Update member status
      if (user.verified) {
        // Check and update member_type if not set
        if (!user.member_type) {
          try {
            const isIeeeOfficer = user.email?.toLowerCase().endsWith(this.config.autoDetection.officer.emailDomain) || false;
            const newMemberType = isIeeeOfficer
              ? this.config.roles.officer.name
              : this.config.roles.member.name;

            await this.pb.collection("users").update(user.id, {
              member_type: newMemberType,
            });

            user.member_type = newMemberType;
          } catch (err) {
            console.error("Failed to update member type:", err);
          }
        }

        memberStatus.textContent = user.member_type || this.config.roles.member.name;
        memberStatus.classList.remove(
          "badge-neutral",
          "badge-success",
          "badge-warning",
          "badge-info",
          "badge-error",
        );

        // Set color based on member type
        const role = Object.values(this.config.roles).find(r => r.name === user.member_type);
        if (role) {
          memberStatus.classList.add(role.badge);
        } else {
          memberStatus.classList.add(this.config.roles.member.badge);
        }

        // Handle view toggles visibility
        const isOfficer = [
          this.config.roles.officer.name,
          this.config.roles.administrator.name
        ].includes(user.member_type || "");
        const isSponsor = user.member_type === this.config.roles.sponsor.name;

        officerViewToggle.style.display = isOfficer ? "block" : "none";
        sponsorViewToggle.style.display = isSponsor ? "block" : "none";

        // If user is an officer or sponsor, preload the table data
        if (isOfficer || isSponsor) {
          await this.fetchUserResumes();
        }
      } else {
        memberStatus.textContent = this.config.ui.messages.auth.notVerified;
        memberStatus.classList.remove(
          "badge-info",
          "badge-warning",
          "badge-success",
          "badge-error",
        );
        memberStatus.classList.add("badge-neutral");
      }

      // Update member ID input and state
      memberIdInput.value = user.member_id || "";
      this.updateMemberIdState();

      // Update last login
      const lastLoginDate = user.last_login
        ? new Date(user.last_login).toLocaleString()
        : this.config.ui.messages.auth.never;
      lastLogin.textContent = lastLoginDate;

      // Update resume section
      if (
        user.resume &&
        (!Array.isArray(user.resume) || user.resume.length > 0)
      ) {
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

      // After everything is updated, show the content
      loadingSkeleton.style.display = "none";
      userInfo.classList.remove("hidden");
      // Use a small delay to ensure the transition works
      setTimeout(() => {
        userInfo.style.opacity = "1";
      }, 50);

      logoutButton.style.display = "block";
    } else {
      // Update for logged out state
      userName.textContent = this.config.ui.messages.auth.notSignedIn;
      userEmail.textContent = this.config.ui.messages.auth.notSignedIn;
      memberStatus.textContent = this.config.ui.messages.auth.notVerified;
      memberStatus.classList.remove(
        "badge-info",
        "badge-warning",
        "badge-success",
        "badge-error",
      );
      memberStatus.classList.add("badge-neutral");
      lastLogin.textContent = this.config.ui.messages.auth.never;

      // Disable member ID input and save button
      memberIdInput.disabled = true;
      saveMemberId.disabled = true;

      // Disable resume upload
      resumeUpload.disabled = true;

      // Reset member ID
      memberIdInput.value = "";
      this.isEditingMemberId = false;
      this.updateMemberIdState();

      // Reset resume section
      resumeName.textContent = "No resume uploaded";
      resumeDownload.href = "#";
      resumeDownload.onclick = null;
      resumeActions.style.display = "none";

      // After everything is updated, show the content
      loadingSkeleton.style.display = "none";
      userInfo.classList.remove("hidden");
      // Use a small delay to ensure the transition works
      setTimeout(() => {
        userInfo.style.opacity = "1";
      }, 50);

      loginButton.style.display = "block";
      officerViewToggle.style.display = "none";
      sponsorViewToggle.style.display = "none";
    }
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
      memberIdStatus.textContent = this.config.ui.messages.memberId.saving;

      const user = this.pb.authStore.model;
      if (!user?.id) {
        throw new Error("User ID not found");
      }

      await this.pb.collection("users").update(user.id, {
        member_id: memberId,
      });

      memberIdStatus.textContent = this.config.ui.messages.memberId.success;
      this.isEditingMemberId = false;
      this.updateUI();

      // Clear the status message after a delay
      setTimeout(() => {
        memberIdStatus.textContent = "";
      }, this.config.ui.messages.memberId.messageTimeout);
    } catch (err: any) {
      console.error("IEEE Member ID save error:", err);
      memberIdStatus.textContent = this.config.ui.messages.memberId.error;
    }
  }

  private async handleResumeUpload(file: File) {
    const { uploadStatus } = this.elements;

    // Check file type and size
    if (!this.config.resume.allowedTypes.some(type => file.name.toLowerCase().endsWith(type))) {
      uploadStatus.textContent = `File type not allowed. Allowed types: ${this.config.resume.allowedTypes.join(", ")}`;
      return;
    }

    if (file.size > this.config.resume.maxSize) {
      uploadStatus.textContent = `File too large. Maximum size: ${this.config.resume.maxSize / 1024 / 1024}MB`;
      return;
    }

    try {
      uploadStatus.textContent = this.config.ui.messages.resume.uploading;

      const formData = new FormData();
      formData.append("resume", file);

      const user = this.pb.authStore.model;
      if (!user?.id) {
        throw new Error("User ID not found");
      }

      // Get current user data first
      const currentUser = await this.pb.collection("users").getOne(user.id);

      // Keep existing data
      formData.append("name", currentUser.name || "");
      formData.append("email", currentUser.email || "");
      formData.append("member_id", currentUser.member_id || "");
      formData.append("points", currentUser.points?.toString() || "0");

      await this.pb.collection("users").update(user.id, formData);

      uploadStatus.textContent = this.config.ui.messages.resume.success;
      this.updateUI();

      // Clear the file input
      this.elements.resumeUpload.value = "";

      // Clear the status message after a delay
      setTimeout(() => {
        uploadStatus.textContent = "";
      }, this.config.ui.messages.resume.messageTimeout);
    } catch (err: any) {
      console.error("Resume upload error:", err);
      uploadStatus.textContent = this.config.ui.messages.resume.error;
    }
  }

  private async handleResumeDelete() {
    const { uploadStatus } = this.elements;

    try {
      uploadStatus.textContent = this.config.ui.messages.resume.deleting;

      const user = this.pb.authStore.model;
      if (!user?.id) {
        throw new Error("User ID not found");
      }

      await this.pb.collection("users").update(user.id, {
        resume: null,
      });

      uploadStatus.textContent = this.config.ui.messages.resume.deleteSuccess;
      this.updateUI();

      // Clear the status message after a delay
      setTimeout(() => {
        uploadStatus.textContent = "";
      }, this.config.ui.messages.resume.messageTimeout);
    } catch (err: any) {
      console.error("Resume deletion error:", err);
      uploadStatus.textContent = this.config.ui.messages.resume.deleteError;
    }
  }

  private async handleLogin() {
    console.log("Starting OAuth2 authentication...");
    try {
      const authMethods = await this.pb.collection("users").listAuthMethods();
      const oidcProvider = authMethods.oauth2?.providers?.find(
        (p: { name: string }) => p.name === this.config.api.oauth2.providerName,
      );

      if (!oidcProvider) {
        throw new Error("OIDC provider not found");
      }

      // Store provider info for the redirect page
      localStorage.setItem("provider", JSON.stringify(oidcProvider));

      // Redirect to the authorization URL
      const redirectUrl = window.location.origin + this.config.api.oauth2.redirectPath;
      const authUrl = oidcProvider.authURL + encodeURIComponent(redirectUrl);
      window.location.href = authUrl;
    } catch (err: any) {
      console.error("Authentication error:", err);
      this.elements.userEmail.textContent = this.config.ui.messages.auth.loginError;
      this.elements.userName.textContent = "Error";
    }
  }

  private handleLogout() {
    // Clear auth store
    this.pb.authStore.clear();
    
    // Clear cached users
    this.cachedUsers = [];

    // Reset member ID editing state
    this.isEditingMemberId = false;

    // Show all sections that might have been hidden
    const memberIdSection = this.elements.memberIdInput.closest('.space-y-1') as HTMLElement;
    const resumeSection = this.elements.resumeUpload.closest('.space-y-2')?.parentElement as HTMLElement;
    const memberIdDivider = memberIdSection?.nextElementSibling as HTMLElement;
    const resumeDivider = resumeSection?.nextElementSibling as HTMLElement;

    // Show all sections
    if (memberIdSection) memberIdSection.style.display = '';
    if (memberIdDivider) memberIdDivider.style.display = '';
    if (resumeSection) resumeSection.style.display = '';
    if (resumeDivider) resumeDivider.style.display = '';

    // Update UI
    this.updateUI();
  }

  private async fetchUserResumes(searchQuery: string = "") {
    try {
      // Only fetch from API if we don't have cached data
      if (this.cachedUsers.length === 0) {
        const records = await this.pb.collection("users").getList(1, this.config.ui.defaults.pageSize, {
          sort: this.config.ui.defaults.sortField,
          fields: "id,name,email,member_id,resume,points,collectionId,collectionName",
          expand: "resume",
        });
        this.cachedUsers = records.items;
      }

      // Filter cached data based on search query
      let filteredUsers = this.cachedUsers;
      if (searchQuery) {
        const terms = searchQuery.toLowerCase().split(" ").filter(term => term.length > 0);
        if (terms.length > 0) {
          filteredUsers = this.cachedUsers.filter(user => {
            return terms.every(term => 
              (user.name?.toLowerCase().includes(term) || 
               user.email?.toLowerCase().includes(term) || 
               user.member_id?.toLowerCase().includes(term))
            );
          });
        }
      }

      const { resumeList } = this.elements;
      const fragment = document.createDocumentFragment();
      const isSponsor = this.pb.authStore.model?.member_type === this.config.roles.sponsor.name;

      if (filteredUsers.length === 0) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td colspan="6" class="text-center py-4">
            ${searchQuery ? "No users found matching your search." : "No users found."}
          </td>
        `;
        fragment.appendChild(row);
      } else {
        filteredUsers.forEach((user) => {
          const row = document.createElement("tr");
          const resumeUrl = user.resume && user.resume !== ""
            ? this.pb.files.getURL(user, user.resume.toString())
            : null;
          const fileName = resumeUrl ? this.getFileNameFromUrl(user.resume.toString()) : null;

          // Create edit button only if not a sponsor
          const editButton = !isSponsor ? `
            <button class="btn btn-ghost btn-xs edit-profile" data-user-id="${user.id}">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Edit
            </button>
          ` : '';

          // Create view resume link
          const viewResumeLink = resumeUrl
            ? `<a href="#" class="btn btn-ghost btn-xs" onclick="event.preventDefault(); document.dispatchEvent(new CustomEvent('viewResume', { detail: { url: '${resumeUrl}', fileName: '${fileName}' } }));">View Resume</a>`
            : '<span class="text-sm opacity-50">No resume</span>';

          row.innerHTML = `
            <td class="block lg:table-cell">
              <!-- Mobile View -->
              <div class="lg:hidden space-y-2">
                <div class="font-medium">${user.name || "N/A"}</div>
                <div class="text-sm opacity-70">${user.email || "N/A"}</div>
                <div class="text-sm opacity-70">ID: ${user.member_id || "N/A"}</div>
                <div class="text-sm opacity-70">Points: ${user.points || 0}</div>
                <div class="flex items-center justify-between">
                  ${viewResumeLink}
                  ${editButton}
                </div>
              </div>

              <!-- Desktop View -->
              <span class="hidden lg:block">${user.name || "N/A"}</span>
            </td>
            <td class="hidden lg:table-cell">${user.email || "N/A"}</td>
            <td class="hidden lg:table-cell">${user.member_id || "N/A"}</td>
            <td class="hidden lg:table-cell">${user.points || 0}</td>
            <td class="hidden lg:table-cell">
              ${viewResumeLink}
            </td>
            <td class="hidden lg:table-cell">
              ${editButton}
            </td>
          `;

          fragment.appendChild(row);
        });
      }

      resumeList.innerHTML = "";
      resumeList.appendChild(fragment);

      // Setup edit profile event listeners only if not a sponsor
      if (!isSponsor) {
        const editButtons = resumeList.querySelectorAll(".edit-profile");
        editButtons.forEach((button) => {
          button.addEventListener("click", () => {
            const userId = (button as HTMLButtonElement).dataset.userId;
            if (userId) {
              this.handleProfileEdit(userId);
            }
          });
        });
      }
    } catch (err) {
      console.error("Failed to fetch user resumes:", err);
      const { resumeList } = this.elements;
      resumeList.innerHTML = `
        <tr>
          <td colspan="6" class="text-center py-4 text-error">
            Failed to fetch resumes. Please try again.
          </td>
        </tr>
      `;
    }
  }

  private async handleProfileEdit(userId: string) {
    try {
      const user = await this.pb.collection("users").getOne(userId);
      const {
        profileEditor,
        editorName,
        editorEmail,
        editorMemberId,
        editorPoints,
        editorCurrentResume,
        saveProfileButton,
      } = this.elements;

      // Populate the form
      editorName.value = user.name || "";
      editorEmail.value = user.email || "";
      editorMemberId.value = user.member_id || "";
      editorPoints.value = user.points?.toString() || "0";

      // Update resume display
      if (user.resume) {
        const resumeUrl = this.pb.files.getURL(user, user.resume.toString());
        const fileName = this.getFileNameFromUrl(resumeUrl);
        editorCurrentResume.textContent = `Current resume: ${fileName}`;
        editorCurrentResume.classList.remove("opacity-70");
      } else {
        editorCurrentResume.textContent = "No resume uploaded";
        editorCurrentResume.classList.add("opacity-70");
      }

      // Store the user ID for saving
      saveProfileButton.dataset.userId = userId;

      // Show the dialog
      profileEditor.showModal();
    } catch (err) {
      console.error("Failed to load user for editing:", err);
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

      // Log the form data for debugging
      console.log("Form data being sent:", {
        name: editorName.value,
        email: editorEmail.value,
        member_id: editorMemberId.value,
        points: editorPoints.value,
        hasNewResume: editorResume.files && editorResume.files.length > 0,
        hasExistingResume: !!currentUser.resume,
      });

      const updatedUser = await this.pb
        .collection("users")
        .update(userId, formData);
      console.log("Update response:", updatedUser);

      // Close the dialog and refresh the table
      profileEditor.close();
      this.fetchUserResumes();
    } catch (err) {
      console.error("Failed to save user profile:", err);
    }
  }

  private handleResumeView(url: string, fileName: string) {
    const { pdfViewer, pdfFrame, pdfTitle, pdfExternalLink } = this.elements;
    pdfFrame.src = url;
    pdfTitle.textContent = fileName;
    pdfExternalLink.href = url;
    pdfViewer.showModal();
  }

  private init() {
    // Initial UI update with loading state
    this.updateUI().catch(console.error);

    // Setup event listeners
    this.elements.loginButton.addEventListener("click", () =>
      this.handleLogin(),
    );
    this.elements.logoutButton.addEventListener("click", () =>
      this.handleLogout(),
    );

    // Resume upload event listener
    this.elements.resumeUpload.addEventListener("change", (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.handleResumeUpload(file);
      }
    });

    // Resume delete event listener
    this.elements.deleteResume.addEventListener("click", () =>
      this.handleResumeDelete(),
    );

    // Member ID save event listener
    this.elements.saveMemberId.addEventListener("click", () =>
      this.handleMemberIdButton(),
    );

    // Search functionality
    const handleSearch = () => {
      const searchQuery = this.elements.resumeSearch.value.trim();
      this.fetchUserResumes(searchQuery);
    };

    // Real-time search
    this.elements.resumeSearch.addEventListener("input", handleSearch);

    // Search button click handler
    this.elements.searchResumes.addEventListener("click", handleSearch);

    // Officer view toggle event listener
    this.elements.officerViewCheckbox.addEventListener("change", (e) => {
      const isChecked = (e.target as HTMLInputElement).checked;
      const storeItemsContainer = document.getElementById("storeItemsGrid");
      const { officerContent } = this.elements;

      if (storeItemsContainer) {
        storeItemsContainer.style.display = isChecked ? "none" : "grid";
      }
      officerContent.style.display = isChecked ? "block" : "none";

      // Uncheck sponsor view if officer view is checked
      if (isChecked) {
        const sponsorCheckbox = this.elements.sponsorViewToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
        if (sponsorCheckbox) {
          sponsorCheckbox.checked = false;
        }
      }
    });

    // Sponsor view toggle event listener
    const sponsorCheckbox = this.elements.sponsorViewToggle.querySelector('input[type="checkbox"]') as HTMLInputElement;
    if (sponsorCheckbox) {
      sponsorCheckbox.addEventListener("change", (e) => {
        const isChecked = (e.target as HTMLInputElement).checked;
        const storeItemsContainer = document.getElementById("storeItemsGrid");
        const { officerContent } = this.elements;

        if (storeItemsContainer) {
          storeItemsContainer.style.display = isChecked ? "none" : "grid";
        }
        officerContent.style.display = isChecked ? "block" : "none";

        // Uncheck officer view if sponsor view is checked
        if (isChecked) {
          this.elements.officerViewCheckbox.checked = false;
        }
      });
    }

    // Refresh resumes button event listener
    this.elements.refreshResumes.addEventListener("click", () => {
      this.elements.resumeSearch.value = ""; // Clear search when refreshing
      this.cachedUsers = []; // Clear the cache to force a new fetch
      this.fetchUserResumes();
    });

    // Listen for auth state changes
    this.pb.authStore.onChange(async (token) => {
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
}
