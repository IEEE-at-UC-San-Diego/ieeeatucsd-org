import type { APIRoute } from 'astro';
import { OfficerEmailNotifications } from '../../../scripts/email/OfficerEmailNotifications';
import type { OfficerRoleChangeEmailData } from '../../../scripts/email/OfficerEmailNotifications';
import { initializeEmailServices, authenticatePocketBase } from '../../../scripts/email/EmailHelpers';
import { Collections } from '../../../schemas/pocketbase';
import type { User, Officer } from '../../../schemas/pocketbase/schema';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📨 Officer notification email API called');
    
    const requestData = await request.json();
    const { 
      type, 
      officerId, 
      additionalContext,
      authData 
    } = requestData;

    console.log('📋 Request data:', {
      type,
      officerId,
      hasAdditionalContext: !!additionalContext,
      hasAuthData: !!authData
    });

    if (type !== 'officer_role_change') {
      console.error('❌ Invalid notification type for officer endpoint:', type);
      return new Response(
        JSON.stringify({ error: `Invalid notification type: ${type}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!officerId) {
      console.error('❌ Missing required parameter: officerId');
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: officerId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Initialize services - this creates a fresh PocketBase instance for server-side use
    const { pb } = await initializeEmailServices();
    
    // Authenticate with PocketBase if auth data is provided
    authenticatePocketBase(pb, authData);

    const emailService = OfficerEmailNotifications.getInstance();

    // Get the officer record with user data
    console.log('🔍 Fetching officer data...');
    const officer = await pb.collection(Collections.OFFICERS).getOne(officerId, {
      expand: 'user'
    }) as Officer & { expand?: { user: User } };

    if (!officer) {
      console.error('❌ Officer not found:', officerId);
      return new Response(
        JSON.stringify({ error: 'Officer not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get the user data from the expanded relation
    const user = officer.expand?.user;

    if (!user) {
      console.error('❌ User data not found for officer:', officerId);
      return new Response(
        JSON.stringify({ error: 'User data not found for officer' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Extract additional context data
    const {
      previousRole,
      previousType,
      newRole,
      newType,
      changedByUserId,
      isNewOfficer
    } = additionalContext || {};

    // Get the name of the person who made the change
    let changedByName = '';
    if (changedByUserId) {
      try {
        const changedByUser = await pb.collection(Collections.USERS).getOne(changedByUserId) as User;
        changedByName = changedByUser?.name || 'Unknown User';
      } catch (error) {
        console.warn('Could not fetch changed by user name:', error);
        changedByName = 'Unknown User';
      }
    }

    // Prepare email data
    const emailData: OfficerRoleChangeEmailData = {
      user,
      officer,
      previousRole,
      previousType,
      newRole: newRole || officer.role,
      newType: newType || officer.type,
      changedBy: changedByName,
      isNewOfficer: isNewOfficer || false
    };

    console.log('📧 Sending officer role change notification...');
    console.log('📧 Email data:', {
      userName: user.name,
      userEmail: user.email,
      officerRole: emailData.newRole,
      officerType: emailData.newType,
      previousRole: emailData.previousRole,
      previousType: emailData.previousType,
      changedBy: emailData.changedBy,
      isNewOfficer: emailData.isNewOfficer
    });

    const success = await emailService.sendRoleChangeNotification(emailData);

    if (success) {
      console.log('✅ Officer role change notification sent successfully');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Officer role change notification sent successfully'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Failed to send officer role change notification');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send officer role change notification'
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('❌ Error in officer notification API:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}; 