import type { APIRoute } from "astro";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";

const db = getFirestore(app);

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log("Email update request received");

    const requestBody = await request.json();
    console.log(
      "Request body:",
      JSON.stringify({
        userId: requestBody.userId,
        newAlias: requestBody.newAlias,
        adminUserId: requestBody.adminUserId,
      }),
    );

    const { userId, newAlias, adminUserId, confirmed } = requestBody;

    if (!userId || !newAlias || !adminUserId) {
      console.log("Missing required parameters");
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Missing required parameters (userId, newAlias, adminUserId)",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Verify admin permissions
    const adminRef = db.collection("users").doc(adminUserId);
    const adminDoc = await adminRef.get();

    if (!adminDoc.exists) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Admin user not found",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const adminRole = adminDoc.data()?.role;
    if (adminRole !== "Executive Officer" && adminRole !== "Administrator") {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Unauthorized. Only Executive Officers and Administrators can manage IEEE emails.",
        }),
        {
          status: 403,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Validate the new alias format
    const aliasRegex = /^[a-zA-Z0-9._-]+$/;
    if (!aliasRegex.test(newAlias)) {
      return new Response(
        JSON.stringify({
          success: false,
          message:
            "Invalid alias format. Only letters, numbers, dots, hyphens, and underscores are allowed.",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Get user document from Firestore to check if they have an existing email
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
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

    const userData = userDoc.data();
    const hasExistingIEEEEmail = userData?.hasIEEEEmail && userData?.ieeeEmail;
    const existingEmail = userData?.ieeeEmail;
    const existingEmailCreatedAt = userData?.ieeeEmailCreatedAt;

    // MXRoute DirectAdmin API credentials from environment variables
    const loginKey = import.meta.env.MXROUTE_LOGIN_KEY;
    const serverLogin = import.meta.env.MXROUTE_SERVER_LOGIN;
    const serverUrl = import.meta.env.MXROUTE_SERVER_URL;
    const emailQuota = import.meta.env.MXROUTE_EMAIL_QUOTA;
    const emailOutboundLimit = import.meta.env.MXROUTE_EMAIL_OUTBOUND_LIMIT;
    const emailDomain = import.meta.env.MXROUTE_EMAIL_DOMAIN;

    console.log(`Environment variables:
      loginKey: ${loginKey ? "Set" : "Not set"}
      serverLogin: ${serverLogin ? "Set" : "Not set"}
      serverUrl: ${serverUrl ? "Set" : "Not set"}
      emailDomain: ${emailDomain ? "Set" : "Not set"}
    `);

    if (!loginKey || !serverLogin || !serverUrl || !emailDomain) {
      throw new Error("Missing MXRoute configuration");
    }

    // Determine the domain and construct the new email
    const domain = emailDomain;
    const newEmail = `${newAlias}@${domain}`;

    console.log(
      `Processing email ${hasExistingIEEEEmail ? "update" : "creation"} for user ${userId}`,
    );
    console.log(`New email will be: ${newEmail}`);

    // DirectAdmin API endpoint for managing email accounts
    let baseUrl = serverUrl;

    // If the URL contains a specific command, extract just the base URL
    if (baseUrl.includes("/CMD_")) {
      baseUrl = baseUrl.split("/CMD_")[0];
    }

    // Make sure there's no trailing slash
    baseUrl = baseUrl.replace(/\/$/, "");

    // DirectAdmin API endpoint for managing email accounts
    const emailApiUrl = `${baseUrl}/CMD_API_EMAIL_POP`;

    // First, check if the new email already exists
    const checkFormData = new URLSearchParams();
    checkFormData.append("action", "list");
    checkFormData.append("domain", domain);

    console.log(`Checking if new email exists: ${newEmail}`);
    const checkResponse = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${serverLogin}:${loginKey}`).toString("base64")}`,
      },
      body: checkFormData,
    });

    const checkResponseText = await checkResponse.text();
    console.log(`Check response: ${checkResponseText}`);

    // Check if the new alias already exists
    const emailExists =
      checkResponseText.includes(`${newAlias}=`) ||
      checkResponseText.includes(`user=${newAlias}`);

    if (emailExists) {
      // If email exists but not confirmed, ask for confirmation
      if (!confirmed) {
        console.log(
          `Email ${newEmail} already exists. Requesting confirmation.`,
        );

        // Check if this email is currently assigned to other users in Firebase
        const usersSnapshot = await db
          .collection("users")
          .where("ieeeEmail", "==", newEmail)
          .get();

        const otherUsers = usersSnapshot.docs
          .filter((doc) => doc.id !== userId)
          .map((doc) => ({
            id: doc.id,
            name: doc.data()?.name || "Unknown User",
            email: doc.data()?.email || "Unknown Email",
          }));

        let currentOwner = otherUsers.length > 0 ? otherUsers[0] : null;

        return new Response(
          JSON.stringify({
            success: false,
            requiresConfirmation: true,
            message: currentOwner
              ? `Email address ${newEmail} already exists and is currently assigned to ${currentOwner.name} (${currentOwner.email})${otherUsers.length > 1 ? ` and ${otherUsers.length - 1} other user(s)` : ""}. Do you want to share this email with this user? (The email will not be removed from other users)`
              : `Email address ${newEmail} already exists in the system. Do you want to assign this email to this user?`,
            data: {
              existingEmail: newEmail,
              currentOwner: currentOwner,
              sharedWithCount: otherUsers.length,
            },
          }),
          {
            status: 409,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      // If confirmed, proceed with claiming/reassigning the email
      // For shared/existing emails, we do NOT modify the MXRoute account
      // We only update Firebase to point to this existing email
      // Multiple users can share the same email (e.g., role-based emails like president@ieeeucsd.org)
      console.log(
        `Admin confirmed. Assigning existing email ${newEmail} to user ${userId} (Firebase only, no MXRoute changes)`,
      );

      // Check if email is currently assigned to other users (for logging purposes only)
      const usersSnapshot = await db
        .collection("users")
        .where("ieeeEmail", "==", newEmail)
        .get();

      const otherUsersWithEmail = usersSnapshot.docs
        .filter((doc) => doc.id !== userId)
        .map((doc) => ({
          id: doc.id,
          name: doc.data()?.name || "Unknown User",
        }));

      if (otherUsersWithEmail.length > 0) {
        console.log(
          `AUDIT: Email ${newEmail} is being shared. Currently assigned to ${otherUsersWithEmail.length} other user(s): ${otherUsersWithEmail.map((u) => u.name).join(", ")}. Adding to user ${userId} by admin ${adminUserId} (${adminDoc.data()?.name})`,
        );
      } else {
        console.log(
          `AUDIT: Email ${newEmail} assigned to user ${userId} by admin ${adminUserId} (${adminDoc.data()?.name})`,
        );
      }

      // Update Firebase with the claimed email (do NOT remove from other users)
      const updateData: any = {
        hasIEEEEmail: true,
        ieeeEmail: newEmail,
        ieeeEmailStatus: "active",
        updatedAt: new Date(),
      };

      // Set creation timestamp if user didn't have an email before
      if (!hasExistingIEEEEmail) {
        updateData.ieeeEmailCreatedAt = new Date();
      } else if (existingEmailCreatedAt) {
        updateData.ieeeEmailCreatedAt = existingEmailCreatedAt;
      }

      await userRef.update(updateData);
      console.log("Firebase user document updated with claimed email");

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            ieeeEmail: newEmail,
            message: `Email ${newEmail} has been successfully assigned to this user. This is a shared email account - no password was generated.`,
            isUpdate: hasExistingIEEEEmail,
            wasClaimed: true,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Create the new email account with DirectAdmin API
    // Generate a secure random password that meets DirectAdmin requirements:
    // - At least one number
    // - At least one uppercase letter
    // - At least one lowercase letter
    const generatePassword = async () => {
      const crypto = await import("crypto");

      const lowercase = "abcdefghijklmnopqrstuvwxyz";
      const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
      const numbers = "0123456789";
      const special = "!@#$%^&*";
      const allChars = lowercase + uppercase + numbers + special;

      // Ensure at least one character from each required category
      let password = "";

      // Add one random lowercase
      password += lowercase[crypto.randomBytes(1)[0] % lowercase.length];

      // Add one random uppercase
      password += uppercase[crypto.randomBytes(1)[0] % uppercase.length];

      // Add one random number
      password += numbers[crypto.randomBytes(1)[0] % numbers.length];

      // Fill the rest with random characters (total length 16)
      const remainingLength = 13;
      const randomBytes = crypto.randomBytes(remainingLength);
      for (let i = 0; i < remainingLength; i++) {
        password += allChars[randomBytes[i] % allChars.length];
      }

      // Shuffle the password to avoid predictable patterns
      const passwordArray = password.split("");
      for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = crypto.randomBytes(1)[0] % (i + 1);
        [passwordArray[i], passwordArray[j]] = [
          passwordArray[j],
          passwordArray[i],
        ];
      }

      return passwordArray.join("");
    };

    const newPassword = await generatePassword();

    console.log(`Creating new email account: ${newEmail}`);

    // Create the new email account
    const createFormData = new URLSearchParams();
    createFormData.append("action", "create");
    createFormData.append("domain", domain);
    createFormData.append("user", newAlias);
    createFormData.append("passwd", newPassword);
    createFormData.append("passwd2", newPassword);
    createFormData.append("quota", emailQuota || "200");
    createFormData.append("limit", emailOutboundLimit || "9600");

    const createResponse = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${serverLogin}:${loginKey}`).toString("base64")}`,
      },
      body: createFormData,
    });

    const createResponseText = await createResponse.text();
    console.log(`DirectAdmin create response status: ${createResponse.status}`);
    console.log(`DirectAdmin create response: ${createResponseText}`);

    // Check for errors in the create response
    if (createResponseText.includes("error=1") || !createResponse.ok) {
      let errorMessage = "Failed to create email account";
      try {
        const errorParams = new URLSearchParams(createResponseText);
        if (errorParams.has("text")) {
          errorMessage = decodeURIComponent(errorParams.get("text") || "");
        }
        if (errorParams.has("details")) {
          const details = decodeURIComponent(errorParams.get("details") || "");
          errorMessage += `: ${details.replace(/<br>/g, " ")}`;
        }
      } catch (e) {
        // Error parsing DirectAdmin error response
      }

      // If the error is because the email already exists
      if (
        errorMessage.toLowerCase().includes("already exists") ||
        errorMessage.toLowerCase().includes("user already exists")
      ) {
        // If not confirmed yet, return a confirmation request
        if (!confirmed) {
          console.log(
            `Email ${newEmail} already exists (detected from create error). Requesting confirmation.`,
          );

          // Check if this email is currently assigned to other users in Firebase
          const usersSnapshot = await db
            .collection("users")
            .where("ieeeEmail", "==", newEmail)
            .get();

          const otherUsers = usersSnapshot.docs
            .filter((doc) => doc.id !== userId)
            .map((doc) => ({
              id: doc.id,
              name: doc.data()?.name || "Unknown User",
              email: doc.data()?.email || "Unknown Email",
            }));

          let currentOwner = otherUsers.length > 0 ? otherUsers[0] : null;

          return new Response(
            JSON.stringify({
              success: false,
              requiresConfirmation: true,
              message: currentOwner
                ? `Email address ${newEmail} already exists and is currently assigned to ${currentOwner.name} (${currentOwner.email})${otherUsers.length > 1 ? ` and ${otherUsers.length - 1} other user(s)` : ""}. Do you want to share this email with this user? (The email will not be removed from other users)`
                : `Email address ${newEmail} already exists in the system. Do you want to assign this email to this user?`,
              data: {
                existingEmail: newEmail,
                currentOwner: currentOwner,
                sharedWithCount: otherUsers.length,
              },
            }),
            {
              status: 409,
              headers: {
                "Content-Type": "application/json",
              },
            },
          );
        }

        // If confirmed, assign the existing email (Firebase only, no MXRoute changes)
        console.log(
          `Email ${newEmail} already exists and admin confirmed. Assigning to user ${userId} (Firebase only).`,
        );

        // Check if email is currently assigned to other users (for logging purposes only)
        const usersSnapshot = await db
          .collection("users")
          .where("ieeeEmail", "==", newEmail)
          .get();

        const otherUsersWithEmail = usersSnapshot.docs
          .filter((doc) => doc.id !== userId)
          .map((doc) => ({
            id: doc.id,
            name: doc.data()?.name || "Unknown User",
          }));

        if (otherUsersWithEmail.length > 0) {
          console.log(
            `AUDIT: Email ${newEmail} is being shared. Currently assigned to ${otherUsersWithEmail.length} other user(s): ${otherUsersWithEmail.map((u) => u.name).join(", ")}. Adding to user ${userId} by admin ${adminUserId} (${adminDoc.data()?.name})`,
          );
        } else {
          console.log(
            `AUDIT: Email ${newEmail} assigned to user ${userId} by admin ${adminUserId} (${adminDoc.data()?.name})`,
          );
        }

        // Update Firebase with the claimed email (do NOT remove from other users)
        const updateData: any = {
          hasIEEEEmail: true,
          ieeeEmail: newEmail,
          ieeeEmailStatus: "active",
          updatedAt: new Date(),
        };

        // Set creation timestamp if user didn't have an email before
        if (!hasExistingIEEEEmail) {
          updateData.ieeeEmailCreatedAt = new Date();
        } else if (existingEmailCreatedAt) {
          updateData.ieeeEmailCreatedAt = existingEmailCreatedAt;
        }

        await userRef.update(updateData);
        console.log("Firebase user document updated with claimed email");

        return new Response(
          JSON.stringify({
            success: true,
            data: {
              ieeeEmail: newEmail,
              message: `Email ${newEmail} has been successfully assigned to this user. This is a shared email account - no password was generated.`,
              isUpdate: hasExistingIEEEEmail,
              wasClaimed: true,
            },
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
            },
          },
        );
      }

      throw new Error(errorMessage);
    }

    console.log("Email account created successfully in MXRoute");

    // Update Firebase with the new email information
    const updateData: any = {
      ieeeEmail: newEmail,
      ieeeEmailStatus: "active",
      updatedAt: new Date(),
    };

    // If this is a new email (not an update), set hasIEEEEmail and ieeeEmailCreatedAt
    if (!hasExistingIEEEEmail) {
      updateData.hasIEEEEmail = true;
      updateData.ieeeEmailCreatedAt = new Date();
    } else {
      // Keep the original creation timestamp for updates
      if (existingEmailCreatedAt) {
        updateData.ieeeEmailCreatedAt = existingEmailCreatedAt;
      }
    }

    await userRef.update(updateData);
    console.log("Firebase user document updated successfully");

    // Return success response
    const responseMessage = hasExistingIEEEEmail
      ? `Email alias updated successfully from ${existingEmail} to ${newEmail}. The old email account has been preserved in the system.`
      : `IEEE email account created successfully: ${newEmail}`;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ieeeEmail: newEmail,
          password: newPassword,
          message: responseMessage,
          isUpdate: hasExistingIEEEEmail,
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in update-ieee-email:", error);
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
