import { createFileRoute } from "@tanstack/react-router";
import { useAuthedMutation } from "@/hooks/useAuthedConvex";
import { api } from "@convex/_generated/api";
import { useAuth } from "@/hooks/useAuth";
import {
  Save,
  Shield,
  UserCircle,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { user, isLoading, logtoId } = useAuth();
  const updateProfile = useAuthedMutation(api.users.updateProfile);
  const [saving, setSaving] = useState(false);
  const [savingAiPreference, setSavingAiPreference] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Profile form state
  const [form, setForm] = useState({
    name: "",
    pid: "",
    major: "",
    graduationYear: "",
    memberId: "",
    zelleInformation: "",
  });
  const [aiFeaturesEnabled, setAiFeaturesEnabled] = useState(true);

  // Resume state
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  // Initialize form when user data loads
  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || "",
        pid: user.pid || "",
        major: user.major || "",
        graduationYear: user.graduationYear?.toString() || "",
        memberId: user.memberId || "",
        zelleInformation: user.zelleInformation || "",
      });
      setAiFeaturesEnabled(user.aiFeaturesEnabled !== false);
    }
  }, [user]);

  // Check if user is OAuth (Logto) user
  const isOAuthUser = () => {
    // All Logto users are OAuth users
    return user?.signInMethod === "logto" || user?.signInMethod !== "email";
  };

  const handleProfileUpdate = async () => {
    if (!logtoId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProfile({
        logtoId,
        ...(form.name && { name: form.name }),
        ...(form.pid && { pid: form.pid }),
        ...(form.major && { major: form.major }),
        ...(form.graduationYear && { graduationYear: parseInt(form.graduationYear) }),
        ...(form.memberId && { memberId: form.memberId }),
        ...(form.zelleInformation && { zelleInformation: form.zelleInformation }),
        syncPublicProfile: true,
      });
      setSuccess("Profile updated successfully!");
      toast.success("Profile updated successfully");
    } catch (err: any) {
      setError(err.message || "Failed to update profile");
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleResumeUpload = async () => {
    if (!resumeFile || !logtoId) return;

    setUploadingResume(true);
    setError(null);
    setSuccess(null);

    try {
      // In a real implementation, you'd upload to Convex storage or an external service
      // For now, we'll store a placeholder URL
      const resumeUrl = `https://example.com/resumes/${logtoId}/${resumeFile.name}`;
      
      await updateProfile({
        logtoId,
        resume: resumeUrl,
        syncPublicProfile: false,
      });
      
      setResumeFile(null);
      setSuccess("Resume uploaded successfully!");
      toast.success("Resume uploaded successfully");
    } catch (err: any) {
      setError("Failed to upload resume: " + (err.message || "Unknown error"));
      toast.error("Failed to upload resume");
    } finally {
      setUploadingResume(false);
    }
  };

  const handleResumeRemove = async () => {
    if (!logtoId || !user?.resume) return;

    if (!confirm("Are you sure you want to remove your resume?")) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProfile({
        logtoId,
        resume: undefined,
        syncPublicProfile: false,
      });
      setSuccess("Resume removed successfully!");
      toast.success("Resume removed successfully");
    } catch (err: any) {
      setError("Failed to remove resume: " + (err.message || "Unknown error"));
      toast.error("Failed to remove resume");
    } finally {
      setSaving(false);
    }
  };

  const handleAiPreferenceUpdate = async () => {
    if (!logtoId) return;

    setSavingAiPreference(true);
    setError(null);
    setSuccess(null);

    try {
      await updateProfile({
        logtoId,
        aiFeaturesEnabled,
        syncPublicProfile: false,
      });
      setSuccess("AI preferences updated successfully!");
      toast.success("AI preferences updated");
    } catch (err: any) {
      setError(err.message || "Failed to update AI preferences");
      toast.error("Failed to update AI preferences");
    } finally {
      setSavingAiPreference(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-8">
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>

          {/* AI Features Settings */}
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-base md:text-lg font-semibold">AI Features</h2>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Enable AI assistant and auto parsing</p>
                  <p className="text-sm text-muted-foreground">
                    Controls Officer AI chat, receipt parsing, invoice parsing, and payment detail extraction.
                  </p>
                </div>
                <Switch
                  checked={aiFeaturesEnabled}
                  onCheckedChange={setAiFeaturesEnabled}
                  aria-label="Enable AI features"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={handleAiPreferenceUpdate}
                disabled={savingAiPreference}
              >
                <Save className="h-4 w-4 mr-2" />
                {savingAiPreference ? "Saving..." : "Save AI Preferences"}
              </Button>
            </div>
          </div>

          {/* Profile Settings Card */}
          <div className="rounded-xl border bg-card p-6">
            <Skeleton className="h-6 w-32 mb-6" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <Skeleton className="h-10 w-32" />
            </div>
          </div>

          {/* Resume Upload Card */}
          <div className="rounded-xl border bg-card p-6">
            <Skeleton className="h-6 w-24 mb-6" />
            <div className="border-2 border-dashed rounded-lg p-8">
              <div className="text-center space-y-4">
                <Skeleton className="h-12 w-12 mx-auto rounded" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-48 mx-auto" />
                  <Skeleton className="h-3 w-32 mx-auto" />
                </div>
                <Skeleton className="h-10 w-24 mx-auto" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <header className="bg-background shadow-sm border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account settings and preferences
            </p>
          </div>
        </div>
      </header>

      {/* Settings Content */}
      <main className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
          {/* Status Messages */}
          {error && (
            <div className="flex items-center space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center space-x-2 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm md:text-base">{success}</span>
            </div>
          )}

          {/* AI Features Settings */}
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-amber-600" />
              </div>
              <h2 className="text-base md:text-lg font-semibold">AI Features</h2>
            </div>

            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Enable AI assistant and auto parsing</p>
                  <p className="text-sm text-muted-foreground">
                    Controls Officer AI chat, receipt parsing, invoice parsing, and payment detail extraction.
                  </p>
                </div>
                <Switch
                  checked={aiFeaturesEnabled}
                  onCheckedChange={setAiFeaturesEnabled}
                  aria-label="Enable AI features"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button
                onClick={handleAiPreferenceUpdate}
                disabled={savingAiPreference}
              >
                <Save className="h-4 w-4 mr-2" />
                {savingAiPreference ? "Saving..." : "Save AI Preferences"}
              </Button>
            </div>
          </div>

          {/* Profile Settings */}
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <UserCircle className="w-5 h-5 text-blue-600" />
              </div>
              <h2 className="text-base md:text-lg font-semibold">
                Profile Settings
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="John Doe"
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {isOAuthUser()
                    ? "Email cannot be changed for OAuth users"
                    : "Email cannot be changed"}
                </p>
              </div>
              <div>
                <Label htmlFor="pid">Student ID (PID)</Label>
                <Input
                  id="pid"
                  value={form.pid}
                  onChange={(e) => setForm({ ...form, pid: e.target.value })}
                  placeholder="A12345678"
                />
              </div>
              <div>
                <Label htmlFor="major">Major</Label>
                <Input
                  id="major"
                  value={form.major}
                  onChange={(e) =>
                    setForm({ ...form, major: e.target.value })
                  }
                  placeholder="Computer Science"
                />
              </div>
              <div>
                <Label htmlFor="graduationYear">Expected Graduation Year</Label>
                <Input
                  id="graduationYear"
                  type="number"
                  value={form.graduationYear}
                  onChange={(e) =>
                    setForm({ ...form, graduationYear: e.target.value })
                  }
                  placeholder="2025"
                  min="2024"
                  max="2030"
                />
              </div>
              <div>
                <Label htmlFor="memberId">IEEE Member ID (Optional)</Label>
                <Input
                  id="memberId"
                  value={form.memberId}
                  onChange={(e) =>
                    setForm({ ...form, memberId: e.target.value })
                  }
                  placeholder="12345678"
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="zelle">Zelle Information (Optional)</Label>
                <Input
                  id="zelle"
                  value={form.zelleInformation}
                  onChange={(e) =>
                    setForm({ ...form, zelleInformation: e.target.value })
                  }
                  placeholder="Phone number or email for reimbursements"
                />
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <Button onClick={handleProfileUpdate} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>

          {/* Resume Settings */}
          <div className="rounded-xl border bg-card p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-green-600" />
              </div>
              <h2 className="text-lg font-semibold">Resume</h2>
            </div>

            {user?.resume ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div className="flex items-center space-x-3">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Current Resume</p>
                      <p className="text-sm text-muted-foreground">
                        Uploaded resume file
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={user.resume}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      View
                    </a>
                    <button
                      onClick={handleResumeRemove}
                      disabled={saving}
                      className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </div>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-medium mb-2">Replace Resume</h3>
                  <div className="flex items-center space-x-4">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={(e) =>
                        setResumeFile(e.target.files?.[0] || null)
                      }
                      className="flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    <Button
                      onClick={handleResumeUpload}
                      disabled={!resumeFile || uploadingResume}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingResume ? "Uploading..." : "Replace"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  No resume uploaded. Upload your resume for networking
                  opportunities.
                </p>
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={(e) =>
                      setResumeFile(e.target.files?.[0] || null)
                    }
                    className="flex-1 text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                  />
                  <Button
                    onClick={handleResumeUpload}
                    disabled={!resumeFile || uploadingResume}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    {uploadingResume ? "Uploading..." : "Upload"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Accepted formats: PDF, DOC, DOCX
                </p>
              </div>
            )}
          </div>

          {/* Account Information */}
          <div className="rounded-xl border bg-card p-4 md:p-6">
            <div className="flex items-center space-x-3 mb-4 md:mb-6">
              <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-purple-600" />
              </div>
              <h2 className="text-base md:text-lg font-semibold">
                Account Information
              </h2>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Email</span>
                <span className="font-medium">{user?.email}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Role</span>
                <span className="font-medium">{user?.role}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Status</span>
                <span className="font-medium capitalize">{user?.status}</span>
              </div>
              <div className="flex justify-between py-2 border-b">
                <span className="text-muted-foreground">Sign-in Method</span>
                <span className="font-medium capitalize">
                  {user?.signInMethod || "Logto"}
                </span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Member Since</span>
                <span className="font-medium">
                  {user?.joinDate
                    ? new Date(user.joinDate).toLocaleDateString()
                    : "N/A"}
                </span>
              </div>
            </div>
          </div>

          {/* Security Note for OAuth users */}
          {isOAuthUser() && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="flex items-center space-x-2 text-blue-700">
                <Shield className="w-5 h-5" />
                <span className="font-medium">OAuth Account</span>
              </div>
              <p className="text-blue-600 mt-2 text-sm">
                You signed in with OAuth. To change your password, please visit
                your account settings in your OAuth provider.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
