import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  collectionGroup,
  getDocs,
  query,
  orderBy,
  where,
  doc,
  deleteDoc,
  updateDoc,
  onSnapshot,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../../../firebase/client";

import { EmailClient } from "../../../../../scripts/email/EmailClient";
import type { UserRole } from "../../../shared/types/firestore";
import type { EventStats } from "../types";
import { showToast } from "../../../shared/utils/toast";

interface EventRequest {
  id: string;
  name: string;
  location: string;
  startDateTime: any;
  endDateTime: any;
  eventDescription: string;
  status: string;
  requestedUser: string;
  createdAt: any;
  needsGraphics?: boolean;
  needsAsFunding?: boolean;
  graphicsCompleted?: boolean;
  graphicsFiles?: string[];
  published?: boolean;
  isDraft?: boolean;
  [key: string]: any;
}

export function useEventManagement(userId: string | undefined) {
  const [eventRequests, setEventRequests] = useState<EventRequest[]>([]);
  const [users, setUsers] = useState<
    Record<string, { name: string; email: string; pid?: string }>
  >({});
  const [loading, setLoading] = useState(false); // Start false to show cached data immediately
  const [currentUserRole, setCurrentUserRole] = useState<UserRole>("Member");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<string>("date-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [attendanceStats, setAttendanceStats] = useState<{ totalAttendees: number; uniqueAttendees: number }>({
    totalAttendees: 0,
    uniqueAttendees: 0,
  });
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const eventsPerPage = 10;

  // Use db from client

  // Fetch users and calculate attendance stats using collectionGroup query
  const fetchUsersAndStats = async () => {
    try {
      setAttendanceLoading(true);

      // Calculate accurate attendance stats using collectionGroup to query ALL attendees across all events
      let totalCheckIns = 0;
      const uniqueUserIds = new Set<string>();

      // Use collectionGroup to query all 'attendees' subcollections across all events
      const allAttendeesQuery = query(collectionGroup(db, "attendees"));
      const attendeesSnapshot = await getDocs(allAttendeesQuery);

      // Count all check-ins and track unique user IDs
      attendeesSnapshot.docs.forEach((doc) => {
        totalCheckIns++;
        const data = doc.data();
        if (data.userId) {
          uniqueUserIds.add(data.userId);
        }
      });

      setAttendanceStats({
        totalAttendees: totalCheckIns,
        uniqueAttendees: uniqueUserIds.size
      });

      // Fetch users for name/email mapping
      const usersMap: Record<string, { name: string; email: string; pid?: string }> = {};

      try {
        const usersRef = collection(db, "users");
        const usersSnapshot = await getDocs(usersRef);

        usersSnapshot.docs.forEach((doc) => {
          const data = doc.data();
          usersMap[doc.id] = {
            name: data.name || data.email || "Unknown User",
            email: data.email || "",
            pid: data.pid,
          };
        });
      } catch (fallbackError) {
        console.warn(
          "Could not fetch user data from users collection:",
          fallbackError,
        );
      }

      setUsers(usersMap);
    } catch (error) {
      console.error("Error fetching users and stats:", error);
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Get user name helper
  const getUserName = (userId: string) => {
    try {
      if (!userId || !users) return userId || "Unknown User";
      return users[userId]?.name || userId;
    } catch (error) {
      console.error("Error getting user name:", error);
      return userId || "Unknown User";
    }
  };

  // Setup real-time listener and fetch user role
  useEffect(() => {
    if (!userId) return;

    fetchUsersAndStats();

    const fetchUserRole = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUserRole(userData.role || "Member");
        } else {
          setCurrentUserRole("Member");
        }
      } catch (error) {
        console.error("Error fetching user role:", error);
        setCurrentUserRole("Member");
      }
    };

    fetchUserRole();

    const eventRequestsRef = collection(db, "event_requests");
    const q = query(eventRequestsRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const eventRequestsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as EventRequest[];

        // Fetch published status for each event request
        const eventRequestsWithPublishStatus = await Promise.all(
          eventRequestsData.map(async (request) => {
            try {
              const eventsQuery = query(
                collection(db, "events"),
                where("createdFrom", "==", request.id),
              );
              const eventsSnapshot = await getDocs(eventsQuery);

              if (!eventsSnapshot.empty) {
                const eventData = eventsSnapshot.docs[0].data();
                return {
                  ...request,
                  published: eventData.published || false,
                };
              }
              return { ...request, published: false };
            } catch (error) {
              console.error(
                `Error fetching published status for event ${request.id}:`,
                error,
              );
              return { ...request, published: false };
            }
          }),
        );

        setEventRequests(eventRequestsWithPublishStatus);
        setLoading(false);
      },
      (error) => {
        console.error("Error in real-time listener:", error);
        showToast.error("Failed to fetch event requests: " + error.message);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [db, userId]);

  // Delete event request
  const handleDeleteRequest = async (requestId: string, eventName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the event request "${eventName}"? This will also delete any corresponding published event.`,
      )
    ) {
      return;
    }

    try {
      const eventRequestDoc = await getDoc(
        doc(db, "event_requests", requestId),
      );
      const eventRequestData = eventRequestDoc.exists()
        ? eventRequestDoc.data()
        : null;

      let userData = null;
      if (eventRequestData?.requestedUser) {
        const userDoc = await getDoc(
          doc(db, "users", eventRequestData.requestedUser),
        );
        userData = userDoc.exists() ? userDoc.data() : null;
      }

      await deleteDoc(doc(db, "event_requests", requestId));

      const eventsRef = collection(db, "events");
      const eventsQuery = query(eventsRef, where("eventName", "==", eventName));
      const eventsSnapshot = await getDocs(eventsQuery);

      const deletePromises = eventsSnapshot.docs.map((eventDoc) =>
        deleteDoc(doc(db, "events", eventDoc.id)),
      );
      await Promise.all(deletePromises);

      if (eventRequestData && userData) {
        try {
          await EmailClient.notifyFirebaseEventDelete(
            requestId,
            eventName,
            eventRequestData.location || "",
            userData.name || userData.email || "Unknown User",
            userData.email || "",
            eventRequestData.status || "unknown",
          );
        } catch (emailError) {
          console.error("Failed to send deletion email:", emailError);
        }
      }

      showToast.success(`Event request "${eventName}" deleted successfully`);
    } catch (error) {
      console.error("Error deleting event request:", error);
      showToast.error("Failed to delete event request");
    }
  };

  // Update event status
  const handleUpdateEventStatus = async (
    requestId: string,
    newStatus: string,
    declinedReason?: string,
  ) => {
    try {
      const currentEventRequest = eventRequests.find(
        (req) => req.id === requestId,
      );
      const previousStatus = currentEventRequest?.status;

      const updateData: any = {
        status: newStatus,
        updatedAt: new Date(),
      };

      if (declinedReason) {
        updateData.declinedReason = declinedReason;
      }

      await updateDoc(doc(db, "event_requests", requestId), updateData);

      const eventsQuery = query(
        collection(db, "events"),
        where("createdFrom", "==", requestId),
      );
      const eventsSnapshot = await getDocs(eventsQuery);

      if (!eventsSnapshot.empty) {
        const eventDoc = eventsSnapshot.docs[0];
        const shouldPublish = newStatus === "approved";
        await updateDoc(doc(db, "events", eventDoc.id), {
          published: shouldPublish,
          updatedAt: new Date(),
        });
      }

      if (previousStatus && previousStatus !== newStatus) {
        try {
          await EmailClient.notifyFirebaseEventRequestStatusChange(
            requestId,
            newStatus,
            previousStatus,
            undefined,
            declinedReason,
          );
        } catch (emailError) {
          console.error("Failed to send status change email:", emailError);
        }
      }

      showToast.success(
        `Event request status updated to ${newStatus}${newStatus === "approved" ? " and published" : ""}`,
      );
    } catch (error) {
      console.error("Error updating event status:", error);
      showToast.error("Failed to update event status");
    }
  };

  // Helper function to get date range based on filter
  const getDateRange = (filter: string) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (filter) {
      case "last7days":
        return {
          start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
          end: now
        };
      case "last30days":
        return {
          start: new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000),
          end: now
        };
      case "last3months":
        return {
          start: new Date(today.getFullYear(), today.getMonth() - 3, today.getDate()),
          end: now
        };
      case "all":
      default:
        return null;
    }
  };

  // Filter and sort events
  const filteredEventRequests = useMemo(() => {
    return eventRequests.filter((request) => {
      try {
        const matchesSearch =
          searchTerm === "" ||
          (request.name &&
            request.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (request.location &&
            request.location
              .toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (request.requestedUser &&
            getUserName(request.requestedUser)
              .toLowerCase()
              .includes(searchTerm.toLowerCase()));

        // Check date range filter
        let matchesDateRange = true;
        if (dateRangeFilter !== "all") {
          const dateRange = getDateRange(dateRangeFilter);
          if (dateRange) {
            const eventDate = request.startDateTime?.toDate?.() ||
              (request.startDateTime?.toMillis ? new Date(request.startDateTime.toMillis()) : null) ||
              request.createdAt?.toDate?.() ||
              new Date(0);

            matchesDateRange = eventDate >= dateRange.start && eventDate <= dateRange.end;
          }
        }

        // Check status filter
        let matchesStatus = true;
        if (statusFilter !== "all") {
          matchesStatus = request.status === statusFilter;
        }

        // Show all events including drafts
        return matchesSearch && matchesDateRange && matchesStatus;
      } catch (error) {
        console.error("Error filtering event request:", error, request);
        return true;
      }
    });
  }, [eventRequests, searchTerm, users, dateRangeFilter, statusFilter]);

  const sortedEventRequests = useMemo(() => {
    return [...filteredEventRequests].sort((a, b) => {
      switch (sortBy) {
        case "date-desc": {
          const aStart =
            a.startDateTime?.toDate?.() ||
            (a.startDateTime?.toMillis
              ? new Date(a.startDateTime.toMillis())
              : null);
          const bStart =
            b.startDateTime?.toDate?.() ||
            (b.startDateTime?.toMillis
              ? new Date(b.startDateTime.toMillis())
              : null);
          const aDate = aStart || a.createdAt?.toDate?.() || new Date(0);
          const bDate = bStart || b.createdAt?.toDate?.() || new Date(0);
          return bDate.getTime() - aDate.getTime();
        }
        case "date-asc": {
          const aStart =
            a.startDateTime?.toDate?.() ||
            (a.startDateTime?.toMillis
              ? new Date(a.startDateTime.toMillis())
              : null);
          const bStart =
            b.startDateTime?.toDate?.() ||
            (b.startDateTime?.toMillis
              ? new Date(b.startDateTime.toMillis())
              : null);
          const aDate = aStart || a.createdAt?.toDate?.() || new Date(0);
          const bDate = bStart || b.createdAt?.toDate?.() || new Date(0);
          return aDate.getTime() - bDate.getTime();
        }
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "status-asc":
          return a.status.localeCompare(b.status);
        case "status-desc":
          return b.status.localeCompare(a.status);
        default:
          return 0;
      }
    });
  }, [filteredEventRequests, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedEventRequests.length / eventsPerPage);
  const startIndex = (currentPage - 1) * eventsPerPage;
  const endIndex = startIndex + eventsPerPage;
  const paginatedEventRequests = sortedEventRequests.slice(
    startIndex,
    endIndex,
  );

  // Calculate stats
  const stats: EventStats = useMemo(() => {
    const total = eventRequests.length;
    const published = eventRequests.filter(
      (req) => req.status === "approved",
    ).length;
    const drafts = eventRequests.filter(
      (req) => req.status === "submitted" || req.status === "pending",
    ).length;

    // Use the actual attendance data fetched from the attendees subcollections
    const { totalAttendees, uniqueAttendees } = attendanceStats;

    return {
      total,
      published,
      drafts,
      totalAttendees,
      uniqueAttendees,
    };
  }, [eventRequests, attendanceStats]);

  return {
    eventRequests,
    paginatedEventRequests,
    sortedEventRequests,
    users,
    loading,
    attendanceLoading,
    currentUserRole,
    searchTerm,
    sortBy,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    eventsPerPage,
    stats,
    dateRangeFilter,
    statusFilter,
    setSearchTerm,
    setSortBy,
    setCurrentPage,
    setDateRangeFilter,
    setStatusFilter,
    handleDeleteRequest,
    handleUpdateEventStatus,
    getUserName,
  };
}
