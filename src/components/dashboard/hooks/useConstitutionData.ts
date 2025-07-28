import { useState, useEffect, useRef, useCallback } from "react";
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth } from "../../../firebase/client";
import type {
  Constitution,
  ConstitutionSection,
  ConstitutionCollaborationSession,
} from "../types/firestore";
import { useConstitutionAudit } from "./useConstitutionAudit";

export const useConstitutionData = () => {
  const [user] = useAuthState(auth);
  const [constitution, setConstitution] = useState<Constitution | null>(null);
  const [sections, setSections] = useState<ConstitutionSection[]>([]);
  const [collaborationSession, setCollaborationSession] =
    useState<ConstitutionCollaborationSession | null>(null);
  const [activeCollaborators, setActiveCollaborators] = useState<
    Array<{ userId: string; userName: string; currentSection?: string }>
  >([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const db = getFirestore();
  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const constitutionId = "ieee-ucsd-constitution";

  // Initialize audit functionality
  const { createAuditEntry } = useConstitutionAudit(constitutionId); // Single shared constitution

  // Initialize or load constitution
  useEffect(() => {
    const initializeConstitution = async () => {
      if (!user) return;

      try {
        const constitutionRef = doc(db, "constitutions", constitutionId);
        const constitutionDoc = await getDoc(constitutionRef);

        if (!constitutionDoc.exists()) {
          // Create initial constitution
          const initialConstitution: Omit<Constitution, "id"> = {
            title: "IEEE at UC San Diego Constitution",
            organizationName: "IEEE at UC San Diego",
            sections: [],
            version: 1,
            status: "draft",
            createdAt: Timestamp.now(),
            lastModified: Timestamp.now(),
            lastModifiedBy: user.uid,
            collaborators: [user.uid],
          };

          await setDoc(constitutionRef, initialConstitution);
        }

        // Set up real-time listeners
        const unsubscribeConstitution = onSnapshot(constitutionRef, (doc) => {
          if (doc.exists()) {
            setConstitution({ id: doc.id, ...doc.data() } as Constitution);
          }
        });

        const sectionsQuery = query(
          collection(db, "constitutions", constitutionId, "sections"),
          orderBy("order", "asc"),
        );

        const unsubscribeSections = onSnapshot(sectionsQuery, (snapshot) => {
          const sectionsData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as ConstitutionSection[];
          setSections(sectionsData);
        });

        // Initialize collaboration session
        const sessionRef = doc(db, "collaborationSessions", constitutionId);
        const sessionDoc = await getDoc(sessionRef);

        if (!sessionDoc.exists()) {
          await setDoc(sessionRef, {
            constitutionId,
            activeUsers: [],
            locks: [],
            changes: [],
          });
        }

        const unsubscribeSession = onSnapshot(sessionRef, (doc) => {
          if (doc.exists()) {
            const session = {
              id: doc.id,
              ...doc.data(),
            } as ConstitutionCollaborationSession;
            setCollaborationSession(session);
            setActiveCollaborators(session.activeUsers || []);
          }
        });

        // Add current user to active users
        await updateUserPresence();

        setIsLoading(false);

        return () => {
          unsubscribeConstitution();
          unsubscribeSections();
          unsubscribeSession();
        };
      } catch (error) {
        console.error("Error initializing constitution:", error);
        setIsLoading(false);
      }
    };

    initializeConstitution();
  }, [user, db]);

  // Update user presence
  const updateUserPresence = async (selectedSection?: string | null) => {
    if (!user || !collaborationSession) return;

    const sessionRef = doc(db, "collaborationSessions", constitutionId);
    const currentActiveUsers = collaborationSession.activeUsers || [];

    const updatedUsers = currentActiveUsers.filter(
      (u) => u.userId !== user.uid,
    );
    const userUpdate: any = {
      userId: user.uid,
      userName: user.displayName || user.email || "Anonymous",
      lastSeen: Timestamp.now(),
    };

    // Only add currentSection if it's not null/undefined
    if (selectedSection) {
      userUpdate.currentSection = selectedSection;
    }

    updatedUsers.push(userUpdate);

    await updateDoc(sessionRef, {
      activeUsers: updatedUsers,
    });
  };

  // Clean up user presence on unmount
  useEffect(() => {
    return () => {
      if (user && collaborationSession) {
        const sessionRef = doc(db, "collaborationSessions", constitutionId);
        const updatedUsers = (collaborationSession.activeUsers || []).filter(
          (u) => u.userId !== user.uid,
        );
        updateDoc(sessionRef, { activeUsers: updatedUsers });
      }
    };
  }, [user, collaborationSession]);

  const addSection = async (
    type: ConstitutionSection["type"],
    parentId?: string,
  ) => {
    if (!user) return;

    const newOrder =
      sections.length > 0 ? Math.max(...sections.map((s) => s.order)) + 1 : 1;

    let title = "";
    let articleNumber: number | undefined;
    let sectionNumber: number | undefined;
    let amendmentNumber: number | undefined;

    // Auto-generate numbers based on existing sections
    const existingArticles = sections.filter(
      (s) => s.type === "article",
    ).length;
    const existingAmendments = sections.filter(
      (s) => s.type === "amendment",
    ).length;

    switch (type) {
      case "preamble":
        title = "Preamble";
        break;
      case "article":
        articleNumber = existingArticles + 1;
        title = `General Provisions`;
        break;
      case "section":
        if (parentId) {
          const parentSections = sections.filter(
            (s) => s.parentId === parentId && s.type === "section",
          ).length;
          sectionNumber = parentSections + 1;
          title = `Name of Student Organization`;
        }
        break;
      case "amendment":
        amendmentNumber = existingAmendments + 1;
        title = `Amendment ${amendmentNumber}`;
        break;
    }

    const newSection: Omit<ConstitutionSection, "id"> = {
      type,
      title,
      content: "",
      order: newOrder,
      ...(parentId && { parentId }),
      ...(articleNumber && { articleNumber }),
      ...(sectionNumber && { sectionNumber }),
      ...(amendmentNumber && { amendmentNumber }),
      createdAt: Timestamp.now(),
      lastModified: Timestamp.now(),
      lastModifiedBy: user.uid,
    };

    try {
      const sectionsRef = collection(
        db,
        "constitutions",
        constitutionId,
        "sections",
      );
      const docRef = await addDoc(sectionsRef, newSection);

      // Create audit entry for section creation
      await createAuditEntry(
        "create",
        docRef.id,
        undefined,
        newSection as ConstitutionSection,
      );
    } catch (error) {
      console.error("Error adding section:", error);
    }
  };

  const updateSection = async (
    sectionId: string,
    updates: Partial<ConstitutionSection>,
  ) => {
    if (!user) return;

    try {
      setSaveStatus("saving");

      // Get the current section data for audit logging
      const sectionRef = doc(
        db,
        "constitutions",
        constitutionId,
        "sections",
        sectionId,
      );
      const currentSectionDoc = await getDoc(sectionRef);
      const beforeState = currentSectionDoc.exists()
        ? (currentSectionDoc.data() as ConstitutionSection)
        : undefined;

      const finalUpdates = {
        ...updates,
        lastModified: Timestamp.now(),
        lastModifiedBy: user.uid,
      };

      await updateDoc(sectionRef, finalUpdates);

      // Create audit entry for section update
      if (beforeState) {
        const afterState = { ...beforeState, ...finalUpdates };
        await createAuditEntry("update", sectionId, beforeState, afterState);
      }

      setSaveStatus("saved");
      setLastSaved(new Date());
    } catch (error) {
      console.error("Error updating section:", error);
      setSaveStatus("error");
    }
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const deleteSection = async (sectionId: string) => {
    if (!user) return;

    try {
      // Get the section data before deletion for audit logging
      const sectionRef = doc(
        db,
        "constitutions",
        constitutionId,
        "sections",
        sectionId,
      );
      const sectionDoc = await getDoc(sectionRef);
      const sectionData = sectionDoc.exists()
        ? (sectionDoc.data() as ConstitutionSection)
        : undefined;

      await deleteDoc(sectionRef);

      // Create audit entry for section deletion
      if (sectionData) {
        await createAuditEntry("delete", sectionId, sectionData, undefined);
      }
    } catch (error) {
      console.error("Error deleting section:", error);
    }
  };

  const updateConstitutionVersion = async (version: number) => {
    if (!user || !constitutionId) return;

    try {
      setSaveStatus("saving");
      const constitutionRef = doc(db, "constitutions", constitutionId);
      await updateDoc(constitutionRef, {
        version,
        lastModified: Timestamp.now(),
        lastModifiedBy: user.uid,
      });
      setSaveStatus("saved");
      setLastSaved(new Date());
    } catch (error) {
      console.error("Error updating constitution version:", error);
      setSaveStatus("error");
    }
  };

  return {
    // State
    constitution,
    sections,
    collaborationSession,
    activeCollaborators,
    saveStatus,
    lastSaved,
    isLoading,

    // Functions
    addSection,
    updateSection,
    deleteSection,
    updateConstitutionVersion,
    updateUserPresence,

    // Constants
    constitutionId,
    user,
  };
};
