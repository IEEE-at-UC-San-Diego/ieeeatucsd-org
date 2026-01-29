import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "../../../../../firebase/client";
import type {
  OfficerTeam,
  TeamLeaderboardEntry,
  TeamMember,
  LeaderboardSettings,
  OfficerLeaderboardData,
  OfficerTeamData,
} from "../types/OfficerLeaderboardTypes";

export class OfficerLeaderboardService {
  private static readonly SETTINGS_DOC_ID = "settings";

  /**
   * Get leaderboard settings (executive only)
   */
  static async getLeaderboardSettings(): Promise<LeaderboardSettings | null> {
    try {
      const settingsRef = doc(db, "leaderboard_settings", this.SETTINGS_DOC_ID);
      const settingsSnap = await getDoc(settingsRef);

      if (settingsSnap.exists()) {
        return settingsSnap.data() as LeaderboardSettings;
      }

      // Create default settings if none exist
      const defaultSettings: LeaderboardSettings = {
        id: this.SETTINGS_DOC_ID,
        startDate: Timestamp.fromDate(
          new Date(new Date().setMonth(new Date().getMonth() - 1)),
        ), // 1 month ago
        lastUpdated: Timestamp.now(),
        updatedBy: "",
      };

      await setDoc(settingsRef, defaultSettings);
      return defaultSettings;
    } catch (error) {
      console.error("Error getting leaderboard settings:", error);
      throw error;
    }
  }

  /**
   * Update leaderboard settings (executive only)
   */
  static async updateLeaderboardSettings(
    userId: string,
    updates: { startDate: Timestamp },
  ): Promise<void> {
    try {
      const settingsRef = doc(db, "leaderboard_settings", this.SETTINGS_DOC_ID);
      await updateDoc(settingsRef, {
        ...updates,
        lastUpdated: Timestamp.now(),
        updatedBy: userId,
      });
    } catch (error) {
      console.error("Error updating leaderboard settings:", error);
      throw error;
    }
  }

  /**
   * Get all officers from users collection
   */
  static async getOfficers(): Promise<TeamMember[]> {
    try {
      const usersQuery = query(
        collection(db, "users"),
        where("role", "in", [
          "General Officer",
          "Executive Officer",
          "Administrator",
        ]),
      );

      const querySnapshot = await getDocs(usersQuery);
      const officers: TeamMember[] = [];

      for (const doc of querySnapshot.docs) {
        const data = doc.data();
        officers.push({
          userId: doc.id,
          name: data.name || "Unknown",
          position: data.position || data.role || "Officer",
          role: data.role,
          joinDate: data.joinDate || Timestamp.now(),
          eventsAttended: data.eventsAttended || 0,
          team: data.team,
        });
      }

      return officers;
    } catch (error) {
      console.error("Error getting officers:", error);
      throw error;
    }
  }

  /**
   * Get event attendances for officers after a specific date
   * Queries the attendees subcollection for each event to get accurate attendance data
   * Returns both attendance data with event dates and total event count (excluding zero-attendance events)
   */
  static async getOfficerAttendances(startDate: Timestamp): Promise<{
    attendanceMap: Map<string, Array<{ eventId: string; endDate: Timestamp }>>;
    totalEvents: number;
  }> {
    try {
      const eventsQuery = query(
        collection(db, "events"),
        where("endDate", ">=", startDate),
        orderBy("endDate", "desc"),
      );

      const eventsSnapshot = await getDocs(eventsQuery);
      const attendanceMap = new Map<
        string,
        Array<{ eventId: string; endDate: Timestamp }>
      >();
      const eventsWithAttendees = new Set<string>();

      // For each event, query the attendees subcollection
      for (const eventDoc of eventsSnapshot.docs) {
        try {
          const eventData = eventDoc.data();
          const eventEndDate = eventData.endDate as Timestamp;

          const attendeesQuery = query(
            collection(db, "events", eventDoc.id, "attendees"),
          );
          const attendeesSnapshot = await getDocs(attendeesQuery);

          // Only count events that have at least one attendee
          if (attendeesSnapshot.docs.length > 0) {
            eventsWithAttendees.add(eventDoc.id);

            // Store event attendance with metadata
            for (const attendeeDoc of attendeesSnapshot.docs) {
              const attendeeData = attendeeDoc.data();
              const userId = attendeeData.userId || attendeeDoc.id;

              if (!attendanceMap.has(userId)) {
                attendanceMap.set(userId, []);
              }

              attendanceMap.get(userId)!.push({
                eventId: eventDoc.id,
                endDate: eventEndDate,
              });
            }
          }
        } catch (error) {
          console.error(
            `Error fetching attendees for event ${eventDoc.id}:`,
            error,
          );
          // Continue processing other events even if one fails
        }
      }

      return {
        attendanceMap,
        totalEvents: eventsWithAttendees.size, // Only count events with attendees
      };
    } catch (error) {
      console.error("Error getting officer attendances:", error);
      throw error;
    }
  }

