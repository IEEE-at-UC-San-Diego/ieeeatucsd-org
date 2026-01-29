import type { APIRoute } from "astro";
import { Resend } from "resend";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { app, adminAuth } from "../../../firebase/server";
import {
  sendAcceptanceConfirmationEmail,
  sendDirectOnboardingEmail,
} from "../../../scripts/email/OnboardingEmailFunctions";

// Default onboarding template
const DEFAULT_ONBOARDING_TEMPLATE = `Hello {NAME}!

Congratulations on being elected as the new {POSITION} for IEEE at UC San Diego! There is a lot of information to get started but it is fairly quick and straightforward. Please read this email in its entirety. If you have any problems feel free to ask me or any of the other officers!

1. Contact Info

Our primary forms of communication are through Slack, Google Groups, Google Drive, and Google Sites. In order to be added to these lists, please input your contact information onto this document. Once you fill out your information on this document (https://docs.google.com/spreadsheets/d/1XTaiDNwJqFelR_w3v_vvptxxLQGcEfI0Fl3bf7cDGS8/edit?gid=0#gid=0), please respond to this email confirming that, as we need this information for some of the following tasks.

2. Join IEEE

Go to http://ieee.org/join and join IEEE as a student member. Be sure to list UC San Diego as your affiliated branch. The cost is $32 / year. IEEE is our parent organization and our constitution states that all officers must be members of IEEE.

3. Join the Dashboard and Slack

Your role should have been updated on our Dashboard to a general officer, if it hasn't please let me know as soon as possible. Once on the dashboard, please go into the tab labeled "Slack Access" and follow the instructions to gain access to your IEEE email for slack.

{LEADER_INFO}

You should definitely join channels such as "#-announcements", "#-executive", "#-events",  "#-internal", "#-projects", "#-pr", "#-outreach", and "#z_play" in order to establish your initial connection with the whole team. Please also put your position in your Slack Profile and add a picture!

4. Position Email

After you're on Slack, we will provide you access with your Positions email that provides access to all documents and files we will be using within the organization throughout the year.

5. Read Slack and your email frequently. Good communication is key. Please try to be responsive.

Once you join these groups, you will receive information on weekly meetings with your subgroups (Internal, Events, Project) for the rest of the quarter as well as further onboarding information for your position.

Once again, congratulations on this position and we're all so excited to have you on our board! We'll be here to support you in every step of the way so feel free to ask any questions and get as much clarification as you need.`;

