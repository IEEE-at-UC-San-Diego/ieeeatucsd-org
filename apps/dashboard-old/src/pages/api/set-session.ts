import type { APIRoute } from "astro";
import { adminAuth } from "../../firebase/server";
import { isProduction } from "../../env";
import { getFirestore } from "firebase-admin/firestore";
import { app } from "../../firebase/server";

export const db = getFirestore(app);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const { idToken, inviteId, signInMethod } = await request.json();

    if (!idToken) {
      return new Response(JSON.stringify({ error: "No ID token provided" }), {
        status: 400,
      });
    }

    // Verify the ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Check for sponsor domain auto-assignment
    let sponsorDomainData = null;
    if (decoded.email) {
      try {
        const emailDomain = "@" + decoded.email.split("@")[1];
        const sponsorDomainsRef = db.collection("sponsorDomains");
        const domainQuery = await sponsorDomainsRef
          .where("domain", "==", emailDomain.toLowerCase())
          .limit(1)
          .get();

        if (!domainQuery.empty) {
          sponsorDomainData = domainQuery.docs[0].data();
          console.log("Sponsor domain match found:", {
            domain: emailDomain,
            organization: sponsorDomainData?.organizationName,
            tier: sponsorDomainData?.sponsorTier,
          });
        }
      } catch (error) {
        console.error("Error checking sponsor domains:", error);
        // Continue with normal flow if sponsor domain check fails
      }
    }

    // Process invite if provided
    let inviteData = null;
    if (inviteId) {
      try {
        console.log("Processing invite:", inviteId);
        const inviteRef = db.doc(`invites/${inviteId}`);
        const inviteSnap = await inviteRef.get();

        if (inviteSnap.exists) {
          inviteData = inviteSnap.data();
          console.log("Invite found:", {
            email: inviteData?.email,
            role: inviteData?.role,
          });

          // Verify the invite is for this user's email
          if (
            inviteData?.email === decoded.email &&
            inviteData?.status === "pending"
          ) {
            // Mark invite as accepted
            await inviteRef.update({
              status: "accepted",
              acceptedAt: new Date(),
              acceptedBy: decoded.uid,
            });
            console.log("Invite accepted successfully");
          } else {
            console.warn("Invite validation failed:", {
              inviteEmail: inviteData?.email,
              userEmail: decoded.email,
              inviteStatus: inviteData?.status,
            });
            inviteData = null; // Reset if validation fails
          }
        } else {
          console.warn("Invite not found:", inviteId);
        }
      } catch (error) {
        console.error("Error processing invite:", error);
        inviteData = null;
      }
    }

    // Check for accepted officer invitations (if user accepted before signing in)
    let acceptedInvitation = null;
    try {
      const acceptedInvitesSnapshot = await db
        .collection("officerInvitations")
        .where("email", "==", decoded.email)
        .where("status", "==", "accepted")
        .limit(1)
        .get();

      if (!acceptedInvitesSnapshot.empty) {
        acceptedInvitation = acceptedInvitesSnapshot.docs[0].data();
        console.log(
          `Found accepted officer invitation for ${decoded.email}: ${acceptedInvitation.role}`,
        );
      }
    } catch (error) {
      console.error("Error checking for accepted invitations:", error);
    }

    // Create or ensure user document
    const userRef = db.doc(`users/${decoded.uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      // Determine role: sponsor domain takes precedence, then accepted invitation, then invite
      let userRole = "Member";
      let userPosition = undefined;
      let sponsorTier = undefined;
      let sponsorOrganization = undefined;
      let autoAssignedSponsor = false;

      if (sponsorDomainData) {
        // Auto-assign as sponsor based on domain
        userRole = "Sponsor";
        sponsorTier = sponsorDomainData.sponsorTier;
        sponsorOrganization = sponsorDomainData.organizationName;
        autoAssignedSponsor = true;
        console.log("Auto-assigning user as sponsor:", {
          tier: sponsorTier,
          organization: sponsorOrganization,
        });
      } else if (acceptedInvitation?.role) {
        // Use role from accepted officer invitation
        userRole = acceptedInvitation.role;
        userPosition = acceptedInvitation.position;
        console.log("Using role from accepted invitation:", {
          role: userRole,
          position: userPosition,
        });
      } else if (inviteData?.role) {
        // Use role from invite
        userRole = inviteData.role;
        userPosition = inviteData.position;
      }

      const userData = {
        email: decoded.email || "",
        emailVisibility: true,
        verified: decoded.email_verified || false,
        name: decoded.name || "",
        ...(decoded.preferred_username && {
          username: decoded.preferred_username,
        }),
        ...(decoded.picture && { avatar: decoded.picture }),
        lastLogin: new Date(),
        joinDate: new Date(), // Set join date when user first signs up
        notificationPreferences: {},
        displayPreferences: {},
        accessibilitySettings: {},
        signedUp: false,
        requestedEmail: false,
        role: userRole,
        ...(userPosition && { position: userPosition }),
        ...(sponsorTier && { sponsorTier }),
        ...(sponsorOrganization && { sponsorOrganization }),
        ...(autoAssignedSponsor && { autoAssignedSponsor }),
        ...(inviteData && { invitedBy: inviteData.createdBy || "system" }),
        ...(inviteData && { inviteAccepted: new Date() }),
        status: "active",
        eventsAttended: 0,
        points: 0,
        signInMethod: signInMethod || "email", // Record the sign-in method
      };
      console.log("Creating user with data:", {
        role: userData.role,
        position: userData.position,
        sponsorTier: userData.sponsorTier,
        sponsorOrganization: userData.sponsorOrganization,
      });
      await userRef.set(userData);

      // Set custom claims for the user's role
      if (userRole && userRole !== "Member") {
        try {
          await adminAuth.setCustomUserClaims(decoded.uid, {
            role: userRole,
          });
          console.log(`✅ Set custom claims for new user: role=${userRole}`);
        } catch (claimsError) {
          console.error(
            "Error setting custom claims for new user:",
            claimsError,
          );
        }
      }
    } else {
      // Update existing user's last login and sign-in method
      const updateData: any = {
        lastLogin: new Date(),
        ...(signInMethod && { signInMethod }),
      };

      // Check if existing user should be upgraded to sponsor based on domain
      const existingUserData = userSnap.data();
      if (
        sponsorDomainData &&
        existingUserData?.role !== "Sponsor" &&
        existingUserData?.role !== "Administrator"
      ) {
        // Auto-upgrade existing user to sponsor
        updateData.role = "Sponsor";
        updateData.sponsorTier = sponsorDomainData.sponsorTier;
        updateData.sponsorOrganization = sponsorDomainData.organizationName;
        updateData.autoAssignedSponsor = true;
        console.log("Auto-upgrading existing user to sponsor:", {
          tier: sponsorDomainData.sponsorTier,
          organization: sponsorDomainData.organizationName,
        });
      }

      // Check if existing user has an accepted officer invitation
      if (
        acceptedInvitation &&
        existingUserData?.role !== "Administrator" &&
        existingUserData?.role !== acceptedInvitation.role
      ) {
        // Upgrade user to officer role from accepted invitation
        updateData.role = acceptedInvitation.role;
        updateData.position = acceptedInvitation.position;
        updateData.invitedBy = acceptedInvitation.invitedBy;
        updateData.inviteAccepted = new Date();
        console.log("Upgrading existing user from accepted invitation:", {
          role: acceptedInvitation.role,
          position: acceptedInvitation.position,
        });

        // Set custom claims for the new role
        try {
          await adminAuth.setCustomUserClaims(decoded.uid, {
            role: acceptedInvitation.role,
          });
          console.log(
            `✅ Set custom claims for existing user: role=${acceptedInvitation.role}`,
          );
        } catch (claimsError) {
          console.error(
            "Error setting custom claims for existing user:",
            claimsError,
          );
        }
      }

      await userRef.update(updateData);
    }

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, {
      expiresIn,
    });

    // Set cookie
    cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: isProduction,
      maxAge: expiresIn / 1000,
      path: "/",
    });

    // Officers and sponsors should go to overview, others to get-started if not signed up
    const userData = userSnap.exists ? userSnap.data() : null;
    const isOfficer =
      userData?.role &&
      [
        "General Officer",
        "Executive Officer",
        "Member at Large",
        "Past Officer",
      ].includes(userData.role);
    const isSponsor = userData?.role === "Sponsor";
    const target =
      userData?.signedUp || isOfficer || isSponsor
        ? "/overview"
        : "/get-started";
    return redirect(target);
  } catch (error) {
    console.error("Error creating session cookie:", error);
    return new Response(JSON.stringify({ error: "Authentication failed" }), {
      status: 401,
    });
  }
};
