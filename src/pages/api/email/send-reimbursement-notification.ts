import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('📨 Reimbursement email API called');
    
    const { 
      type, 
      reimbursementId, 
      previousStatus, 
      newStatus, 
      changedByUserId, 
      comment, 
      commentByUserId, 
      isPrivate,
      additionalContext,
      authData // Change to authData containing token and model
    } = await request.json();

    console.log('📋 Request data:', {
      type,
      reimbursementId,
      hasAuthData: !!authData,
      authDataHasToken: !!(authData?.token),
      authDataHasModel: !!(authData?.model),
      commentLength: comment?.length || 0,
      commentByUserId,
      isPrivate
    });

    if (!type || !reimbursementId) {
      console.error('❌ Missing required parameters');
      return new Response(
        JSON.stringify({ error: 'Missing required parameters: type and reimbursementId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Import Resend and create direct PocketBase connection for server-side use
    const { Resend } = await import('resend');
    const PocketBase = await import('pocketbase').then(module => module.default);
    
    // Initialize services
    const pb = new PocketBase(import.meta.env.POCKETBASE_URL || 'http://127.0.0.1:8090');
    const resend = new Resend(import.meta.env.RESEND_API_KEY);
    
    if (!import.meta.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }

    // Authenticate with PocketBase if auth data is provided
    if (authData && authData.token && authData.model) {
      console.log('🔐 Authenticating with PocketBase using provided auth data');
      pb.authStore.save(authData.token, authData.model);
      console.log('✅ PocketBase authentication successful');
    } else {
      console.warn('⚠️ No auth data provided, proceeding without authentication');
    }

    const fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@ieeeucsd.org>';
    const replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'treasurer@ieeeucsd.org';

    let success = false;

    console.log(`🎯 Processing email type: ${type}`);

    switch (type) {
      case 'status_change':
        if (!newStatus) {
          return new Response(
            JSON.stringify({ error: 'Missing newStatus for status_change notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendStatusChangeEmail(pb, resend, fromEmail, replyToEmail, {
          reimbursementId,
          newStatus,
          previousStatus,
          changedByUserId,
          additionalContext
        });
        break;

      case 'comment':
        if (!comment || !commentByUserId) {
          console.error('❌ Missing comment or commentByUserId for comment notification');
          return new Response(
            JSON.stringify({ error: 'Missing comment or commentByUserId for comment notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendCommentEmail(pb, resend, fromEmail, replyToEmail, {
          reimbursementId,
          comment,
          commentByUserId,
          isPrivate: isPrivate || false
        });
        break;

      case 'submission':
        success = await sendSubmissionEmail(pb, resend, fromEmail, replyToEmail, {
          reimbursementId
        });
        break;

      case 'test':
        const { email } = additionalContext || {};
        if (!email) {
          return new Response(
            JSON.stringify({ error: 'Missing email for test notification' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          );
        }
        success = await sendTestEmail(resend, fromEmail, replyToEmail, email);
        break;

      default:
        console.error('❌ Unknown notification type:', type);
        return new Response(
          JSON.stringify({ error: `Unknown notification type: ${type}` }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
    }

    console.log(`📊 Email operation result: ${success ? 'SUCCESS' : 'FAILED'}`);

    return new Response(
      JSON.stringify({ 
        success, 
        message: success ? 'Email notification sent successfully' : 'Failed to send email notification' 
      }),
      { 
        status: success ? 200 : 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Error in email notification API:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// Helper functions for different email types
async function sendStatusChangeEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('📧 Starting status change email process...');
    console.log('Environment check:', {
      hasResendKey: !!import.meta.env.RESEND_API_KEY,
      fromEmail,
      replyToEmail,
      pocketbaseUrl: import.meta.env.POCKETBASE_URL
    });

    // Get reimbursement details
    console.log('🔍 Fetching reimbursement details for:', data.reimbursementId);
    const reimbursement = await pb.collection('reimbursement').getOne(data.reimbursementId);
    console.log('✅ Reimbursement fetched:', { id: reimbursement.id, title: reimbursement.title });
    
    // Get submitter user details  
    console.log('👤 Fetching user details for:', reimbursement.submitted_by);
    const user = await pb.collection('users').getOne(reimbursement.submitted_by);
    if (!user || !user.email) {
      console.error('❌ User not found or no email:', reimbursement.submitted_by);
      return false;
    }
    console.log('✅ User fetched:', { id: user.id, name: user.name, email: user.email });

    // Get changed by user name if provided
    let changedByName = 'System';
    if (data.changedByUserId) {
      try {
        const changedByUser = await pb.collection('users').getOne(data.changedByUserId);
        changedByName = changedByUser?.name || 'Unknown User';
        console.log('👤 Changed by user:', changedByName);
      } catch (error) {
        console.warn('⚠️ Could not get changed by user name:', error);
      }
    }

    const subject = `Reimbursement Status Updated: ${reimbursement.title}`;
    const statusColor = getStatusColor(data.newStatus);
    const statusText = getStatusText(data.newStatus);
    
    console.log('📝 Email details:', {
      to: user.email,
      subject,
      status: data.newStatus
    });

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
          <h1 style="color: white; margin: 0; font-size: 24px;">IEEE UCSD Reimbursement Update</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">Status Update</h2>
          <p>Hello ${user.name},</p>
          <p>Your reimbursement request "<strong>${reimbursement.title}</strong>" has been updated.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${statusColor}; margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <span style="font-weight: bold; color: #666;">Status:</span>
              <span style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500; margin-left: 10px;">${statusText}</span>
            </div>
            
            ${data.previousStatus && data.previousStatus !== data.newStatus ? `
              <div style="color: #666; font-size: 14px;">
                Changed from: <span style="text-decoration: line-through;">${getStatusText(data.previousStatus)}</span> → <strong>${statusText}</strong>
              </div>
            ` : ''}
            
            ${changedByName !== 'System' ? `
              <div style="color: #666; font-size: 14px; margin-top: 10px;">
                Updated by: ${changedByName}
              </div>
            ` : ''}
            
            ${data.newStatus === 'rejected' && data.additionalContext?.rejectionReason ? `
              <div style="background: #f8d7da; padding: 15px; border-radius: 6px; border: 1px solid #f5c6cb; margin-top: 15px;">
                <div style="font-weight: bold; color: #721c24; margin-bottom: 8px;">Rejection Reason:</div>
                <div style="color: #721c24; font-style: italic;">${data.additionalContext.rejectionReason}</div>
              </div>
            ` : ''}
          </div>
          
          <div style="margin: 25px 0;">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">Reimbursement Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Amount:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">$${reimbursement.total_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Date of Purchase:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date(reimbursement.date_of_purchase).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Department:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${reimbursement.department.charAt(0).toUpperCase() + reimbursement.department.slice(1)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Payment Method:</td>
                <td style="padding: 8px 0;">${reimbursement.payment_method}</td>
              </tr>
            </table>
          </div>
          
          <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Next Steps:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              ${getNextStepsText(data.newStatus)}
            </p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Reimbursement System.</p>
          <p>If you have any questions, please contact us at <a href="mailto:${replyToEmail}" style="color: #667eea;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    console.log('📤 Attempting to send email via Resend...');
    const result = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log('✅ Resend response:', result);
    console.log('🎉 Status change email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send status change email:', error);
    console.error('Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

async function sendCommentEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('💬 Starting comment email process...');
    console.log('Comment data received:', {
      reimbursementId: data.reimbursementId,
      commentByUserId: data.commentByUserId,
      isPrivate: data.isPrivate,
      commentLength: data.comment?.length || 0
    });

    // Don't send emails for private comments
    if (data.isPrivate) {
      console.log('🔒 Comment is private, skipping email notification');
      return true;
    }

    // Get reimbursement details
    console.log('🔍 Fetching reimbursement details for:', data.reimbursementId);
    const reimbursement = await pb.collection('reimbursement').getOne(data.reimbursementId);
    console.log('✅ Reimbursement fetched:', { 
      id: reimbursement.id, 
      title: reimbursement.title,
      submitted_by: reimbursement.submitted_by 
    });
    
    // Get submitter user details
    console.log('👤 Fetching submitter user details for:', reimbursement.submitted_by);
    const user = await pb.collection('users').getOne(reimbursement.submitted_by);
    if (!user || !user.email) {
      console.error('❌ User not found or no email:', reimbursement.submitted_by);
      return false;
    }
    console.log('✅ Submitter user fetched:', { 
      id: user.id, 
      name: user.name, 
      email: user.email 
    });

    // Get commenter user name
    console.log('👤 Fetching commenter user details for:', data.commentByUserId);
    let commentByName = 'Unknown User';
    try {
      const commentByUser = await pb.collection('users').getOne(data.commentByUserId);
      commentByName = commentByUser?.name || 'Unknown User';
      console.log('✅ Commenter user fetched:', { 
        id: commentByUser?.id, 
        name: commentByName 
      });
    } catch (error) {
      console.warn('⚠️ Could not get commenter user name:', error);
    }

    const subject = `New Comment on Reimbursement: ${reimbursement.title}`;
    
    console.log('📝 Comment email details:', {
      to: user.email,
      subject,
      commentBy: commentByName,
      commentPreview: data.comment.substring(0, 50) + (data.comment.length > 50 ? '...' : '')
    });

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
          <h1 style="color: white; margin: 0; font-size: 24px;">IEEE UCSD Reimbursement Comment</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">New Comment Added</h2>
          <p>Hello ${user.name},</p>
          <p>A new comment has been added to your reimbursement request "<strong>${reimbursement.title}</strong>".</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #3498db; margin: 20px 0;">
            <div style="margin-bottom: 15px;">
              <span style="font-weight: bold; color: #2980b9;">Comment by:</span> ${commentByName}
            </div>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
              <p style="margin: 0; font-style: italic;">${data.comment}</p>
            </div>
          </div>
          
          <div style="margin: 25px 0;">
            <h3 style="color: #2c3e50; margin-bottom: 15px;">Reimbursement Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Status:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                  <span style="background: ${getStatusColor(reimbursement.status)}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                    ${getStatusText(reimbursement.status)}
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">$${reimbursement.total_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Date of Purchase:</td>
                <td style="padding: 8px 0;">${new Date(reimbursement.date_of_purchase).toLocaleDateString()}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Reimbursement System.</p>
          <p>If you have any questions, please contact us at <a href="mailto:${replyToEmail}" style="color: #667eea;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    console.log('📤 Attempting to send comment email via Resend...');
    const result = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log('✅ Resend comment email response:', result);
    console.log('🎉 Comment email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send comment email:', error);
    console.error('Comment email error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

async function sendSubmissionEmail(pb: any, resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    // Get reimbursement details
    const reimbursement = await pb.collection('reimbursement').getOne(data.reimbursementId);
    
    // Get submitter user details
    const user = await pb.collection('users').getOne(reimbursement.submitted_by);
    if (!user || !user.email) {
      console.error('User not found or no email:', reimbursement.submitted_by);
      return false;
    }

    const subject = `Reimbursement Submitted: ${reimbursement.title}`;
    
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
          <h1 style="color: white; margin: 0; font-size: 24px;">✅ Reimbursement Submitted Successfully</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">Submission Confirmed</h2>
          <p>Hello ${user.name},</p>
          <p>Your reimbursement request has been successfully submitted and is now under review.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #155724;">Reimbursement Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Title:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${reimbursement.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Amount:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">$${reimbursement.total_amount.toFixed(2)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Date of Purchase:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${new Date(reimbursement.date_of_purchase).toLocaleDateString()}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Department:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${reimbursement.department.charAt(0).toUpperCase() + reimbursement.department.slice(1)}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Payment Method:</td>
                <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${reimbursement.payment_method}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-weight: bold;">Status:</td>
                <td style="padding: 8px 0;">
                  <span style="background: #ffc107; color: #212529; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                    Submitted
                  </span>
                </td>
              </tr>
            </table>
          </div>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <h4 style="margin: 0 0 10px 0; color: #155724;">What happens next?</h4>
            <ul style="margin: 0; padding-left: 20px; color: #155724;">
              <li>Your receipts will be reviewed by our team</li>
              <li>You'll receive email updates as the status changes</li>
              <li>Once approved, payment will be processed</li>
              <li>Typical processing time is 1-2 weeks</li>
            </ul>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is an automated notification from IEEE UCSD Reimbursement System.</p>
          <p>If you have any questions, please contact us at <a href="mailto:${replyToEmail}" style="color: #667eea;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    const result = await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log('Submission confirmation email sent successfully:', result);
    return true;
  } catch (error) {
    console.error('Failed to send submission confirmation email:', error);
    return false;
  }
}

async function sendTestEmail(resend: any, fromEmail: string, replyToEmail: string, email: string): Promise<boolean> {
  try {
    console.log('🧪 Starting test email process...');
    console.log('Test email configuration:', {
      fromEmail,
      replyToEmail,
      toEmail: email,
      hasResend: !!resend
    });

    const subject = 'Test Email from IEEE UCSD Reimbursement System';
    
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
          <h1 style="color: white; margin: 0; font-size: 24px;">🧪 Test Email</h1>
        </div>
        
        <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
          <h2 style="margin-top: 0; color: #2c3e50;">Email System Test</h2>
          <p>This is a test email from the IEEE UCSD Reimbursement System.</p>
          <p>If you receive this email, the notification system is working correctly!</p>
          
          <div style="background: #d4edda; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <p style="margin: 0; color: #155724;">✅ Email delivery successful</p>
          </div>
        </div>
        
        <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
          <p>This is a test notification from IEEE UCSD Reimbursement System.</p>
          <p>If you have any questions, please contact us at <a href="mailto:${replyToEmail}" style="color: #667eea;">${replyToEmail}</a></p>
        </div>
      </body>
      </html>
    `;

    console.log('📤 Sending test email via Resend...');
    const result = await resend.emails.send({
      from: fromEmail,
      to: [email],
      replyTo: replyToEmail,
      subject,
      html,
    });

    console.log('✅ Resend test email response:', result);
    console.log('🎉 Test email sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send test email:', error);
    console.error('Test email error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}

// Helper functions
function getStatusColor(status: string): string {
  switch (status) {
    case 'submitted': return '#ffc107';
    case 'under_review': return '#17a2b8';
    case 'approved': return '#28a745';
    case 'rejected': return '#dc3545';
    case 'in_progress': return '#6f42c1';
    case 'paid': return '#20c997';
    default: return '#6c757d';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'submitted': return 'Submitted';
    case 'under_review': return 'Under Review';
    case 'approved': return 'Approved';
    case 'rejected': return 'Rejected';
    case 'in_progress': return 'In Progress';
    case 'paid': return 'Paid';
    default: return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

function getNextStepsText(status: string): string {
  switch (status) {
    case 'submitted':
      return 'Your reimbursement is in the queue for review. We\'ll notify you once it\'s being processed.';
    case 'under_review':
      return 'Our team is currently reviewing your receipts and documentation. No action needed from you.';
    case 'approved':
      return 'Your reimbursement has been approved! Payment processing will begin shortly.';
    case 'rejected':
      return 'Your reimbursement has been rejected. Please review the rejection reason above and reach out to our treasurer if you have questions or need to resubmit with corrections.';
    case 'in_progress':
      return 'Payment is being processed. You should receive your reimbursement within 1-2 business days.';
    case 'paid':
      return 'Your reimbursement has been completed! Please check your account for the payment.';
    default:
      return 'Check your dashboard for more details about your reimbursement status.';
  }
} 