export const POST: APIRoute = async ({ request }) => {
  try {
    const { inviteId, action } = await request.json();

    if (!inviteId || !action) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: inviteId, action" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (action !== "accept" && action !== "decline") {
      return new Response(
        JSON.stringify({
          error: "Invalid action. Must be 'accept' or 'decline'",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const db = getFirestore(app);
    const inviteRef = db.collection("officerInvitations").doc(inviteId);
    const inviteDoc = await inviteRef.get();

    if (!inviteDoc.exists) {
      return new Response(JSON.stringify({ error: "Invitation not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const invitation = inviteDoc.data();

    // Check if invitation is still pending
    if (invitation?.status !== "pending") {
      return new Response(
        JSON.stringify({
          error: `This invitation has already been ${invitation?.status}`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    // Check if invitation has expired
    const expiresAt = invitation.expiresAt.toDate();
    if (new Date() > expiresAt) {
      await inviteRef.update({
        status: "expired",
      });
      return new Response(
        JSON.stringify({ error: "This invitation has expired" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (action === "decline") {
      // Update invitation status to declined
      await inviteRef.update({
        status: "declined",
        declinedAt: Timestamp.now(),
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: "Invitation declined",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Handle acceptance
    await inviteRef.update({
      status: "accepted",
      acceptedAt: Timestamp.now(),
    });

    console.log(
      `Processing acceptance for ${invitation.email} as ${invitation.role}`,
    );

    // Step 1: Find or create Firebase Auth user and grant role
    let userUid: string | null = null;
    let roleGranted = false;
    let userCreatedOrUpdated = false;

    try {
      // Try to find user by email
      let userRecord;
      try {
        userRecord = await adminAuth.getUserByEmail(invitation.email);
        userUid = userRecord.uid;
        console.log(`Found existing Firebase Auth user: ${userUid}`);
      } catch (error: any) {
        if (error.code === "auth/user-not-found") {
          console.log(
            `User ${invitation.email} not found in Firebase Auth. They will need to sign in first.`,
          );
          // User doesn't exist yet - they'll need to sign in first
          // We'll create the Firestore document anyway so it's ready when they sign in
          userUid = null;
        } else {
          throw error;
        }
      }

      // Step 2: Set custom claims if user exists in Firebase Auth
      if (userUid) {
        try {
          await adminAuth.setCustomUserClaims(userUid, {
            role: invitation.role,
          });
          roleGranted = true;
          console.log(
            `✅ Set custom claims for ${invitation.email}: role=${invitation.role}`,
          );
        } catch (claimsError) {
          console.error("Error setting custom claims:", claimsError);
          // Continue even if custom claims fail - Firestore role will still work
        }
      }

      // Step 3: Create or update user document in Firestore
      const usersRef = db.collection("users");

      if (userUid) {
        // User exists in Auth - update or create their Firestore document
        const userDocRef = usersRef.doc(userUid);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
          // Update existing user document
          await userDocRef.update({
            role: invitation.role,
            position: invitation.position,
            team: invitation.team || null,
            status: "active",
            invitedBy: invitation.invitedBy,
            inviteAccepted: Timestamp.now(),
            lastUpdated: Timestamp.now(),
            lastUpdatedBy: invitation.invitedBy,
          });
          console.log(
            `✅ Updated Firestore user document for ${invitation.email}`,
          );
        } else {
          // Create new user document
          await userDocRef.set({
            email: invitation.email,
            emailVisibility: true,
            verified: true,
            name: invitation.name,
            role: invitation.role,
            position: invitation.position,
            team: invitation.team || null,
            status: "active",
            joinDate: Timestamp.now(),
            invitedBy: invitation.invitedBy,
            inviteAccepted: Timestamp.now(),
            lastUpdated: Timestamp.now(),
            lastUpdatedBy: invitation.invitedBy,
            notificationPreferences: {},
            displayPreferences: {},
            accessibilitySettings: {},
            signedUp: false,
            requestedEmail: false,
            eventsAttended: 0,
            points: 0,
          });
          console.log(
            `✅ Created Firestore user document for ${invitation.email}`,
          );
        }
        userCreatedOrUpdated = true;
      } else {
        // User doesn't exist in Auth yet - create a placeholder document by email
        // This will be merged when they sign in via set-session.ts
        const querySnapshot = await usersRef
          .where("email", "==", invitation.email)
          .limit(1)
          .get();

        if (!querySnapshot.empty) {
          // Update existing document found by email
          const userDocRef = querySnapshot.docs[0].ref;
          await userDocRef.update({
            role: invitation.role,
            position: invitation.position,
            status: "active",
            invitedBy: invitation.invitedBy,
            inviteAccepted: Timestamp.now(),
            lastUpdated: Timestamp.now(),
            lastUpdatedBy: invitation.invitedBy,
          });
          console.log(
            `✅ Updated existing Firestore document for ${invitation.email} (user not in Auth yet)`,
          );
          userCreatedOrUpdated = true;
        } else {
          console.log(
            `⚠️  User ${invitation.email} not in Firebase Auth yet. Role will be granted when they sign in.`,
          );
          // Don't create a document without a UID - it will be created in set-session.ts
        }
      }
    } catch (authError) {
      console.error("Error granting role:", authError);
      // Continue with the rest of the process even if role granting fails
    }

    // Initialize Resend
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    const fromEmail =
      import.meta.env.FROM_EMAIL || "IEEE UCSD <noreply@ieeeatucsd.org>";
    const replyToEmail = import.meta.env.REPLY_TO_EMAIL || "ieee@ucsd.edu";

    // Send acceptance confirmation
    await sendAcceptanceConfirmationEmail(resend, fromEmail, replyToEmail, {
      name: invitation.name,
      email: invitation.email,
      position: invitation.position,
      role: invitation.role,
    });

    // Fetch Google Sheets URL from organization settings
    let googleSheetsUrl = "";
    try {
      const settingsDoc = await db
        .collection("organizationSettings")
        .doc("onboarding")
        .get();
      if (settingsDoc.exists) {
        const settingsData = settingsDoc.data();
        googleSheetsUrl = settingsData?.googleSheetsContactListUrl || "";
      }
    } catch (error) {
      console.error("Error fetching organization settings:", error);
    }

    // Replace Google Sheets URL in email template
    let processedEmailTemplate = DEFAULT_ONBOARDING_TEMPLATE;
    if (googleSheetsUrl) {
      // Replace the hardcoded URL with the configured one
      processedEmailTemplate = DEFAULT_ONBOARDING_TEMPLATE.replace(
        /https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+[^\s)"]*/g,
        googleSheetsUrl,
      );
    }

    // Send onboarding email
    const onboardingSuccess = await sendDirectOnboardingEmail(
      resend,
      fromEmail,
      replyToEmail,
      {
        name: invitation.name,
        email: invitation.email,
        role: invitation.role,
        position: invitation.position,
        emailTemplate: processedEmailTemplate,
      },
    );

    // Determine Google Group
    let googleGroup = null;
    if (
      invitation.role === "Executive Officer" ||
      invitation.role === "Administrator"
    ) {
      googleGroup = "executive-officers@ieeeatucsd.org";
    } else if (invitation.role === "General Officer") {
      googleGroup = "general-officers@ieeeatucsd.org";
    } else if (invitation.role === "Past Officer") {
      googleGroup = "past-officers@ieeeatucsd.org";
    }

    // Add to Google Group
    let googleGroupSuccess = false;
    if (googleGroup) {
      try {
        const googleResponse = await fetch(
          `${new URL(request.url).origin}/api/google-groups/add-member`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: invitation.email,
              googleGroup,
              role: invitation.role,
            }),
          },
        );

        const googleResult = await googleResponse.json();
        googleGroupSuccess = googleResult.success;
      } catch (error) {
        console.error("Error adding to Google Group:", error);
      }
    }

    // Update invitation with onboarding status
    await inviteRef.update({
      onboardingEmailSent: onboardingSuccess,
      googleGroupAssigned: googleGroupSuccess,
      googleGroup: googleGroup || null,
      permissionsGranted: true,
      roleGranted: roleGranted,
      roleGrantedAt: roleGranted ? Timestamp.now() : null,
      userCreatedOrUpdated: userCreatedOrUpdated,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Invitation accepted! Welcome to the team!",
        onboardingEmailSent: onboardingSuccess,
        googleGroupAssigned: googleGroupSuccess,
        roleGranted: roleGranted,
        userCreatedOrUpdated: userCreatedOrUpdated,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in accept-invitation API:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
