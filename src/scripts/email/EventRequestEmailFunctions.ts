import { getStatusColor, getStatusText, formatDateTime, formatFlyerTypes, formatLogos } from './EmailHelpers';

export async function sendEventRequestSubmissionEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🎪 Starting event request submission email process...');

    // Get event request details
    const eventRequest = await pb.collection('event_request').getOne(data.eventRequestId);
    const user = await pb.collection('users').getOne(eventRequest.requested_user);
    
    if (!user) {
      console.error('❌ User not found:', eventRequest.requested_user);
      return false;
    }

    const coordinatorsEmail = 'coordinators@ieeeatucsd.org';
    const subject = `New Event Request Submitted: ${eventRequest.name}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎪 New Event Request Submitted</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">Event Request Details</h2>
          <p>Hello Coordinators,</p>
          <p>A new event request has been submitted by <strong>${user.name}</strong> and requires your review.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #155724;">Basic Information</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Event Name:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Location:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Start Date & Time:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formatDateTime(eventRequest.start_date_time)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">End Date & Time:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formatDateTime(eventRequest.end_date_time)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Expected Attendance:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.expected_attendance || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Submitted By:</td>
                <td style="padding: 8px 0;">${user.name} (${user.email})</td>
              </tr>
            </table>
          </div>

          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #17a2b8; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #0c5460;">Event Description</h3>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
              <p style="margin: 0; white-space: pre-wrap;">${eventRequest.event_description || 'No description provided'}</p>
            </div>
          </div>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #155724;">Next Steps</h4>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li>Review the event request details in the dashboard</li>
              <li>Coordinate with the submitter if clarification is needed</li>
              <li>Assign tasks to appropriate team members</li>
              <li>Update the event request status once processed</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Event Management System.</p>
          <p>Event Request ID: ${eventRequest.id}</p>
          <p>If you have any questions, please contact the submitter at <a href="mailto:${user.email}" style="color: #667eea;">${user.email}</a></p>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: fromEmail,
      to: [coordinatorsEmail],
      replyTo: user.email,
      subject,
      html,
    });

    console.log('✅ Event request notification email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send event request notification email:', error);
    return false;
  }
}

export async function sendEventRequestStatusChangeEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🎯 Starting event request status change email process...');

    // Get event request details
    const eventRequest = await pb.collection('event_request').getOne(data.eventRequestId);
    const user = await pb.collection('users').getOne(eventRequest.requested_user);
    
    if (!user) {
      console.error('❌ User not found:', eventRequest.requested_user);
      return false;
    }

    const coordinatorsEmail = 'coordinators@ieeeatucsd.org';
    const userSubject = `Your Event Request Status Updated: ${eventRequest.name}`;
    
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${userSubject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">IEEE UCSD Event Request Update</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">Status Update</h2>
          <p>Hello ${user.name},</p>
          <p>Your event request "<strong>${eventRequest.name}</strong>" has been updated.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${getStatusColor(data.newStatus)}; margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <span style="font-weight: bold; color: #666;">Status:</span>
              <span style="background: ${getStatusColor(data.newStatus)}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; margin-left: 10px;">${getStatusText(data.newStatus)}</span>
            </div>
            
            ${data.previousStatus && data.previousStatus !== data.newStatus ? `
              <div style="color: #666; font-size: 14px;">
                Changed from: <span style="text-decoration: line-through;">${getStatusText(data.previousStatus)}</span> → <strong>${getStatusText(data.newStatus)}</strong>
              </div>
            ` : ''}

            ${data.newStatus === 'declined' && data.declinedReason ? `
              <div style="background: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 15px 0;">
                <p style="margin: 0; color: #721c24;"><strong>Decline Reason:</strong></p>
                <p style="margin: 5px 0 0 0; color: #721c24;">${data.declinedReason}</p>
              </div>
            ` : ''}
          </div>
          
          <div style="margin: 25px 0;">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">Your Event Request Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Event Name:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${getStatusText(data.newStatus)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Location:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Event Date:</td>
                <td style="padding: 8px 0;">${formatDateTime(eventRequest.start_date_time)}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Event Management System.</p>
          <p>Event Request ID: ${eventRequest.id}</p>
          <p>If you have any questions, please contact us at <a href="mailto:coordinators@ieeeatucsd.org" style="color: #667eea;">coordinators@ieeeatucsd.org</a></p>
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

    // Send email to coordinators
    const coordinatorSubject = `Event Request Status Updated: ${eventRequest.name}`;
    await resend.emails.send({
      from: fromEmail,
      to: [coordinatorsEmail],
      replyTo: user.email,
      subject: coordinatorSubject,
      html: userHtml.replace(user.name, 'Coordinators').replace('Your event request', `Event request by ${user.name}`),
    });

    console.log('✅ Event request status change emails sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send event request status change email:', error);
    return false;
  }
}

export async function sendPRCompletedEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🎨 Starting PR completed email process...');

    // Get event request details
    const eventRequest = await pb.collection('event_request').getOne(data.eventRequestId);
    const user = await pb.collection('users').getOne(eventRequest.requested_user);
    
    if (!user || !user.email) {
      console.error('❌ User not found or no email:', eventRequest.requested_user);
      return false;
    }

    const subject = `PR Materials Completed for Your Event: ${eventRequest.name}`;
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎨 PR Materials Completed!</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">Great News!</h2>
          <p>Hello ${user.name},</p>
          <p>The PR materials for your event "<strong>${eventRequest.name}</strong>" have been completed by our PR team!</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <span style="background: #28a745; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
                ✅ PR Materials Completed
              </span>
            </div>
            
            <h3 style="margin-top: 0; color: #155724;">Event Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Event Name:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Location:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.location}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Event Date:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${formatDateTime(eventRequest.start_date_time)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Flyers Needed:</td>
                <td style="padding: 8px 0;">${eventRequest.flyers_needed ? 'Yes' : 'No'}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #856404;">📞 Next Steps</h4>
            <p style="margin: 0; color: #856404;">
              <strong>Important:</strong> Please reach out to the Internal team to coordinate any remaining logistics for your event.
            </p>
            <p style="margin: 10px 0 0 0; color: #856404;">
              Contact: <strong>internal@ieeeatucsd.org</strong>
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Event Management System.</p>
          <p>Event Request ID: ${eventRequest.id}</p>
          <p>If you have any questions about your PR materials, please contact us at <a href="mailto:${replyToEmail}" style="color: #667eea;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log('✅ PR completed email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send PR completed email:', error);
    return false;
  }
}

export async function sendDesignPRNotificationEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('🎨 Starting design PR notification email process...');

    // Get event request details
    const eventRequest = await pb.collection('event_request').getOne(data.eventRequestId);
    const user = await pb.collection('users').getOne(eventRequest.requested_user);
    
    if (!user) {
      console.error('❌ User not found:', eventRequest.requested_user);
      return false;
    }

    const designEmail = 'design@ieeeatucsd.org';
    let subject = '';
    let actionMessage = '';

    switch (data.action) {
      case 'submission':
        subject = `New Event Request with PR Materials: ${eventRequest.name}`;
        actionMessage = 'A new event request has been submitted that requires PR materials.';
        break;
      case 'pr_update':
        subject = `PR Materials Updated: ${eventRequest.name}`;
        actionMessage = 'The PR materials for this event request have been updated.';
        break;
      case 'declined':
        subject = `Event Request Declined - PR Work Cancelled: ${eventRequest.name}`;
        actionMessage = 'This event request has been declined. Please ignore any pending PR work for this event.';
        break;
      default:
        subject = `Event Request PR Notification: ${eventRequest.name}`;
        actionMessage = 'There has been an update to an event request requiring PR materials.';
    }

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${subject}</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎨 IEEE UCSD Design Team Notification</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">PR Materials ${data.action === 'declined' ? 'Cancelled' : 'Required'}</h2>
          <p>Hello Design Team,</p>
          <p>${actionMessage}</p>
          
          <div style="margin: 25px 0;">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">Event Request Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Event Name:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${eventRequest.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Action:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${data.action.charAt(0).toUpperCase() + data.action.slice(1)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Submitted By:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.name} (${user.email})</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Event Description:</td>
                <td style="padding: 8px 0;">${eventRequest.event_description}</td>
              </tr>
            </table>
          </div>

          ${data.action !== 'declined' ? `
            <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
              <p style="margin: 0; color: #155724;"><strong>Next Steps:</strong> Please coordinate with the internal team for PR material creation and timeline.</p>
            </div>
          ` : `
            <div style="background: #f8d7da; padding: 15px; border-radius: 8px; border-left: 4px solid #dc3545; margin: 20px 0;">
              <p style="margin: 0; color: #721c24;"><strong>Note:</strong> This event has been declined. No further PR work is needed.</p>
            </div>
          `}
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Event Management System.</p>
          <p>Event Request ID: ${eventRequest.id}</p>
          <p>If you have any questions, please contact <a href="mailto:internal@ieeeatucsd.org" style="color: #667eea;">internal@ieeeatucsd.org</a></p>
        </div>
      </body>
      </html>
    `;

    await resend.emails.send({
      from: fromEmail,
      to: [designEmail],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log('✅ Design PR notification email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send design PR notification email:', error);
    return false;
  }
}