import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { app, adminAuth } from "../../firebase/server";

const db = getFirestore(app);

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("User update request received");

    const requestBody = await request.json();
    const {
      userId,
      name,
      role,
      position,
      status,
      pid,
      memberId,
      major,
      graduationYear,
      team,
      points,
      adminUserId,
    } = requestBody;

    console.log("Request body:", {
      userId,
      name,
      role,
      position,
      team,
      adminUserId,
    });

    // Validate required parameters
    if (!userId || !adminUserId) {
      console.log("Missing required parameters");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Missing required parameters (userId, adminUserId)",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Verify admin user has permission to update users
    const adminUserRef = db.collection("users").doc(adminUserId);
    const adminUserDoc = await adminUserRef.get();

    if (!adminUserDoc.exists) {
      console.log("Admin user not found");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Admin user not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const adminUserData = adminUserDoc.data();
    const adminRole = adminUserData?.role;

    // Check if admin has permission to update users
    const allowedRoles = [
      "Administrator",
      "Executive Officer",
      "General Officer",
    ];
    if (!allowedRoles.includes(adminRole)) {
      console.log("Insufficient permissions");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Insufficient permissions to update users",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get the user to update
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      console.log("User not found");
      return new Response(
        JSON.stringify({
          success: false,
          message: "User not found",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get current user data for change tracking
    const currentUserData = userDoc.data();
    const changes: Array<{
      field: string;
      oldValue: string;
      newValue: string;
    }> = [];

    // Build update data
    const updateData: any = {
      lastUpdated: new Date(),
      lastUpdatedBy: adminUserId,
    };

    // Add fields if provided and track changes
    if (name !== undefined && name !== currentUserData?.name) {
      updateData.name = name;
      changes.push({
        field: "name",
        oldValue: currentUserData?.name || "",
        newValue: name,
      });
    }
    if (role !== undefined && role !== currentUserData?.role) {
      updateData.role = role;
      changes.push({
        field: "role",
        oldValue: currentUserData?.role || "",
        newValue: role,
      });
    }
    if (position !== undefined && position !== currentUserData?.position) {
      updateData.position = position || "";
      changes.push({
        field: "position",
        oldValue: currentUserData?.position || "",
        newValue: position || "",
      });
    }
    if (status !== undefined && status !== currentUserData?.status) {
      updateData.status = status;
      changes.push({
        field: "status",
        oldValue: currentUserData?.status || "",
        newValue: status,
      });
    }
    if (pid !== undefined && pid !== currentUserData?.pid) {
      updateData.pid = pid || "";
      changes.push({
        field: "pid",
        oldValue: currentUserData?.pid || "",
        newValue: pid || "",
      });
    }
    if (memberId !== undefined && memberId !== currentUserData?.memberId) {
      updateData.memberId = memberId || "";
      changes.push({
        field: "memberId",
        oldValue: currentUserData?.memberId || "",
        newValue: memberId || "",
      });
    }
    if (major !== undefined && major !== currentUserData?.major) {
      updateData.major = major || "";
      changes.push({
        field: "major",
        oldValue: currentUserData?.major || "",
        newValue: major || "",
      });
    }
    if (
      graduationYear !== undefined &&
      graduationYear !== currentUserData?.graduationYear
    ) {
      updateData.graduationYear = graduationYear || null;
      changes.push({
        field: "graduationYear",
        oldValue: currentUserData?.graduationYear?.toString() || "",
        newValue: graduationYear?.toString() || "",
      });
    }
    if (team !== undefined && team !== currentUserData?.team) {
      updateData.team = team || null;
      changes.push({
        field: "team",
        oldValue: currentUserData?.team || "",
        newValue: team || "",
      });
    }

    // Only administrators can modify points
    if (
      adminRole === "Administrator" &&
      points !== undefined &&
      points !== currentUserData?.points
    ) {
      updateData.points = points;
      changes.push({
        field: "points",
        oldValue: currentUserData?.points?.toString() || "0",
        newValue: points.toString(),
      });
    }

    console.log("Updating user with data:", updateData);

    // Update user document
    await userRef.update(updateData);

    // Update custom claims if role changed
    if (role !== undefined && role !== userDoc.data()?.role) {
      try {
        await adminAuth.setCustomUserClaims(userId, {
          role: role,
        });
        console.log(`✅ Updated custom claims for ${userId}: role=${role}`);
      } catch (claimsError) {
        console.error("Error updating custom claims:", claimsError);
        // Continue even if custom claims fail - Firestore role will still work
      }
    }

    // Send email notification if there were changes
    if (changes.length > 0) {
      try {
        // Determine if this is a role change specifically
        const roleChange = changes.find((c) => c.field === "role");

        if (roleChange) {
          // Send role change email
          await fetch(
            `${new URL(request.url).origin}/api/email/send-user-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "role_change",
                userId,
                oldRole: roleChange.oldValue,
                newRole: roleChange.newValue,
                changedByUserId: adminUserId,
              }),
              signal: AbortSignal.timeout(10000), // 10 second timeout
            },
          );
        } else {
          // Send general profile update email
          await fetch(
            `${new URL(request.url).origin}/api/email/send-user-notification`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                type: "profile_update",
                userId,
                changes,
                changedByUserId: adminUserId,
              }),
              signal: AbortSignal.timeout(10000), // 10 second timeout
            },
          );
        }
      } catch (emailError) {
        console.error(
          "Failed to send user update notification email:",
          emailError,
        );
        // Don't fail the update if email fails
      }
    }

    console.log(`✅ Successfully updated user ${userId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "User updated successfully",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in update-user:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: error instanceof Error ? error.message : "An error occurred",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
};
