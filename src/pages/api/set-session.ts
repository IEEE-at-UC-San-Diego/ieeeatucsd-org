import type { APIRoute } from 'astro';
import { adminAuth } from '../../firebase/server';
import { isProduction } from '../../env';
import { getFirestore } from 'firebase-admin/firestore';
import { app } from '../../firebase/server';

export const db = getFirestore(app);

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  try {
    const { idToken } = await request.json();

    if (!idToken) {
      return new Response(JSON.stringify({ error: 'No ID token provided' }), { status: 400 });
    }

    // Verify the ID token
    const decoded = await adminAuth.verifyIdToken(idToken);

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
        role: 'Member', // Default role for new users
        status: 'active',
        joinDate: new Date(),
        eventsAttended: 0,
        points: 0,
      };
      await userRef.set(userData);
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