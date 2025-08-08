import { db } from "../../../../../firebase/client";
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";

/**
 * Debug function to check the specific event request that's failing
 */
export const debugEventRequest = async (eventId: string) => {
  console.log(`🔍 Debugging event request: ${eventId}`);
  
  try {
    // Check if it exists in event_requests collection
    const eventRequestSnap = await getDoc(doc(db, "event_requests", eventId));
    
    if (eventRequestSnap.exists()) {
      const data = eventRequestSnap.data();
      console.log("✅ Found in event_requests collection:", {
        id: eventId,
        requestedUser: data.requestedUser,
        name: data.name,
        status: data.status,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      });
      
      return {
        type: "event_request",
        exists: true,
        data: data,
      };
    } else {
      console.log("❌ Not found in event_requests collection");
      
      // Check if it exists in events collection
      const eventSnap = await getDoc(doc(db, "events", eventId));
      
      if (eventSnap.exists()) {
        const data = eventSnap.data();
        console.log("✅ Found in events collection:", {
          id: eventId,
          createdFrom: data.createdFrom,
          eventName: data.eventName,
          published: data.published,
        });
        
        // If it has createdFrom, check the original request
        if (data.createdFrom) {
          const originalRequestSnap = await getDoc(doc(db, "event_requests", data.createdFrom));
          if (originalRequestSnap.exists()) {
            const originalData = originalRequestSnap.data();
            console.log("✅ Found original event request:", {
              id: data.createdFrom,
              requestedUser: originalData.requestedUser,
              name: originalData.name,
            });
          }
        }
        
        return {
          type: "event",
          exists: true,
          data: data,
        };
      } else {
        console.log("❌ Not found in events collection either");
        return {
          type: "unknown",
          exists: false,
          data: null,
        };
      }
    }
  } catch (error) {
    console.error("❌ Error debugging event request:", error);
    return {
      type: "error",
      exists: false,
      data: null,
      error: error,
    };
  }
};

/**
 * Debug the specific failing event
 */
export const debugFailingEvent = () => {
  return debugEventRequest("r8MB50zWi1nFFFOvwteL");
};

// Export for console debugging
if (typeof window !== 'undefined') {
  (window as any).debugEventRequest = debugEventRequest;
  (window as any).debugFailingEvent = debugFailingEvent;
}
