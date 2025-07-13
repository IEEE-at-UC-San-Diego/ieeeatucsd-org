import type { APIRoute } from 'astro';
import { Resend } from 'resend';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { name, email, role, position, message, inviteId } = await request.json();

        if (!name || !email || !role || !inviteId) {
            return new Response(
                JSON.stringify({ error: 'Missing required fields' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } }
            );
        }

        // Initialize Resend
        const resend = new Resend(import.meta.env.RESEND_API_KEY);
        
        if (!import.meta.env.RESEND_API_KEY) {
            console.error('RESEND_API_KEY not configured');
            return new Response(
                JSON.stringify({ error: 'Email service not configured' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } }
            );
        }

        const fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@ieeeatucsd.org>';
        const replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'ieee@ucsd.edu';
        
        // Create invite link (you can customize this URL)
        const baseUrl = new URL(request.url).origin;
        const inviteLink = `${baseUrl}/dashboard/signin?invite=${inviteId}`;

        const roleText = position ? `${role} - ${position}` : role;
        const subject = `You're invited to join IEEE UCSD as ${roleText}`;
        
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${subject}</title>
            </head>
            <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
                <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px;">
                    <h1 style="color: white; margin: 0; font-size: 24px;">You're Invited to Join IEEE UCSD!</h1>
                </div>
                
                <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
                    <h2 style="margin-top: 0; color: #2c3e50;">Hello ${name},</h2>
                    <p>You have been invited to join IEEE UCSD with the role of <strong>${role}</strong>${position ? ` as <strong>${position}</strong>` : ''}.</p>
                    
                    ${message ? `
                        <div style="background: #e7f3ff; padding: 15px; border-radius: 8px; border-left: 4px solid #007bff; margin: 20px 0;">
                            <p style="margin: 0; font-style: italic;">"${message}"</p>
                        </div>
                    ` : ''}
                </div>
                
                <div style="background: white; border: 1px solid #dee2e6; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
                    <h3 style="margin-top: 0; color: #2c3e50;">About IEEE UCSD</h3>
                    <p>IEEE UCSD is the largest engineering student organization at UC San Diego, offering:</p>
                    <ul style="padding-left: 20px; color: #495057;">
                        <li>Professional development workshops and networking events</li>
                        <li>Technical projects and hackathons</li>
                        <li>Industry mentorship opportunities</li>
                        <li>Social events and community building</li>
                        <li>Access to exclusive resources and career opportunities</li>
                    </ul>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                    <a href="${inviteLink}" style="background: #1e40af; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 500; display: inline-block;">
                        Accept Invitation & Join IEEE UCSD
                    </a>
                </div>
                
                <div style="background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;">
                    <p style="margin: 0; font-size: 14px;"><strong>Next Steps:</strong></p>
                    <ol style="margin: 10px 0; padding-left: 20px; font-size: 14px;">
                        <li>Click the "Accept Invitation" button above</li>
                        <li>Sign in with your Google account (use your UCSD email)</li>
                        <li>Complete your profile setup</li>
                        <li>Start participating in IEEE UCSD activities!</li>
                    </ol>
                </div>
                
                <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
                    <p>This invitation will expire in 7 days.</p>
                    <p>If you have any questions, please contact us at <a href="mailto:${replyToEmail}" style="color: #1e40af;">${replyToEmail}</a></p>
                    <p style="margin-top: 15px; font-size: 12px; color: #999;">
                        Invitation ID: ${inviteId}
                    </p>
                </div>
            </body>
            </html>
        `;

        // Send email
        const result = await resend.emails.send({
            from: fromEmail,
            to: [email],
            replyTo: replyToEmail,
            subject,
            html,
        });

        console.log('User invitation email sent successfully:', result);
        
        return new Response(
            JSON.stringify({ success: true, message: 'Invitation sent successfully' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
        );

    } catch (error) {
        console.error('Failed to send user invitation email:', error);
        return new Response(
            JSON.stringify({ error: 'Failed to send invitation' }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}; 