import { EmailService, type StatusChangeEmailData, type CommentEmailData, type ReimbursementEmailData } from './EmailService';
import { Get } from '../pocketbase/Get';
import type { User, Reimbursement, Receipt } from '../../schemas/pocketbase';

export class ReimbursementEmailNotifications {
  private emailService: EmailService;
  private get: Get;

  constructor() {
    this.emailService = EmailService.getInstance();
    this.get = Get.getInstance();
  }

  private static instance: ReimbursementEmailNotifications | null = null;

  public static getInstance(): ReimbursementEmailNotifications {
    if (!ReimbursementEmailNotifications.instance) {
      ReimbursementEmailNotifications.instance = new ReimbursementEmailNotifications();
    }
    return ReimbursementEmailNotifications.instance;
  }

  /**
   * Send notification when reimbursement status changes
   */
  async notifyStatusChange(
    reimbursementId: string,
    previousStatus: string,
    newStatus: string,
    changedByUserId?: string,
    comment?: string
  ): Promise<boolean> {
    try {
      // Get reimbursement details
      const reimbursement = await this.get.getOne<Reimbursement>('reimbursement', reimbursementId);
      if (!reimbursement) {
        console.error('Reimbursement not found:', reimbursementId);
        return false;
      }

      // Get submitter user details
      const user = await this.get.getOne<User>('users', reimbursement.submitted_by);
      if (!user || !user.email) {
        console.error('User not found or no email:', reimbursement.submitted_by);
        return false;
      }

      // Get changed by user name if provided
      let changedByName = 'System';
      if (changedByUserId) {
        try {
          const changedByUser = await this.get.getOne<User>('users', changedByUserId);
          changedByName = changedByUser?.name || 'Unknown User';
        } catch (error) {
          console.warn('Could not get changed by user name:', error);
        }
      }

      const emailData: StatusChangeEmailData = {
        user,
        reimbursement,
        previousStatus,
        newStatus,
        changedBy: changedByName,
        comment
      };

      return await this.emailService.sendStatusChangeEmail(emailData);
    } catch (error) {
      console.error('Failed to send status change notification:', error);
      return false;
    }
  }

  /**
   * Send notification when a comment is added to a reimbursement
   */
  async notifyComment(
    reimbursementId: string,
    comment: string,
    commentByUserId: string,
    isPrivate: boolean = false
  ): Promise<boolean> {
    try {
      // Don't send emails for private comments (for now)
      if (isPrivate) {
        return true;
      }

      // Get reimbursement details
      const reimbursement = await this.get.getOne<Reimbursement>('reimbursement', reimbursementId);
      if (!reimbursement) {
        console.error('Reimbursement not found:', reimbursementId);
        return false;
      }

      // Get submitter user details
      const user = await this.get.getOne<User>('users', reimbursement.submitted_by);
      if (!user || !user.email) {
        console.error('User not found or no email:', reimbursement.submitted_by);
        return false;
      }

      // Don't send email if the commenter is the same as the submitter
      if (commentByUserId === reimbursement.submitted_by) {
        return true;
      }

      // Get commenter user name
      let commentByName = 'Unknown User';
      try {
        const commentByUser = await this.get.getOne<User>('users', commentByUserId);
        commentByName = commentByUser?.name || 'Unknown User';
      } catch (error) {
        console.warn('Could not get commenter user name:', error);
      }

      const emailData: CommentEmailData = {
        user,
        reimbursement,
        comment,
        commentBy: commentByName,
        isPrivate
      };

      return await this.emailService.sendCommentEmail(emailData);
    } catch (error) {
      console.error('Failed to send comment notification:', error);
      return false;
    }
  }

