import type { APIContext } from 'astro';
import { adminAuth } from '../firebase/server';
import { db } from '../pages/api/set-session';

export async function onRequest(context: APIContext, next: () => Promise<Response>) {
  const { url, cookies, redirect } = context;
  const path = url.pathname;

  if (path.startsWith('/dashboard') && !path.startsWith('/dashboard/signin') && !path.startsWith('/dashboard/signout') && !path.startsWith('/api/')) {
    const session = cookies.get('session')?.value;

    if (!session) {
      return redirect('/dashboard/signin');
    }

    try {
      const decoded = await adminAuth.verifySessionCookie(session, true);

      if (!path.startsWith('/dashboard/get-started')) {
        const userRef = db.doc(`users/${decoded.uid}`);
        const userSnap = await userRef.get();
        if (userSnap.exists) {
          const data = userSnap.data();
          if (data && !data.signedUp) {
            return redirect('/dashboard/get-started');
          }
        }
      }

      return next();
    } catch (error) {
      cookies.delete('session', { path: '/' });
      return redirect('/dashboard/signin');
    }
  }

  return next();
} 