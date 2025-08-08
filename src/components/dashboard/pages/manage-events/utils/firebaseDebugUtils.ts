import { auth, db } from "../../../../../firebase/client";
import { doc, getDoc } from "firebase/firestore";

export interface FirebaseDebugInfo {
  user: {
    isAuthenticated: boolean;
    uid?: string;
    email?: string;
    emailVerified?: boolean;
  };
  userRole?: string;
  eventPermissions?: {
    eventId: string;
    isEventRequestOwner?: boolean;
    isOfficer?: boolean;
    canSubmitEvents?: boolean;
    isEventPublic?: boolean;
    isTempEvent?: boolean;
    tempEventOwner?: boolean;
  };
}

export const getFirebaseDebugInfo = async (eventId?: string): Promise<FirebaseDebugInfo> => {
  const user = auth.currentUser;
  const debugInfo: FirebaseDebugInfo = {
    user: {
      isAuthenticated: !!user,
      uid: user?.uid,
      email: user?.email,
      emailVerified: user?.emailVerified,
    },
  };

  if (!user) {
    return debugInfo;
  }

  try {
    // Get user role
    const userDocSnap = await getDoc(doc(db, "users", user.uid));
    if (userDocSnap.exists()) {
      debugInfo.userRole = userDocSnap.data().role || "Member";
    }

    // Check event permissions if eventId provided
    if (eventId) {
      debugInfo.eventPermissions = {
        eventId,
        isOfficer: ["General Officer", "Executive Officer", "Administrator"].includes(debugInfo.userRole || ""),
        canSubmitEvents: ["General Officer", "Executive Officer", "Administrator"].includes(debugInfo.userRole || ""),
        isTempEvent: eventId.startsWith("temp_"),
        tempEventOwner: eventId.match(/^temp_[^_]+_(.+)$/)?.[1] === user.uid,
      };

      // Check if user owns the event request
      try {
        const eventRequestSnap = await getDoc(doc(db, "event_requests", eventId));
        if (eventRequestSnap.exists()) {
          debugInfo.eventPermissions.isEventRequestOwner = eventRequestSnap.data().requestedUser === user.uid;
        } else {
          // Check if it's an actual event with createdFrom field
          const eventSnap = await getDoc(doc(db, "events", eventId));
          if (eventSnap.exists()) {
            const eventData = eventSnap.data();
            debugInfo.eventPermissions.isEventPublic = eventData.published === true;
            
            if (eventData.createdFrom) {
              const originalRequestSnap = await getDoc(doc(db, "event_requests", eventData.createdFrom));
              if (originalRequestSnap.exists()) {
                debugInfo.eventPermissions.isEventRequestOwner = originalRequestSnap.data().requestedUser === user.uid;
              }
            }
          }
        }
      } catch (error) {
        console.warn("Could not check event ownership:", error);
      }
    }
  } catch (error) {
    console.error("Error getting Firebase debug info:", error);
  }

  return debugInfo;
};

export const logFirebaseDebugInfo = async (eventId?: string, context?: string) => {
  const debugInfo = await getFirebaseDebugInfo(eventId);
  console.log(`🔍 Firebase Debug Info${context ? ` (${context})` : ""}:`, debugInfo);
  return debugInfo;
};

export const checkStoragePermissions = (debugInfo: FirebaseDebugInfo): boolean => {
  if (!debugInfo.user.isAuthenticated) {
    console.error("❌ User not authenticated");
    return false;
  }

  if (!debugInfo.eventPermissions) {
    console.warn("⚠️ No event permissions to check");
    return false;
  }

  const { eventPermissions } = debugInfo;
  
  // Check various permission scenarios
  const hasPermission = 
    eventPermissions.isOfficer ||
    eventPermissions.canSubmitEvents ||
    eventPermissions.isEventRequestOwner ||
    eventPermissions.isEventPublic ||
    (eventPermissions.isTempEvent && eventPermissions.tempEventOwner);

  console.log("🔐 Storage Permission Check:", {
    hasPermission,
    reasons: {
      isOfficer: eventPermissions.isOfficer,
      canSubmitEvents: eventPermissions.canSubmitEvents,
      isEventRequestOwner: eventPermissions.isEventRequestOwner,
      isEventPublic: eventPermissions.isEventPublic,
      isTempEventOwner: eventPermissions.isTempEvent && eventPermissions.tempEventOwner,
    }
  });

  return hasPermission;
};
