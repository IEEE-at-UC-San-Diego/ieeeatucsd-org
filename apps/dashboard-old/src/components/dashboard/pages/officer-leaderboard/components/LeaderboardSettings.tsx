import React, { useState, useEffect } from "react";
import { Calendar, Settings, Save, AlertCircle } from "lucide-react";
import { useAuthState } from "react-firebase-hooks/auth";
import { auth, db } from "../../../../../firebase/client";
import { doc, onSnapshot, Timestamp } from "firebase/firestore";
import {
  Card,
  CardBody,
  CardHeader,
  Input,
  Button,
  Chip,
  Divider,
} from "@heroui/react";
import { OfficerLeaderboardService } from "../services/officerLeaderboardService";
import type { LeaderboardSettings } from "../types/OfficerLeaderboardTypes";
import type { UserRole } from "../../../shared/types/firestore";

export default function LeaderboardSettings() {
  const [user] = useAuthState(auth);
  const [currentUserRole, setCurrentUserRole] = useState<UserRole | null>(null);
  const [settings, setSettings] = useState<LeaderboardSettings | null>(null);
  const [loading, setLoading] = useState(false); // Start false to show cached data immediately
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  useEffect(() => {
    if (!user) return;

    // Set up real-time listener for user role
    const unsubscribe = onSnapshot(
      doc(db, "users", user.uid),
      (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setCurrentUserRole(userData.role);
        }
      },
      (error) => {
        console.error("Error loading user role:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);

      if (
        !user ||
        (currentUserRole !== "Executive Officer" &&
          currentUserRole !== "Administrator")
      ) {
        setLoading(false);
        return;
      }

      try {
        const settingsData =
          await OfficerLeaderboardService.getLeaderboardSettings();

        if (!settingsData) {
          setError("Settings not found");
          setLoading(false);
          return;
        }

        setSettings(settingsData);

        // Convert to date string (YYYY-MM-DD) using consistent local time approach
        const date = settingsData.startDate?.toDate
          ? settingsData.startDate.toDate()
          : new Date(settingsData.startDate.toMillis());
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        setStartDate(`${year}-${month}-${day}`);
      } catch (error) {
        console.error("Error loading settings:", error);
        setError("Failed to load settings");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user, currentUserRole]);

  const handleSaveSettings = async () => {
    if (!user || !settings) return;

    if (!startDate) {
      setError("Please select a start date");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      // Parse date as local date (YYYY-MM-DD) to avoid timezone shifts
      const [year, month, day] = startDate.split('-').map(Number);
      const localDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      const startTimestamp = Timestamp.fromDate(localDate);

      await OfficerLeaderboardService.updateLeaderboardSettings(user.uid, {
        startDate: startTimestamp,
      });

      const updatedSettings =
        await OfficerLeaderboardService.getLeaderboardSettings();
      setSettings(updatedSettings);
      setSuccess("Settings updated successfully");

      setTimeout(() => setSuccess(""), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  // Don't render if not an executive
  if (
    !user ||
    (currentUserRole !== "Executive Officer" &&
      currentUserRole !== "Administrator")
  ) {
    return null;
  }

  if (loading) {
    return (
      <Card className="w-full">
        <CardBody className="p-6" role="status" aria-live="polite" aria-busy="true">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-full mb-4"></div>
            <div className="h-10 bg-gray-200 rounded w-32"></div>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader className="flex gap-3 items-center">
        <div className="flex-shrink-0">
          <Settings className="w-5 h-5 text-gray-600" />
        </div>
        <div className="flex flex-col">
          <h3 className="text-lg font-semibold">Leaderboard Settings</h3>
          <p className="text-sm text-gray-600">
            Configure officer leaderboard tracking parameters
          </p>
        </div>
      </CardHeader>

      <Divider />

      <CardBody className="space-y-4">
        {error && (
          <Chip
            color="danger"
            variant="flat"
            startContent={<AlertCircle className="w-4 h-4" />}
            className="w-full justify-start"
          >
            {error}
          </Chip>
        )}

        {success && (
          <Chip color="success" variant="flat" className="w-full justify-start">
            {success}
          </Chip>
        )}

        <div className="space-y-2">
          <label htmlFor="leaderboard-start-date" className="text-sm font-medium text-gray-700">
            Leaderboard Start Date
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Only event attendances after this date will count toward team
            points. Team size calculation only includes officers who joined on
            or before this date.
          </p>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            startContent={<Calendar className="w-4 h-4 text-gray-400" />}
            placeholder="Select start date"
            variant="bordered"
            className="w-full"
            aria-label="Leaderboard start date"
            id="leaderboard-start-date"
          />
        </div>

        {settings && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Current Settings
            </label>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-sm">
                <span className="font-medium">Start Date: </span>
                {(() => {
                  const date = settings.startDate?.toDate
                    ? settings.startDate.toDate()
                    : new Date(settings.startDate.toMillis());
                  const year = date.getFullYear();
                  const month = String(date.getMonth() + 1).padStart(2, '0');
                  const day = String(date.getDate()).padStart(2, '0');
                  return `${month}/${day}/${year}`;
                })()}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Last updated: {settings.lastUpdated?.toDate
                  ? settings.lastUpdated.toDate().toLocaleString()
                  : new Date(settings.lastUpdated.toMillis()).toLocaleString()}
              </div>
            </div>
          </div>
        )}

        <div className="pt-4">
          <Button
            color="primary"
            variant="solid"
            onPress={handleSaveSettings}
            isLoading={saving}
            aria-label={saving ? "Saving settings" : "Save settings"}
            aria-busy={saving}
            startContent={!saving && <Save className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