  /**
   * Determine officer team based on database team field ONLY
   * No automatic assignment - respects explicit "No Team" assignments
   */
  static determineOfficerTeam(
    team: OfficerTeam | undefined,
  ): OfficerTeam | undefined {
    // Only use the team field from the database
    // If undefined, the officer has no team assignment
    return team;
  }

  /**
   * Calculate team leaderboard data
   */
  static async calculateTeamLeaderboard(): Promise<OfficerLeaderboardData> {
    try {
      const settings = await this.getLeaderboardSettings();
      if (!settings) {
        throw new Error("Could not retrieve leaderboard settings");
      }

      const officers = await this.getOfficers();
      const { attendanceMap, totalEvents } = await this.getOfficerAttendances(
        settings.startDate,
      );

      // Group officers by team (only include officers with explicit team assignments)
      const teams = new Map<OfficerTeam, TeamMember[]>();

      officers.forEach((officer) => {
        const team = this.determineOfficerTeam(officer.team);

        // Only include officers with explicit team assignments
        // Officers with undefined team are excluded from team leaderboards
        if (team) {
          if (!teams.has(team)) {
            teams.set(team, []);
          }

          // Filter events to only count those after the officer's join date
          const officerEvents = attendanceMap.get(officer.userId) || [];
          const validEvents = officerEvents.filter(
            (event) => event.endDate.toMillis() >= officer.joinDate.toMillis(),
          );

          teams.get(team)!.push({
            ...officer,
            eventsAttended: validEvents.length,
          });
        }
      });

      // Calculate team stats
      const teamData: OfficerTeamData[] = [];

      for (const [team, members] of teams.entries()) {
        // Only count officers who joined before or on the start date for team size
        const eligibleMembers = members.filter(
          (member) =>
            member.joinDate.toMillis() <= settings.startDate.toMillis(),
        );

        const teamSize = eligibleMembers.length;

        // Sum all members' events (including late-joiners)
        const totalAttendees = members.reduce(
          (sum, member) => sum + member.eventsAttended,
          0,
        );

        // Calculate attendance rate: (totalAttendees / totalPossibleAttendances) * 100
        // totalPossibleAttendances = totalEvents × teamSize (eligible members only)
        const totalPossibleAttendances = totalEvents * teamSize;
        const attendanceRate =
          totalPossibleAttendances > 0
            ? (totalAttendees / totalPossibleAttendances) * 100
            : 0;

        teamData.push({
          team,
          members, // Include ALL members (not just eligible ones)
          totalAttendees,
          teamSize, // Only eligible members count toward team size
          attendanceRate: Math.round(attendanceRate * 100) / 100, // Round to 2 decimal places
        });
      }

      // Sort by attendance rate (descending)
      teamData.sort((a, b) => b.attendanceRate - a.attendanceRate);

      return {
        teams: teamData,
        lastCalculated: Timestamp.now(),
        settings,
      };
    } catch (error) {
      console.error("Error calculating team leaderboard:", error);
      throw error;
    }
  }

  /**
   * Get formatted leaderboard data for display
   */
  static async getLeaderboardData(): Promise<TeamLeaderboardEntry[]> {
    try {
      const data = await this.calculateTeamLeaderboard();

      return data.teams.map((team) => ({
        team: team.team,
        totalAttendees: team.totalAttendees,
        teamSize: team.teamSize,
        attendanceRate: team.attendanceRate,
        members: team.members,
      }));
    } catch (error) {
      console.error("Error getting leaderboard data:", error);
      throw error;
    }
  }
}