  /**
   * Send submission confirmation email
   */
  async notifySubmission(reimbursementId: string): Promise<boolean> {
    try {
      // Get reimbursement details
      const reimbursement = await this.get.getOne<Reimbursement>('reimbursement', reimbursementId);
      if (!reimbursement) {
        console.error('Reimbursement not found:', reimbursementId);
        return false;
      }

      // Get submitter user details
      const user = await this.get.getOne<User>('users', reimbursement.submitted_by);
      if (!user || !user.email) {
        console.error('User not found or no email:', reimbursement.submitted_by);
        return false;
      }

      // Get receipt details if needed
      let receipts: Receipt[] = [];
      if (reimbursement.receipts && reimbursement.receipts.length > 0) {
        try {
          receipts = await Promise.all(
            reimbursement.receipts.map(id => this.get.getOne<Receipt>('receipts', id))
          );
        } catch (error) {
          console.warn('Could not load receipt details:', error);
        }
      }

      const emailData: ReimbursementEmailData = {
        user,
        reimbursement,
        receipts
      };

      return await this.emailService.sendSubmissionConfirmation(emailData);
    } catch (error) {
      console.error('Failed to send submission confirmation:', error);
      return false;
    }
  }

  /**
   * Send specific status-based notifications with custom logic
   */
  async notifyByStatus(
    reimbursementId: string,
    status: string,
    previousStatus?: string,
    triggeredByUserId?: string,
    additionalContext?: Record<string, any>
  ): Promise<boolean> {
    try {
      switch (status) {
        case 'submitted':
          return await this.notifySubmission(reimbursementId);
          
        case 'approved':
          return await this.notifyStatusChange(
            reimbursementId,
            previousStatus || 'under_review',
            status,
            triggeredByUserId,
            'Your reimbursement has been approved and will be processed for payment.'
          );
          
        case 'rejected':
          const rejectionReason = additionalContext?.rejectionReason;
          return await this.notifyStatusChange(
            reimbursementId,
            previousStatus || 'under_review',
            status,
            triggeredByUserId,
            rejectionReason ? `Rejection reason: ${rejectionReason}` : undefined
          );
          
        case 'paid':
          return await this.notifyStatusChange(
            reimbursementId,
            previousStatus || 'in_progress',
            status,
            triggeredByUserId,
            'Your reimbursement has been completed. Please check your account for the payment.'
          );
          
        case 'under_review':
        case 'in_progress':
          return await this.notifyStatusChange(
            reimbursementId,
            previousStatus || 'submitted',
            status,
            triggeredByUserId
          );
          
        default:
          console.log(`No specific notification handler for status: ${status}`);
          return true;
      }
    } catch (error) {
      console.error(`Failed to send notification for status ${status}:`, error);
      return false;
    }
  }

  /**
   * Batch notify multiple users (for administrative notifications)
   */
  async notifyAdmins(
    subject: string,
    message: string,
    reimbursementId?: string
  ): Promise<boolean> {
    try {
      // This could be enhanced to get admin user emails from the officers table
      // For now, we'll just log this functionality
      console.log('Admin notification requested:', { subject, message, reimbursementId });
      
      // TODO: Implement admin notification logic
      // - Get list of admin users from officers table
      // - Send email to all admins
      
      return true;
    } catch (error) {
      console.error('Failed to send admin notification:', error);
      return false;
    }
  }

  /**
   * Test email functionality (useful for development)
   */
  async testEmail(userEmail: string): Promise<boolean> {
    try {
      // Create a test user object
      const testUser: User = {
        id: 'test-user',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        email: userEmail,
        emailVisibility: true,
        verified: true,
        name: 'Test User'
      };

      // Create a test reimbursement object
      const testReimbursement: Reimbursement = {
        id: 'test-reimbursement',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        title: 'Test Reimbursement',
        total_amount: 99.99,
        date_of_purchase: new Date().toISOString(),
        payment_method: 'Personal Credit Card',
        status: 'submitted',
        submitted_by: 'test-user',
        additional_info: 'This is a test reimbursement for email functionality.',
        receipts: [],
        department: 'events'
      };

      const emailData: StatusChangeEmailData = {
        user: testUser,
        reimbursement: testReimbursement,
        previousStatus: 'submitted',
        newStatus: 'approved',
        changedBy: 'Test Admin',
        comment: 'This is a test email notification.'
      };

      return await this.emailService.sendStatusChangeEmail(emailData);
    } catch (error) {
      console.error('Failed to send test email:', error);
      return false;
    }
  }
} 