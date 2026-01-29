import { useState, useEffect } from "react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../../../../firebase/client";
import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  updateDoc,
  doc,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import type {
  OfficerInvitation,
  UserRole,
  GoogleGroup,
} from "../../../shared/types/firestore";
import type {
  InvitationFormData,
  DirectOnboardingFormData,
  OnboardingStats,
} from "../types/OnboardingTypes";
import { showToast } from "../../../shared/utils/toast";

export function useOnboarding() {
  const [user] = useAuthState(auth);
  const [invitations, setInvitations] = useState<
    (OfficerInvitation & { id: string })[]
  >([]);
  const [stats, setStats] = useState<OnboardingStats>({
    totalInvitations: 0,
    pendingInvitations: 0,
    acceptedInvitations: 0,
    declinedInvitations: 0,
  });
  const [loading, setLoading] = useState(false);

  // Real-time listener for invitations
  useEffect(() => {
    if (!user) return;

    setLoading(true);

    const invitesRef = collection(db, "officerInvitations");
    const q = query(invitesRef, orderBy("invitedAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const invitationsList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as (OfficerInvitation & { id: string })[];

        setInvitations(invitationsList);

        // Calculate stats
        const newStats: OnboardingStats = {
          totalInvitations: invitationsList.length,
          pendingInvitations: invitationsList.filter(
            (i) => i.status === "pending",
          ).length,
          acceptedInvitations: invitationsList.filter(
            (i) => i.status === "accepted",
          ).length,
          declinedInvitations: invitationsList.filter(
            (i) => i.status === "declined",
          ).length,
        };
        setStats(newStats);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching invitations:", err);
        showToast.error("Failed to fetch invitations");
        setLoading(false);
      },
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [user]);

  // Determine Google Group based on role
  const getGoogleGroupForRole = (role: UserRole): GoogleGroup | null => {
    switch (role) {
      case "Executive Officer":
      case "Administrator":
        return "executive-officers@ieeeatucsd.org";
      case "General Officer":
        return "general-officers@ieeeatucsd.org";
      case "Past Officer":
        return "past-officers@ieeeatucsd.org";
      default:
        return null;
    }
  };

  // Send invitation email
  const sendInvitation = async (formData: InvitationFormData) => {
    if (!user) {
      showToast.error("You must be logged in to send invitations");
      return;
    }

    try {
      setLoading(true);

      // Parse the acceptance deadline from datetime-local input
      const expiresAt = new Date(formData.acceptanceDeadline);

      // Validate the date
      if (isNaN(expiresAt.getTime())) {
        throw new Error("Invalid acceptance deadline");
      }

      // Check if deadline is in the future
      if (expiresAt <= new Date()) {
        throw new Error("Acceptance deadline must be in the future");
      }

      // Format deadline for email display
      const formattedDeadline = expiresAt.toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
      });

      // Create invitation record
      const invitationData: Omit<OfficerInvitation, "id"> = {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        position: formData.position,
        status: "pending",
        invitedBy: user.uid,
        invitedAt: Timestamp.now(),
        expiresAt: Timestamp.fromDate(expiresAt),
        message: formData.message,
        acceptanceDeadline: formattedDeadline,
        leaderName: formData.leaderName,
        googleGroupAssigned: false,
        permissionsGranted: false,
        onboardingEmailSent: false,
        lastSentAt: Timestamp.now(),
      };

      const inviteRef = await addDoc(
        collection(db, "officerInvitations"),
        invitationData,
      );

      // Send invitation email via API
      const response = await fetch("/api/onboarding/send-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteId: inviteRef.id,
          name: formData.name,
          email: formData.email,
          role: formData.role,
          position: formData.position,
          acceptanceDeadline: formattedDeadline,
          message: formData.message,
          leaderName: formData.leaderName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send invitation email");
      }

      showToast.success(`Invitation sent successfully to ${formData.name}!`);
      // Real-time listener will automatically update invitations
    } catch (err) {
      console.error("Error sending invitation:", err);
      showToast.error(
        err instanceof Error ? err.message : "Failed to send invitation",
      );
    } finally {
      setLoading(false);
    }
  };

  // Send direct onboarding
  const sendDirectOnboarding = async (formData: DirectOnboardingFormData) => {
    if (!user) {
      showToast.error("You must be logged in to onboard officers");
      return;
    }

    try {
      setLoading(true);

      // Send onboarding email and create user via API
      const response = await fetch("/api/onboarding/send-direct-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          role: formData.role,
          position: formData.position,
          leaderName: formData.leaderName,
          customMessage: formData.customMessage,
          emailTemplate: formData.emailTemplate,
          onboardedBy: user.uid,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send onboarding email");
      }

      showToast.success(`${formData.name} has been onboarded successfully!`);
    } catch (err) {
      console.error("Error sending direct onboarding:", err);
      showToast.error(
        err instanceof Error ? err.message : "Failed to onboard officer",
      );
    } finally {
      setLoading(false);
    }
  };

  // Resend invitation
  const resendInvitation = async (invitationId: string) => {
    if (!user) {
      showToast.error("You must be logged in to resend invitations");
      return;
    }

    try {
      setLoading(true);

      // Call API to resend invitation
      const response = await fetch("/api/onboarding/resend-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to resend invitation");
      }

      showToast.success("Invitation resent successfully!");
      // Real-time listener will automatically update invitations
    } catch (err) {
      console.error("Error resending invitation:", err);
      showToast.error(
        err instanceof Error ? err.message : "Failed to resend invitation",
      );
    } finally {
      setLoading(false);
    }
  };

  // Refresh invitations (no-op since real-time listener handles updates)
  const refreshInvitations = async () => {
    // Real-time listener automatically updates invitations
  };

  return {
    invitations,
    stats,
    loading,
    sendInvitation,
    sendDirectOnboarding,
    resendInvitation,
    refreshInvitations,
  };
}
