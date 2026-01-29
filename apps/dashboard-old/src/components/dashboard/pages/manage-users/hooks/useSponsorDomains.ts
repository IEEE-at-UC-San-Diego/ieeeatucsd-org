import { useState, useEffect } from "react";
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../../../../../firebase/client";
import { useAuthState } from "react-firebase-hooks/auth";
import type {
  SponsorDomain,
  SponsorTier,
} from "../../../shared/types/firestore";
import { showToast } from "../../../shared/utils/toast";

export interface SponsorDomainWithId extends SponsorDomain {
  id: string;
}

export interface SponsorDomainFormData {
  domain: string;
  organizationName: string;
  sponsorTier: SponsorTier;
}

export const useSponsorDomains = () => {
  const [user] = useAuthState(auth);
  const [domains, setDomains] = useState<SponsorDomainWithId[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch all sponsor domains
  const fetchDomains = async () => {
    try {
      setLoading(true);
      const domainsRef = collection(db, "sponsorDomains");
      const q = query(domainsRef, orderBy("createdAt", "desc"));
      const snapshot = await getDocs(q);

      const domainsList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as SponsorDomainWithId[];

      setDomains(domainsList);
    } catch (err: any) {
      console.error("Error fetching sponsor domains:", err);
      showToast.error(err.message || "Failed to fetch sponsor domains");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDomains();
  }, []);

  // Add a new sponsor domain
  const addDomain = async (formData: SponsorDomainFormData) => {
    if (!user) {
      showToast.error("You must be logged in to add a sponsor domain");
      return;
    }

    try {
      // Validate domain format
      if (!formData.domain.startsWith("@")) {
        showToast.error("Domain must start with @");
        return;
      }

      if (formData.domain.length < 3) {
        showToast.error("Domain must have at least one character after @");
        return;
      }

      // Check for duplicate domain
      const existingDomain = domains.find(
        (d) => d.domain.toLowerCase() === formData.domain.toLowerCase(),
      );
      if (existingDomain) {
        showToast.error("This domain already exists");
        return;
      }

      const domainData: Omit<SponsorDomain, "lastModified" | "lastModifiedBy"> =
        {
          domain: formData.domain.toLowerCase(),
          organizationName: formData.organizationName,
          sponsorTier: formData.sponsorTier,
          createdAt: Timestamp.now(),
          createdBy: user.uid,
        };

      await addDoc(collection(db, "sponsorDomains"), domainData);
      showToast.success("Sponsor domain added successfully");
      await fetchDomains();
    } catch (err: any) {
      console.error("Error adding sponsor domain:", err);
      showToast.error(err.message || "Failed to add sponsor domain");
    }
  };

  // Update an existing sponsor domain
  const updateDomain = async (
    domainId: string,
    formData: SponsorDomainFormData,
  ) => {
    if (!user) {
      showToast.error("You must be logged in to update a sponsor domain");
      return;
    }

    try {
      // Validate domain format
      if (!formData.domain.startsWith("@")) {
        showToast.error("Domain must start with @");
        return;
      }

      if (formData.domain.length < 3) {
        showToast.error("Domain must have at least one character after @");
        return;
      }

      // Check for duplicate domain (excluding current domain)
      const existingDomain = domains.find(
        (d) =>
          d.domain.toLowerCase() === formData.domain.toLowerCase() &&
          d.id !== domainId,
      );
      if (existingDomain) {
        showToast.error("This domain already exists");
        return;
      }

      const domainRef = doc(db, "sponsorDomains", domainId);
      await updateDoc(domainRef, {
        domain: formData.domain.toLowerCase(),
        organizationName: formData.organizationName,
        sponsorTier: formData.sponsorTier,
        lastModified: Timestamp.now(),
        lastModifiedBy: user.uid,
      });

      showToast.success("Sponsor domain updated successfully");
      await fetchDomains();
    } catch (err: any) {
      console.error("Error updating sponsor domain:", err);
      showToast.error(err.message || "Failed to update sponsor domain");
    }
  };

  // Delete a sponsor domain
  const deleteDomain = async (domainId: string) => {
    if (!user) {
      showToast.error("You must be logged in to delete a sponsor domain");
      return;
    }

    try {
      const domainRef = doc(db, "sponsorDomains", domainId);
      await deleteDoc(domainRef);
      showToast.success("Sponsor domain deleted successfully");
      await fetchDomains();
    } catch (err: any) {
      console.error("Error deleting sponsor domain:", err);
      showToast.error(err.message || "Failed to delete sponsor domain");
    }
  };

  return {
    domains,
    loading,
    addDomain,
    updateDomain,
    deleteDomain,
    fetchDomains,
  };
};
