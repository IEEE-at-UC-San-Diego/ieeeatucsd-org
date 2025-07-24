import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../firebase/client';

export async function sendFirebaseEventRequestSubmissionEmail(resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🎪 Starting Firebase event request submission email process...');

    const db = getFirestore(app);
    
    // Get event request details
    const eventRequestDoc = await getDoc(doc(db, 'event_requests', data.eventRequestId));
    if (!eventRequestDoc.exists()) {
      console.error('❌ Event request not found:', data.eventRequestId);
      return false;
    }
    
    const eventRequest = { id: eventRequestDoc.id, ...eventRequestDoc.data() } as any;
    
    // Get user details
    const userDoc = await getDoc(doc(db, 'users', eventRequest.requestedUser));
    if (!userDoc.exists()) {
      console.error('❌ User not found:', eventRequest.requestedUser);
      return false;
    }
    
    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const eventsEmail = 'events@ieeeatucsd.org';
    const eventsSubject = `New Event Request Submitted: ${eventRequest.name}`;
    const userSubject = `Your Event Request Has Been Submitted: ${eventRequest.name}`;

    const formatDateTime = (timestamp: any) => {
      if (!timestamp) return 'Not specified';
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } catch (error) {
        return 'Invalid date';
      }
    };

    // Create beautiful HTML template for events team
    const eventsHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${eventsSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
          .header { background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%); color: white; padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
          .content { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); margin-bottom: 20px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-table { width: 100%; border-collapse: collapse; }
          .info-table td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
          .info-table td:first-child { font-weight: 600; color: #475569; width: 35%; }
          .badge { display: inline-block; padding: 6px 12px; background: #dbeafe; color: #1e40af; border-radius: 20px; font-size: 12px; font-weight: 500; margin: 2px; }
          .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🎪 New Event Request</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Review Required</p>
          </div>
          
          <div class="content">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Hello Events Team!</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              A new event request has been submitted by <strong style="color: #1e40af;">${user.name || user.email}</strong> and requires your review.
            </p>
            
            <div class="info-card">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">📋 Event Details</h3>
              <table class="info-table">
                <tr>
                  <td>Event Name</td>
                  <td style="font-weight: 600; color: #1e293b;">${eventRequest.name}</td>
                </tr>
                <tr>
                  <td>Location</td>
                  <td>${eventRequest.location}</td>
                </tr>
                <tr>
                  <td>Start Date & Time</td>
                  <td>${formatDateTime(eventRequest.startDateTime)}</td>
                </tr>
                <tr>
                  <td>End Date & Time</td>
                  <td>${formatDateTime(eventRequest.endDateTime)}</td>
                </tr>
                <tr>
                  <td>Expected Attendance</td>
                  <td>${eventRequest.expectedAttendance || 'Not specified'}</td>
                </tr>
                <tr>
                  <td>Department</td>
                  <td>${eventRequest.department || 'General'}</td>
                </tr>
                <tr>
                  <td>Submitted By</td>
                  <td><strong>${user.name || user.email}</strong> (${user.email})</td>
                </tr>
              </table>
            </div>

            ${eventRequest.eventDescription ? `
            <div class="info-card">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">📝 Description</h3>
              <div style="background: white; padding: 15px; border-radius: 6px; border-left: 4px solid #3b82f6;">
                <p style="margin: 0; white-space: pre-wrap; line-height: 1.6;">${eventRequest.eventDescription}</p>
              </div>
            </div>
            ` : ''}

            ${eventRequest.needsGraphics || eventRequest.needsAsFunding || eventRequest.flyersNeeded || eventRequest.photographyNeeded ? `
            <div class="info-card">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">⚡ Special Requirements</h3>
              <div>
                ${eventRequest.needsGraphics ? '<span class="badge">Graphics Required</span>' : ''}
                ${eventRequest.needsAsFunding ? '<span class="badge">AS Funding</span>' : ''}
                ${eventRequest.flyersNeeded ? '<span class="badge">Flyers Needed</span>' : ''}
                ${eventRequest.photographyNeeded ? '<span class="badge">Photography</span>' : ''}
              </div>
            </div>
            ` : ''}
            
            <div style="background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #15803d; font-size: 16px;">✅ Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; color: #15803d; line-height: 1.7;">
                <li>Review the event request in the dashboard</li>
                <li>Contact the submitter if clarification is needed</li>
                <li>Assign tasks to appropriate team members</li>
                <li>Update the status once processed</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Event Request ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${eventRequest.id}</code></p>
            <p>Questions? Contact the submitter at <a href="mailto:${user.email}" style="color: #3b82f6; text-decoration: none;">${user.email}</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Create confirmation email for the event requester
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${userSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
          .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: white; padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
          .content { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); margin-bottom: 20px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-table { width: 100%; border-collapse: collapse; }
          .info-table td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
          .info-table td:first-child { font-weight: 600; color: #475569; width: 35%; }
          .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">✅ Request Submitted!</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Thank you for your submission</p>
          </div>
          
          <div class="content">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Hello ${user.name || user.email}!</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              Your event request "<strong style="color: #059669;">${eventRequest.name}</strong>" has been successfully submitted to the IEEE UCSD Events Team.
            </p>
            
            <div class="info-card">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">📋 Your Submission Summary</h3>
              <table class="info-table">
                <tr>
                  <td>Event Name</td>
                  <td style="font-weight: 600; color: #1e293b;">${eventRequest.name}</td>
                </tr>
                <tr>
                  <td>Location</td>
                  <td>${eventRequest.location}</td>
                </tr>
                <tr>
                  <td>Date & Time</td>
                  <td>${formatDateTime(eventRequest.startDateTime)}</td>
                </tr>
                <tr>
                  <td>Expected Attendance</td>
                  <td>${eventRequest.expectedAttendance || 'Not specified'}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td><span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">Submitted for Review</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #1d4ed8; font-size: 16px;">⏱️ What Happens Next?</h4>
              <ul style="margin: 0; padding-left: 20px; color: #1d4ed8; line-height: 1.7;">
                <li>Our Events Team will review your request</li>
                <li>You'll receive email updates as the status changes</li>
                <li>We may contact you if we need additional information</li>
                <li>Typical review time is 3-5 business days</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Reference ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${eventRequest.id}</code></p>
            <p>Questions? Contact us at <a href="mailto:events@ieeeatucsd.org" style="color: #3b82f6; text-decoration: none;">events@ieeeatucsd.org</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to events team
    await resend.emails.send({
      from: fromEmail,
      to: [eventsEmail],
      replyTo: user.email,
      subject: eventsSubject,
      html: eventsHtml,
    });

    // Send confirmation to event requester
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log('✅ Firebase event request notification emails sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Firebase event request notification email:', error);
    return false;
  }
}

export async function sendFirebaseEventRequestStatusChangeEmail(resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🎯 Starting Firebase event request status change email process...');

    const db = getFirestore(app);
    
    // Get event request details
    const eventRequestDoc = await getDoc(doc(db, 'event_requests', data.eventRequestId));
    if (!eventRequestDoc.exists()) {
      console.error('❌ Event request not found:', data.eventRequestId);
      return false;
    }
    
    const eventRequest = { id: eventRequestDoc.id, ...eventRequestDoc.data() } as any;
    
    // Get user details
    const userDoc = await getDoc(doc(db, 'users', eventRequest.requestedUser));
    if (!userDoc.exists()) {
      console.error('❌ User not found:', eventRequest.requestedUser);
      return false;
    }
    
    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const getStatusColor = (status: string) => {
      switch (status) {
        case 'approved': return '#28a745';
        case 'declined': case 'rejected': return '#dc3545';
        case 'submitted': case 'pending': return '#ffc107';
        default: return '#6c757d';
      }
    };

    const getStatusText = (status: string) => {
      switch (status) {
        case 'approved': return 'Approved';
        case 'declined': case 'rejected': return 'Declined';
        case 'submitted': return 'Submitted';
        case 'pending': return 'Pending Review';
        default: return status;
      }
    };

    const formatDateTime = (timestamp: any) => {
      if (!timestamp) return 'Not specified';
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } catch (error) {
        return 'Invalid date';
      }
    };

    const userSubject = `Your Event Request Status Updated: ${eventRequest.name}`;
    
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${userSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
          .content { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); margin-bottom: 20px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-table { width: 100%; border-collapse: collapse; }
          .info-table td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
          .info-table td:first-child { font-weight: 600; color: #475569; width: 35%; }
          .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">📋 Event Status Update</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">IEEE UCSD Events</p>
          </div>
          
          <div class="content">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Hello ${user.name || user.email}!</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              Your event request "<strong>${eventRequest.name}</strong>" has been updated.
            </p>
            
            <div class="info-card" style="border-left: 4px solid ${getStatusColor(data.newStatus)};">
              <div style="margin-bottom: 15px;">
                <span style="font-weight: bold; color: #666;">Status:</span>
                <span style="background: ${getStatusColor(data.newStatus)}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; margin-left: 10px;">${getStatusText(data.newStatus)}</span>
              </div>
              
              ${data.previousStatus && data.previousStatus !== data.newStatus ? `
                <div style="color: #666; font-size: 14px;">
                  Changed from: <span style="text-decoration: line-through;">${getStatusText(data.previousStatus)}</span> → <strong>${getStatusText(data.newStatus)}</strong>
                </div>
              ` : ''}

              ${(data.newStatus === 'declined' || data.newStatus === 'rejected') && data.declinedReason ? `
                <div style="background: #fef2f2; border: 1px solid #fecaca; padding: 15px; border-radius: 8px; margin: 15px 0;">
                  <p style="margin: 0; color: #991b1b; font-weight: 600;">Decline Reason:</p>
                  <p style="margin: 5px 0 0 0; color: #991b1b;">${data.declinedReason}</p>
                </div>
              ` : ''}
            </div>
            
            <div class="info-card">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">Event Details</h3>
              <table class="info-table">
                <tr>
                  <td>Event Name</td>
                  <td style="font-weight: 600; color: #1e293b;">${eventRequest.name}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td><span style="background: ${getStatusColor(data.newStatus)}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">${getStatusText(data.newStatus)}</span></td>
                </tr>
                <tr>
                  <td>Location</td>
                  <td>${eventRequest.location}</td>
                </tr>
                <tr>
                  <td>Date & Time</td>
                  <td>${formatDateTime(eventRequest.startDateTime)}</td>
                </tr>
              </table>
            </div>
          </div>
          
          <div class="footer">
            <p>Event Request ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${eventRequest.id}</code></p>
            <p>Questions? Contact us at <a href="mailto:events@ieeeatucsd.org" style="color: #3b82f6; text-decoration: none;">events@ieeeatucsd.org</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email to user
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log('✅ Firebase event request status change email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Firebase event request status change email:', error);
    return false;
  }
}

export async function sendFirebaseEventEditEmail(resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('✏️ Starting Firebase event edit email process...');

    const db = getFirestore(app);
    
    // Get event request details
    const eventRequestDoc = await getDoc(doc(db, 'event_requests', data.eventRequestId));
    if (!eventRequestDoc.exists()) {
      console.error('❌ Event request not found:', data.eventRequestId);
      return false;
    }
    
    const eventRequest = { id: eventRequestDoc.id, ...eventRequestDoc.data() } as any;
    
    // Get user details
    const userDoc = await getDoc(doc(db, 'users', eventRequest.requestedUser));
    if (!userDoc.exists()) {
      console.error('❌ User not found:', eventRequest.requestedUser);
      return false;
    }
    
    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const eventsEmail = 'events@ieeeatucsd.org';
    const subject = `Event Request Edited: ${eventRequest.name}`;

    const formatDateTime = (timestamp: any) => {
      if (!timestamp) return 'Not specified';
      try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
      } catch (error) {
        return 'Invalid date';
      }
    };

    const generateChangesTable = (before: any, after: any) => {
      const changes = [];
      const fieldsToCheck = [
        { key: 'name', label: 'Event Name' },
        { key: 'location', label: 'Location' },
        { key: 'eventDescription', label: 'Description' },
        { key: 'department', label: 'Department' },
        { key: 'expectedAttendance', label: 'Expected Attendance' },
        { key: 'needsGraphics', label: 'Needs Graphics', format: (val: boolean) => val ? 'Yes' : 'No' },
        { key: 'needsAsFunding', label: 'Needs AS Funding', format: (val: boolean) => val ? 'Yes' : 'No' },
        { key: 'flyersNeeded', label: 'Flyers Needed', format: (val: boolean) => val ? 'Yes' : 'No' },
        { key: 'photographyNeeded', label: 'Photography Needed', format: (val: boolean) => val ? 'Yes' : 'No' },
      ];

      for (const field of fieldsToCheck) {
        const beforeVal = before[field.key];
        const afterVal = after[field.key];
        
        if (beforeVal !== afterVal) {
          changes.push({
            field: field.label,
            before: field.format ? field.format(beforeVal) : (beforeVal || 'Not specified'),
            after: field.format ? field.format(afterVal) : (afterVal || 'Not specified')
          });
        }
      }

      // Handle date changes
      if (before.startDateTime !== after.startDateTime) {
        changes.push({
          field: 'Start Date & Time',
          before: formatDateTime(before.startDateTime),
          after: formatDateTime(after.startDateTime)
        });
      }

      if (before.endDateTime !== after.endDateTime) {
        changes.push({
          field: 'End Date & Time',
          before: formatDateTime(before.endDateTime),
          after: formatDateTime(after.endDateTime)
        });
      }

      return changes.map(change => `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${change.field}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #dc3545; text-decoration: line-through;">${change.before}</td>
          <td style="padding: 8px; border: 1px solid #ddd; color: #28a745; font-weight: 500;">${change.after}</td>
        </tr>
      `).join('');
    };

    const changesTable = generateChangesTable(data.previousData, data.newData);

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
          .header { background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
          .content { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); margin-bottom: 20px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-table { width: 100%; border-collapse: collapse; }
          .info-table td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
          .info-table td:first-child { font-weight: 600; color: #475569; width: 35%; }
          .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">✏️ Event Request Edited</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Changes Made</p>
          </div>
          
          <div class="content">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Event Changes</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              The event request "<strong>${eventRequest.name}</strong>" submitted by <strong>${user.name || user.email}</strong> has been edited.
            </p>
            
            ${changesTable ? `
            <div class="info-card" style="border-left: 4px solid #f59e0b;">
              <h3 style="margin: 0 0 15px 0; color: #92400e; font-size: 18px;">📝 Changes Made</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr style="background: #f8f9fa;">
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Field</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">Before</th>
                  <th style="padding: 12px; border: 1px solid #ddd; text-align: left;">After</th>
                </tr>
                ${changesTable}
              </table>
            </div>
            ` : `
            <div class="info-card" style="border-left: 4px solid #3b82f6;">
              <p style="margin: 0; color: #1e40af;">Minor changes were made to the event request. Please review the updated details in the dashboard.</p>
            </div>
            `}

            <div class="info-card">
              <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 18px;">📋 Current Event Details</h3>
              <table class="info-table">
                <tr>
                  <td>Event Name</td>
                  <td style="font-weight: 600; color: #1e293b;">${eventRequest.name}</td>
                </tr>
                <tr>
                  <td>Location</td>
                  <td>${eventRequest.location}</td>
                </tr>
                <tr>
                  <td>Start Date & Time</td>
                  <td>${formatDateTime(eventRequest.startDateTime)}</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td>${eventRequest.status}</td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dcfce7; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #15803d; font-size: 16px;">✅ Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; color: #15803d; line-height: 1.7;">
                <li>Review the changes in the dashboard</li>
                <li>Contact the submitter if clarification is needed</li>
                <li>Update any assigned tasks if necessary</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Event Request ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${eventRequest.id}</code></p>
            <p>Questions? Contact the submitter at <a href="mailto:${user.email}" style="color: #3b82f6; text-decoration: none;">${user.email}</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to events team
    await resend.emails.send({
      from: fromEmail,
      to: [eventsEmail],
      replyTo: user.email,
      subject,
      html,
    });

    // Send to event requester
    const userSubject = `Your Event Request Has Been Updated: ${eventRequest.name}`;
    const userHtml = html.replace('Event Changes', 'Your Event Update')
                         .replace('has been edited.', 'has been updated.')
                         .replace('Review the changes in the dashboard', 'You can view the updated details in the dashboard');

    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log('✅ Firebase event edit emails sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Firebase event edit email:', error);
    return false;
  }
}

export async function sendFirebaseEventDeleteEmail(resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🗑️ Starting Firebase event delete email process...');

    const eventsEmail = 'events@ieeeatucsd.org';
    const subject = `Event Request Deleted: ${data.eventName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; }
          .header { background: linear-gradient(135deg, #dc2626 0%, #991b1b 100%); color: white; padding: 40px 30px; border-radius: 12px; text-align: center; margin-bottom: 30px; }
          .content { background: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05); margin-bottom: 20px; }
          .info-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 20px 0; }
          .info-table { width: 100%; border-collapse: collapse; }
          .info-table td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
          .info-table td:first-child { font-weight: 600; color: #475569; width: 35%; }
          .footer { text-align: center; color: #64748b; font-size: 14px; margin-top: 30px; }
        </style>
      </head>
      <body style="margin: 0; padding: 20px; background-color: #f1f5f9;">
        <div class="container">
          <div class="header">
            <h1 style="margin: 0; font-size: 28px; font-weight: 700;">🗑️ Event Request Deleted</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9; font-size: 16px;">Deletion Notice</p>
          </div>
          
          <div class="content">
            <h2 style="margin: 0 0 20px 0; color: #1e293b; font-size: 22px;">Event Deletion Notice</h2>
            <p style="margin: 0 0 20px 0; color: #475569; font-size: 16px; line-height: 1.6;">
              The event request "<strong>${data.eventName}</strong>" has been deleted from the system.
            </p>
            
            <div class="info-card" style="border-left: 4px solid #dc2626;">
              <h3 style="margin: 0 0 15px 0; color: #991b1b; font-size: 18px;">📋 Deleted Event Details</h3>
              <table class="info-table">
                <tr>
                  <td>Event Name</td>
                  <td style="font-weight: 600; color: #1e293b;">${data.eventName}</td>
                </tr>
                <tr>
                  <td>Location</td>
                  <td>${data.location || 'Not specified'}</td>
                </tr>
                <tr>
                  <td>Submitted By</td>
                  <td>${data.userName} (${data.userEmail})</td>
                </tr>
                <tr>
                  <td>Status</td>
                  <td>${data.status || 'Unknown'}</td>
                </tr>
                <tr>
                  <td>Event Request ID</td>
                  <td><code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${data.eventRequestId}</code></td>
                </tr>
              </table>
            </div>
            
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #991b1b; font-size: 16px;">⚠️ Action Required</h4>
              <ul style="margin: 0; padding-left: 20px; color: #991b1b; line-height: 1.7;">
                <li>Cancel any ongoing work related to this event</li>
                <li>Notify team members who were assigned to this event</li>
                <li>Update any external communications if necessary</li>
                <li>Contact the submitter if follow-up is needed</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Questions? Contact the submitter at <a href="mailto:${data.userEmail}" style="color: #3b82f6; text-decoration: none;">${data.userEmail}</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Event Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to events team
    await resend.emails.send({
      from: fromEmail,
      to: [eventsEmail],
      replyTo: data.userEmail,
      subject,
      html,
    });

    // Send to event requester
    const userSubject = `Your Event Request Has Been Deleted: ${data.eventName}`;
    const userHtml = html.replace('Event Deletion Notice', `Hello ${data.userName}!`)
                         .replace('has been deleted from the system.', 'has been deleted.')
                         .replace('Cancel any ongoing work related to this event', 'The event request has been removed from the system')
                         .replace('Notify team members who were assigned to this event', 'Any related materials and tasks have been cancelled')
                         .replace('Update any external communications if necessary', 'Please contact us if you need to submit a new request')
                         .replace('Contact the submitter if follow-up is needed', 'Feel free to reach out if you have any questions');

    await resend.emails.send({
      from: fromEmail,
      to: [data.userEmail],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log('✅ Firebase event delete emails sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send Firebase event delete email:', error);
    return false;
  }
} 