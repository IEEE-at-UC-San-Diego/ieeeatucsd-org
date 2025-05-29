import { Resend } from 'resend';
import type { User, Reimbursement, Receipt } from '../../schemas/pocketbase';

// Define email template types
export type EmailTemplateType = 
  | 'reimbursement_status_changed'
  | 'reimbursement_comment_added'
  | 'reimbursement_submitted'
  | 'reimbursement_approved'
  | 'reimbursement_rejected'
  | 'reimbursement_paid';

// Email template data interfaces
export interface StatusChangeEmailData {
  user: User;
  reimbursement: Reimbursement;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
  comment?: string;
}

export interface CommentEmailData {
  user: User;
  reimbursement: Reimbursement;
  comment: string;
  commentBy: string;
  isPrivate: boolean;
}

export interface ReimbursementEmailData {
  user: User;
  reimbursement: Reimbursement;
  receipts?: Receipt[];
  additionalData?: Record<string, any>;
}

export class EmailService {
  private resend: Resend;
  private fromEmail: string;
  private replyToEmail: string;

  constructor() {
    // Initialize Resend with API key from environment
    // Use import.meta.env as used throughout the Astro project
    const apiKey = import.meta.env.RESEND_API_KEY;
    
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    
    this.resend = new Resend(apiKey);
    this.fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@transactional.ieeeatucsd.org>';
    this.replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'ieee@ucsd.edu';
  }

  private static instance: EmailService | null = null;

  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  /**
   * Send reimbursement status change notification
   */
  async sendStatusChangeEmail(data: StatusChangeEmailData): Promise<boolean> {
    try {
      const { user, reimbursement, previousStatus, newStatus, changedBy, comment } = data;
      
      const subject = `Reimbursement Status Updated: ${reimbursement.title}`;
      const statusColor = this.getStatusColor(newStatus);
      const statusText = this.getStatusText(newStatus);
      
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
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                <span style="font-weight: bold; color: #666;">Status Change:</span>
                <span style="background: ${statusColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">${statusText}</span>
              </div>
              
              ${previousStatus !== newStatus ? `
                <div style="color: #666; font-size: 14px;">
                  Changed from: <span style="text-decoration: line-through;">${this.getStatusText(previousStatus)}</span> → <strong>${statusText}</strong>
                </div>
              ` : ''}
              
              ${changedBy ? `
                <div style="color: #666; font-size: 14px; margin-top: 10px;">
                  Updated by: ${changedBy}
                </div>
              ` : ''}
            </div>
            
            ${comment ? `
              <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
                <h4 style="margin: 0 0 10px 0; color: #2980b9;">Additional Note:</h4>
                <p style="margin: 0; font-style: italic;">${comment}</p>
              </div>
            ` : ''}
            
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
                ${this.getNextStepsText(newStatus)}
              </p>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            <p>This is an automated notification from IEEE UCSD Reimbursement System.</p>
            <p>If you have any questions, please contact us at <a href="mailto:${this.replyToEmail}" style="color: #667eea;">${this.replyToEmail}</a></p>
          </div>
        </body>
        </html>
      `;

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        replyTo: this.replyToEmail,
        subject,
        html,
      });

      console.log('Status change email sent successfully:', result);
      return true;
    } catch (error) {
      console.error('Failed to send status change email:', error);
      return false;
    }
  }

  /**
   * Send comment notification email
   */
  async sendCommentEmail(data: CommentEmailData): Promise<boolean> {
    try {
      const { user, reimbursement, comment, commentBy, isPrivate } = data;
      
      // Don't send email for private comments unless the user is the recipient
      if (isPrivate) {
        return true; // Silently skip private comments for now
      }
      
      const subject = `New Comment on Reimbursement: ${reimbursement.title}`;
      
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
                <span style="font-weight: bold; color: #2980b9;">Comment by:</span> ${commentBy}
              </div>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 6px;">
                <p style="margin: 0; font-style: italic;">${comment}</p>
              </div>
            </div>
            
            <div style="margin: 25px 0;">
              <h3 style="color: #2c3e50; margin-bottom: 15px;">Reimbursement Details</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Status:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">
                    <span style="background: ${this.getStatusColor(reimbursement.status)}; color: white; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500;">
                      ${this.getStatusText(reimbursement.status)}
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
            <p>If you have any questions, please contact us at <a href="mailto:${this.replyToEmail}" style="color: #667eea;">${this.replyToEmail}</a></p>
          </div>
        </body>
        </html>
      `;

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        replyTo: this.replyToEmail,
        subject,
        html,
      });

      console.log('Comment email sent successfully:', result);
      return true;
    } catch (error) {
      console.error('Failed to send comment email:', error);
      return false;
    }
  }

  /**
   * Send reimbursement submission confirmation
   */
  async sendSubmissionConfirmation(data: ReimbursementEmailData): Promise<boolean> {
    try {
      const { user, reimbursement } = data;
      
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
            <p>If you have any questions, please contact us at <a href="mailto:${this.replyToEmail}" style="color: #667eea;">${this.replyToEmail}</a></p>
          </div>
        </body>
        </html>
      `;

      const result = await this.resend.emails.send({
        from: this.fromEmail,
        to: [user.email],
        replyTo: this.replyToEmail,
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

  /**
   * Get status color for styling
   */
  private getStatusColor(status: string): string {
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

  /**
   * Get human-readable status text
   */
  private getStatusText(status: string): string {
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

  /**
   * Get next steps text based on status
   */
  private getNextStepsText(status: string): string {
    switch (status) {
      case 'submitted':
        return 'Your reimbursement is in the queue for review. We\'ll notify you once it\'s being processed.';
      case 'under_review':
        return 'Our team is currently reviewing your receipts and documentation. No action needed from you.';
      case 'approved':
        return 'Your reimbursement has been approved! Payment processing will begin shortly.';
      case 'rejected':
        return 'Your reimbursement has been rejected. Please review the comments and reach out if you have questions.';
      case 'in_progress':
        return 'Payment is being processed. You should receive your reimbursement within 1-2 business days.';
      case 'paid':
        return 'Your reimbursement has been completed! Please check your account for the payment.';
      default:
        return 'Check your dashboard for more details about your reimbursement status.';
    }
  }
} 