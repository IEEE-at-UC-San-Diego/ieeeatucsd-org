import { useState, useMemo, useEffect } from "react";
import {
  collection,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  Timestamp,
  deleteField,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../../../../../firebase/client";
import { useAuth } from "../../../../../hooks/useAuth";
import type { Link, UserRole } from "../../../shared/types/firestore";
import { LinkPermissionService } from "../utils/linkPermissions";
import { showToast } from "../../../shared/utils/toast";

export interface LinkFormData {
  url: string;
  title: string;
  category: string;
  description?: string;
  iconUrl?: string;
  shortUrl?: string;
  publishDate?: Timestamp | null;
  expireDate?: Timestamp | null;
}

export function useLinksManagement() {
  const { user, userRole: currentUserRole, loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [links, setLinks] = useState<Link[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [linksError, setLinksError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch links with real-time updates
  useEffect(() => {
    setLinksLoading(true);
    const linksQuery = query(
      collection(db, "links"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(
      linksQuery,
      (snapshot) => {
        const linksData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Link[];
        setLinks(linksData);
        setLinksLoading(false);
        setLinksError(null);
      },
      (error) => {
        console.error("Error fetching links:", error);
        setLinksError(error);
        setLinksLoading(false);
        showToast.error("Failed to load links. Please refresh the page.");
      },
    );

    return () => unsubscribe();
  }, []);

  // Filter links by date visibility only (for category counts)
  const visibleLinks = useMemo(() => {
    const now = Timestamp.now();

    return links.filter((link) => {
      // Date visibility filter - only show if within publish/expire window
      // Officers can see all links regardless of dates
      if (!LinkPermissionService.canManageLinks(currentUserRole)) {
        // Check publish date - link should be published
        if (link.publishDate && link.publishDate.toMillis() > now.toMillis()) {
          return false; // Not yet published
        }

        // Check expire date - link should not be expired
        if (link.expireDate && link.expireDate.toMillis() < now.toMillis()) {
          return false; // Already expired
        }
      }

      return true;
    });
  }, [links, currentUserRole]);

  // Filter links based on search and category
  const filteredLinks = useMemo(() => {
    return visibleLinks.filter((link) => {
      const matchesSearch =
        searchTerm === "" ||
        link.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        link.url.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory =
        categoryFilter === "all" || link.category === categoryFilter;

      return matchesSearch && matchesCategory;
    });
  }, [visibleLinks, searchTerm, categoryFilter]);

  // Create a new link
  const createLink = async (linkData: LinkFormData) => {
    if (!user) {
      showToast.error("You must be logged in to create links");
      return;
    }

    if (!LinkPermissionService.canManageLinks(currentUserRole)) {
      showToast.error("You don't have permission to create links");
      return;
    }

    try {
      setLoading(true);

      // Build the link object, omitting undefined fields
      const newLink: any = {
        url: linkData.url,
        title: linkData.title,
        category: linkData.category,
        createdAt: Timestamp.now(),
        createdBy: user.uid,
        lastModified: Timestamp.now(),
        lastModifiedBy: user.uid,
      };

      // Only add optional fields if they have values
      if (linkData.description) {
        newLink.description = linkData.description;
      }
      if (linkData.iconUrl) {
        newLink.iconUrl = linkData.iconUrl;
      }
      if (linkData.shortUrl) {
        newLink.shortUrl = linkData.shortUrl;
      }
      if (linkData.publishDate) {
        newLink.publishDate = linkData.publishDate;
      }
      if (linkData.expireDate) {
        newLink.expireDate = linkData.expireDate;
      }

      await addDoc(collection(db, "links"), newLink);
      showToast.success("Link created successfully!");
    } catch (error) {
      console.error("Error creating link:", error);
      showToast.error("Failed to create link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Update an existing link
  const updateLink = async (linkId: string, linkData: LinkFormData) => {
    if (!user) {
      showToast.error("You must be logged in to update links");
      return;
    }

    if (!LinkPermissionService.canManageLinks(currentUserRole)) {
      showToast.error("You don't have permission to update links");
      return;
    }

    try {
      setLoading(true);

      // Get the existing link to check what fields need to be cleared
      const linkRef = doc(db, "links", linkId);
      const linkDoc = await getDoc(linkRef);
      const existingLink = linkDoc.data() as Link;

      // Build the update object
      const updateData: any = {
        url: linkData.url,
        title: linkData.title,
        category: linkData.category,
        lastModified: Timestamp.now(),
        lastModifiedBy: user.uid,
      };

      // Handle optional fields - add, update, or delete
      // Description
      if (linkData.description) {
        updateData.description = linkData.description;
      } else if (existingLink.description) {
        updateData.description = deleteField();
      }

      // Icon URL
      if (linkData.iconUrl) {
        updateData.iconUrl = linkData.iconUrl;
      } else if (existingLink.iconUrl) {
        updateData.iconUrl = deleteField();
      }

      // Short URL
      if (linkData.shortUrl) {
        updateData.shortUrl = linkData.shortUrl;
      } else if (existingLink.shortUrl) {
        updateData.shortUrl = deleteField();
      }

      // Publish Date - explicitly handle null to clear the field
      if (linkData.publishDate) {
        updateData.publishDate = linkData.publishDate;
      } else if (linkData.publishDate === null && existingLink.publishDate) {
        updateData.publishDate = deleteField();
      }

      // Expire Date - explicitly handle null to clear the field
      if (linkData.expireDate) {
        updateData.expireDate = linkData.expireDate;
      } else if (linkData.expireDate === null && existingLink.expireDate) {
        updateData.expireDate = deleteField();
      }

      await updateDoc(linkRef, updateData);

      showToast.success("Link updated successfully!");
    } catch (error) {
      console.error("Error updating link:", error);
      showToast.error("Failed to update link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Delete a link
  const deleteLink = async (linkId: string) => {
    if (!user) {
      showToast.error("You must be logged in to delete links");
      return;
    }

    if (!LinkPermissionService.canManageLinks(currentUserRole)) {
      showToast.error("You don't have permission to delete links");
      return;
    }

    try {
      setLoading(true);

      await deleteDoc(doc(db, "links", linkId));
      showToast.success("Link deleted successfully!");
    } catch (error) {
      console.error("Error deleting link:", error);
      showToast.error("Failed to delete link. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Permission checks
  const canManageLinks = LinkPermissionService.canManageLinks(currentUserRole);

  return {
    // Data
    links: filteredLinks,
    visibleLinks, // Links filtered by date visibility only (for category counts)
    allLinks: links,
    currentUserRole,

    // State
    loading: authLoading || linksLoading,
    searchTerm,
    categoryFilter,

    // Actions
    createLink,
    updateLink,
    deleteLink,
    setSearchTerm,
    setCategoryFilter,

    // Permissions
    canManageLinks,

    // Auth
    user,
  };
}
