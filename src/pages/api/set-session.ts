import type { APIRoute } from 'astro';
import { adminAuth } from '../../firebase/server';
import { isProduction } from '../../env';
import { getFirestore } from 'firebase-admin/firestore';
import { app } from '../../firebase/server';

export const db = getFirestore(app);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const { idToken, inviteId, signInMethod } = await request.json();

    if (!idToken) {
      return new Response(JSON.stringify({ error: 'No ID token provided' }), { status: 400 });
    }

    // Verify the ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

    // Process invite if provided
    let inviteData = null;
    if (inviteId) {
      try {
        console.log('Processing invite:', inviteId);
        const inviteRef = db.doc(`invites/${inviteId}`);
        const inviteSnap = await inviteRef.get();
        
        if (inviteSnap.exists) {
          inviteData = inviteSnap.data();
          console.log('Invite found:', { email: inviteData?.email, role: inviteData?.role });
          
          // Verify the invite is for this user's email
          if (inviteData?.email === decoded.email && inviteData?.status === 'pending') {
            // Mark invite as accepted
            await inviteRef.update({
              status: 'accepted',
              acceptedAt: new Date(),
              acceptedBy: decoded.uid
            });
            console.log('Invite accepted successfully');
          } else {
            console.warn('Invite validation failed:', {
              inviteEmail: inviteData?.email,
              userEmail: decoded.email,
              inviteStatus: inviteData?.status
            });
            inviteData = null; // Reset if validation fails
          }
        } else {
          console.warn('Invite not found:', inviteId);
        }
      } catch (error) {
        console.error('Error processing invite:', error);
        inviteData = null;
      }
    }

    // Create or ensure user document
    const userRef = db.doc(`users/${decoded.uid}`);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      const userData = {
        email: decoded.email || '',
        emailVisibility: true,
        verified: decoded.email_verified || false,
        name: decoded.name || '',
        ...(decoded.preferred_username && { username: decoded.preferred_username }),
        ...(decoded.picture && { avatar: decoded.picture }),
        lastLogin: new Date(),
        notificationPreferences: {},
        displayPreferences: {},
        accessibilitySettings: {},
        signedUp: false,
        requestedEmail: false,
        role: inviteData?.role || 'Member', // Use role from invite or default to Member
        ...(inviteData?.position && { position: inviteData.position }),
        ...(inviteData && { invitedBy: inviteData.createdBy || 'system' }),
        ...(inviteData && { inviteAccepted: new Date() }),
        status: 'active',
        eventsAttended: 0,
        points: 0,
        signInMethod: signInMethod || 'email', // Record the sign-in method
      };
      console.log('Creating user with data:', { role: userData.role, position: userData.position });
      await userRef.set(userData);
    } else {
      // Update existing user's last login and sign-in method
      await userRef.update({
        lastLogin: new Date(),
        ...(signInMethod && { signInMethod })
      });
    }

    // Create session cookie
    const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });

    // Set cookie
    cookies.set('session', sessionCookie, {
      httpOnly: true,
      secure: isProduction,
      maxAge: expiresIn / 1000,
      path: '/',
    });

    // Officers with roles should go to overview, others to get-started if not signed up
    const userData = userSnap.exists ? userSnap.data() : null;
    const isOfficer = userData?.role && ['General Officer', 'Executive Officer', 'Member at Large', 'Past Officer'].includes(userData.role);
    const target = (userData?.signedUp || isOfficer) ? '/dashboard/overview' : '/dashboard/get-started';
    return redirect(target);
  } catch (error) {
    console.error('Error creating session cookie:', error);
    return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401 });
  }
}; 