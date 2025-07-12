/**
 * Utility script to check and set the signed_up field for users
 * This can be run manually to test the first-time login functionality
 */

import { Get } from './pocketbase/Get';
import { Update } from './pocketbase/Update';
import { Authentication } from './pocketbase/Authentication';

// This script can be imported and executed in the browser console
// to manually test the first-time login functionality

export async function checkUserSignUpStatus() {
  const auth = Authentication.getInstance();
  
  if (!auth.isAuthenticated()) {
    console.log("User is not authenticated");
    return false;
  }
  
  const user = auth.getCurrentUser();
  if (!user) {
    console.log("No current user found");
    return false;
  }
  
  console.log("Current user:", {
    id: user.id,
    name: user.name || 'Not set',
    signed_up: user.signed_up
  });
  
  return user.signed_up;
}

export async function resetUserSignUpStatus() {
  const auth = Authentication.getInstance();
  
  if (!auth.isAuthenticated()) {
    console.log("User is not authenticated");
    return false;
  }
  
  const user = auth.getCurrentUser();
  if (!user) {
    console.log("No current user found");
    return false;
  }
  
  try {
    const update = Update.getInstance();
    await update.updateFields("users", user.id, {
      signed_up: false
    });
    
    console.log("User signed_up status reset to false");
    console.log("Refresh the page to see the onboarding popup");
    
    return true;
  } catch (error) {
    console.error("Error resetting user signed_up status:", error);
    return false;
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).checkUserSignUpStatus = checkUserSignUpStatus;
  (window as any).resetUserSignUpStatus = resetUserSignUpStatus;
} 