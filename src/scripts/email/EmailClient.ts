/**
 * Client-side helper for sending email notifications via API routes
 * This runs in the browser and calls the server-side email API
 */

import { Authentication } from '../pocketbase/Authentication';

interface EmailNotificationRequest {
  type: 'status_change' | 'comment' | 'submission' | 'test';
  reimbursementId: string;
  previousStatus?: string;
  newStatus?: string;
  changedByUserId?: string;
  comment?: string;
  commentByUserId?: string;
  isPrivate?: boolean;
  additionalContext?: Record<string, any>;
  authData?: { token: string; model: any };
}

interface EmailNotificationResponse {
  success: boolean;
  message: string;
  error?: string;
  details?: string;
}

export class EmailClient {
  private static getAuthData(): { token: string; model: any } | null {
    try {
      const auth = Authentication.getInstance();
      const token = auth.getAuthToken();
      const model = auth.getCurrentUser();
      
      if (token && model) {
        return { token, model };
      }
      return null;
    } catch (error) {
      console.warn('Could not get auth data:', error);
      return null;
    }
  }

  private static async sendEmailNotification(request: EmailNotificationRequest): Promise<boolean> {
    try {
      const authData = this.getAuthData();
      const requestWithAuth = {
        ...request,
        authData
      };

      const response = await fetch('/api/email/send-reimbursement-notification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestWithAuth),
      });

      const result: EmailNotificationResponse = await response.json();
      
      if (!response.ok) {
        console.error('Email notification API error:', result.error || result.message);
        return false;
      }

      return result.success;
    } catch (error) {
      console.error('Failed to send email notification:', error);
      return false;
    }
  }

  /**
   * Send status change notification
   */
  static async notifyStatusChange(
    reimbursementId: string,
    newStatus: string,
    previousStatus?: string,
    changedByUserId?: string,
    additionalContext?: Record<string, any>
  ): Promise<boolean> {
    return this.sendEmailNotification({
      type: 'status_change',
      reimbursementId,
      newStatus,
      previousStatus,
      changedByUserId,
      additionalContext
    });
  }

  /**
   * Send comment notification
   */
  static async notifyComment(
    reimbursementId: string,
    comment: string,
    commentByUserId: string,
    isPrivate: boolean = false
  ): Promise<boolean> {
    return this.sendEmailNotification({
      type: 'comment',
      reimbursementId,
      comment,
      commentByUserId,
      isPrivate
    });
  }

  /**
   * Send submission confirmation
   */
  static async notifySubmission(reimbursementId: string): Promise<boolean> {
    return this.sendEmailNotification({
      type: 'submission',
      reimbursementId
    });
  }

  /**
   * Send rejection notification with reason
   */
  static async notifyRejection(
    reimbursementId: string,
    rejectionReason: string,
    previousStatus?: string,
    changedByUserId?: string
  ): Promise<boolean> {
    return this.sendEmailNotification({
      type: 'status_change',
      reimbursementId,
      newStatus: 'rejected',
      previousStatus,
      changedByUserId,
      additionalContext: { rejectionReason }
    });
  }

  /**
   * Send test email
   */
  static async sendTestEmail(email: string): Promise<boolean> {
    return this.sendEmailNotification({
      type: 'test',
      reimbursementId: 'test', // Required but not used for test emails
      additionalContext: { email }
    });
  }
} 