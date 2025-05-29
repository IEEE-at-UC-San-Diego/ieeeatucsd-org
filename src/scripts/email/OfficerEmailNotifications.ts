import { Resend } from 'resend';
import type { User, Officer } from '../../schemas/pocketbase/schema';
import { OfficerTypes } from '../../schemas/pocketbase';

// Email template data interfaces
export interface OfficerRoleChangeEmailData {
  user: User;
  officer: Officer;
  previousRole?: string;
  previousType?: string;
  newRole: string;
  newType: string;
  changedBy?: string;
  isNewOfficer?: boolean; // If this is a new officer appointment
}

export class OfficerEmailNotifications {
  private resend: Resend;
  private fromEmail: string;
  private replyToEmail: string;

  constructor() {
    // Initialize Resend with API key from environment
    const apiKey = import.meta.env.RESEND_API_KEY;
    
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is required');
    }
    
    this.resend = new Resend(apiKey);
    this.fromEmail = import.meta.env.FROM_EMAIL || 'IEEE UCSD <noreply@transactional.ieeeatucsd.org>';
    this.replyToEmail = import.meta.env.REPLY_TO_EMAIL || 'ieee@ucsd.edu';
  }

  private static instance: OfficerEmailNotifications | null = null;

  public static getInstance(): OfficerEmailNotifications {
    if (!OfficerEmailNotifications.instance) {
      OfficerEmailNotifications.instance = new OfficerEmailNotifications();
    }
    return OfficerEmailNotifications.instance;
  }

  /**
   * Send officer role change notification email
   */
  async sendRoleChangeNotification(data: OfficerRoleChangeEmailData): Promise<boolean> {
    try {
      const { user, officer, previousRole, previousType, newRole, newType, changedBy, isNewOfficer } = data;
      
      const subject = isNewOfficer 
        ? `Welcome to IEEE UCSD Leadership - ${newRole}`
        : `Your IEEE UCSD Officer Role has been Updated`;
      
      const typeColor = this.getOfficerTypeColor(newType);
      const typeText = this.getOfficerTypeDisplayName(newType);
      
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
            <h1 style="color: white; margin: 0; font-size: 24px;">IEEE UCSD Officer Update</h1>
          </div>
          
          <div style="background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px;">
            <h2 style="margin-top: 0; color: #2c3e50;">
              ${isNewOfficer ? 'Welcome to the Team!' : 'Role Update'}
            </h2>
            <p>Hello ${user.name},</p>
            
            ${isNewOfficer ? `
              <p>Congratulations! You have been appointed as an officer for IEEE UCSD. We're excited to have you join our leadership team!</p>
            ` : `
              <p>Your officer role has been updated in the IEEE UCSD system.</p>
            `}
            
            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid ${typeColor}; margin: 20px 0;">
              <div style="margin-bottom: 15px;">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50;">Your Current Role</h3>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                  <span style="font-weight: bold; font-size: 18px; color: #2c3e50;">${newRole}</span>
                  <span style="background: ${typeColor}; color: white; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">${typeText}</span>
                </div>
              </div>
              
              ${!isNewOfficer && (previousRole || previousType) ? `
                <div style="color: #666; font-size: 14px; padding: 10px 0; border-top: 1px solid #eee;">
                  <strong>Previous:</strong> ${previousRole || 'Unknown Role'} (${this.getOfficerTypeDisplayName(previousType || '')})
                </div>
              ` : ''}
              
              ${changedBy ? `
                <div style="color: #666; font-size: 14px; margin-top: 10px;">
                  ${isNewOfficer ? 'Appointed' : 'Updated'} by: ${changedBy}
                </div>
              ` : ''}
            </div>
            
            <div style="margin: 25px 0;">
              <h3 style="color: #2c3e50; margin-bottom: 15px;">Officer Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold; width: 30%;">Name:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${user.email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee; font-weight: bold;">Role:</td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #eee;">${newRole}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Officer Type:</td>
                  <td style="padding: 8px 0;">${typeText}</td>
                </tr>
              </table>
            </div>
            
            ${this.getOfficerTypeDescription(newType)}
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3498db;">
              <h4 style="margin: 0 0 10px 0; color: #2980b9;">Next Steps:</h4>
              <ul style="margin: 0; padding-left: 20px;">
                <li>Check your access to the officer dashboard</li>
                <li>Familiarize yourself with your new responsibilities</li>
                <li>Reach out to other officers if you have questions</li>
                ${isNewOfficer ? '<li>Attend the next officer meeting to get up to speed</li>' : ''}
              </ul>
            </div>
          </div>
          
          <div style="text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
            <p>This is an automated notification from IEEE UCSD Officer Management System.</p>
            <p>If you have any questions about your role, please contact us at <a href="mailto:${this.replyToEmail}" style="color: #667eea;">${this.replyToEmail}</a></p>
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

      console.log('Officer role change email sent successfully:', result);
      return true;
    } catch (error) {
      console.error('Failed to send officer role change email:', error);
      return false;
    }
  }

  /**
   * Get color for officer type badge
   */
  private getOfficerTypeColor(type: string): string {
    switch (type) {
      case OfficerTypes.ADMINISTRATOR:
        return '#dc3545'; // Red for admin
      case OfficerTypes.EXECUTIVE:
        return '#6f42c1'; // Purple for executive
      case OfficerTypes.GENERAL:
        return '#007bff'; // Blue for general
      case OfficerTypes.HONORARY:
        return '#fd7e14'; // Orange for honorary
      case OfficerTypes.PAST:
        return '#6c757d'; // Gray for past
      default:
        return '#28a745'; // Green as default
    }
  }

  /**
   * Get display name for officer type
   */
  private getOfficerTypeDisplayName(type: string): string {
    switch (type) {
      case OfficerTypes.ADMINISTRATOR:
        return 'Administrator';
      case OfficerTypes.EXECUTIVE:
        return 'Executive Officer';
      case OfficerTypes.GENERAL:
        return 'General Officer';
      case OfficerTypes.HONORARY:
        return 'Honorary Officer';
      case OfficerTypes.PAST:
        return 'Past Officer';
      default:
        return 'Officer';
    }
  }

  /**
   * Get description for officer type
   */
  private getOfficerTypeDescription(type: string): string {
    const baseStyle = "background: #fff3cd; padding: 15px; border-radius: 8px; border-left: 4px solid #ffc107; margin: 20px 0;";
    
    switch (type) {
      case OfficerTypes.ADMINISTRATOR:
        return `
          <div style="${baseStyle}">
            <p style="margin: 0; font-size: 14px;"><strong>Administrator Role:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              As an administrator, you have full access to manage officers, events, and system settings. You can add/remove other officers and access all administrative features.
            </p>
          </div>
        `;
      case OfficerTypes.EXECUTIVE:
        return `
          <div style="${baseStyle}">
            <p style="margin: 0; font-size: 14px;"><strong>Executive Officer Role:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              As an executive officer, you have leadership responsibilities and access to advanced features in the officer dashboard. You can manage events and participate in key decision-making.
            </p>
          </div>
        `;
      case OfficerTypes.GENERAL:
        return `
          <div style="${baseStyle}">
            <p style="margin: 0; font-size: 14px;"><strong>General Officer Role:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              As a general officer, you have access to the officer dashboard and can help with event management, member engagement, and other organizational activities.
            </p>
          </div>
        `;
      case OfficerTypes.HONORARY:
        return `
          <div style="${baseStyle}">
            <p style="margin: 0; font-size: 14px;"><strong>Honorary Officer Role:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              As an honorary officer, you are recognized for your contributions to IEEE UCSD. You have access to officer resources and are part of our leadership community.
            </p>
          </div>
        `;
      case OfficerTypes.PAST:
        return `
          <div style="${baseStyle}">
            <p style="margin: 0; font-size: 14px;"><strong>Past Officer Status:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              Thank you for your service to IEEE UCSD! As a past officer, you maintain access to alumni resources and remain part of our leadership community.
            </p>
          </div>
        `;
      default:
        return `
          <div style="${baseStyle}">
            <p style="margin: 0; font-size: 14px;"><strong>Officer Role:</strong></p>
            <p style="margin: 5px 0 0 0; font-size: 14px;">
              Welcome to the IEEE UCSD officer team! You now have access to officer resources and can contribute to our organization's activities.
            </p>
          </div>
        `;
    }
  }

  /**
   * Batch notify multiple officers (for bulk operations)
   */
  async notifyBulkRoleChanges(
    notifications: OfficerRoleChangeEmailData[]
  ): Promise<{ successful: number; failed: number }> {
    let successful = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        const result = await this.sendRoleChangeNotification(notification);
        if (result) {
          successful++;
        } else {
          failed++;
        }
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Failed to send bulk notification:', error);
        failed++;
      }
    }

    return { successful, failed };
  }
} 