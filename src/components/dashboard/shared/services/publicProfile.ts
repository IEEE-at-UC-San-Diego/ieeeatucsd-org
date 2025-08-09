import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { db } from "../../../../firebase/client";

export interface PublicProfile {
  name: string;
  points: number;
  major?: string;
  graduationYear?: number;
  eventsAttended: number;
  position?: string;
  userId: string; // Reference to the user ID
  lastUpdated: Date;
}

export class PublicProfileService {
  /**
   * Creates or updates a user's public profile
   */
  static async syncPublicProfile(
    userId: string,
    profileData: Partial<PublicProfile>,
  ): Promise<void> {
    try {
      // Use top-level public_profiles collection for better performance and simpler rules
      const publicProfileRef = doc(db, "public_profiles", userId);

      const syncData = {
        ...profileData,
        userId,
        lastUpdated: new Date(),
      };

      await setDoc(publicProfileRef, syncData, { merge: true });

      // Also sync to subcollection for backup/compatibility
      try {
        const subCollectionRef = doc(
          db,
          "users",
          userId,
          "public_profile",
          "profile",
        );
        await setDoc(subCollectionRef, syncData, { merge: true });
      } catch (subError) {
        // Failed to sync to subcollection, but main sync succeeded
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets a user's public profile
   */
  static async getPublicProfile(userId: string): Promise<PublicProfile | null> {
    try {
      // Try top-level collection first
      const publicProfileRef = doc(db, "public_profiles", userId);
      const profileSnap = await getDoc(publicProfileRef);

      if (profileSnap.exists()) {
        return profileSnap.data() as PublicProfile;
      }

      // Fallback to subcollection for backwards compatibility
      try {
        const subCollectionRef = doc(
          db,
          "users",
          userId,
          "public_profile",
          "profile",
        );
        const subProfileSnap = await getDoc(subCollectionRef);

        if (subProfileSnap.exists()) {
          return subProfileSnap.data() as PublicProfile;
        }
      } catch (subError) {
        // Failed to check subcollection fallback
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Gets all public profiles for leaderboard (sorted by points)
   */
  static async getLeaderboard(): Promise<(PublicProfile & { id: string })[]> {
    try {
      // Use top-level public_profiles collection for better performance
      const publicProfilesQuery = query(
        collection(db, "public_profiles"),
        orderBy("points", "desc"),
      );

      const snapshot = await getDocs(publicProfilesQuery);

      return snapshot.docs.map((doc) => ({
        id: doc.id, // Document ID is the user ID
        ...(doc.data() as PublicProfile),
      }));
    } catch (error) {
      throw error;
    }
  }

  /**
   * Updates points and events attended for a user
   */
  static async updateUserStats(
    userId: string,
    updates: { points?: number; eventsAttended?: number },
  ): Promise<void> {
    try {
      // Update top-level collection
      const publicProfileRef = doc(db, "public_profiles", userId);

      await updateDoc(publicProfileRef, {
        ...updates,
        lastUpdated: new Date(),
      });

      // Also update subcollection for backup/compatibility
      try {
        const subCollectionRef = doc(
          db,
          "users",
          userId,
          "public_profile",
          "profile",
        );
        await updateDoc(subCollectionRef, {
          ...updates,
          lastUpdated: new Date(),
        });
      } catch (subError) {
        // Failed to update subcollection, but main update succeeded
      }
    } catch (error) {
      throw error;
    }
  }

  /**
   * Migrates existing user data to public profiles
   */
  static async migrateFromUsersCollection(): Promise<void> {
    try {
      // Get all users from the users collection
      const usersRef = collection(db, "users");
      const usersSnapshot = await getDocs(usersRef);

      const migrationPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data();

        // Create public profile data from user data
        const publicProfileData: Partial<PublicProfile> = {
          name: userData.name || "Unknown User",
          points: userData.points || 0,
          major: userData.major,
          graduationYear: userData.graduationYear,
          eventsAttended: userData.eventsAttended || 0,
          position: userData.position || userData.role || "Member",
        };

        // Only migrate if user has meaningful data
        if (
          publicProfileData.name &&
          publicProfileData.name !== "Unknown User"
        ) {
          await PublicProfileService.syncPublicProfile(
            userDoc.id,
            publicProfileData,
          );
        }
      });

      await Promise.all(migrationPromises);
    } catch (error) {
      throw error;
    }
  }
}
