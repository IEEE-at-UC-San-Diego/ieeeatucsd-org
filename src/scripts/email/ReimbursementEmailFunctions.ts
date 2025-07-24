import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { app } from '../../firebase/client';

export async function sendReimbursementSubmissionEmail(resend: any, fromEmail: string, replyToEmail: string, data: any): Promise<boolean> {
  try {
    console.log('💰 Starting reimbursement submission email process...');

    const db = getFirestore(app);
    
    // Get reimbursement details
    const reimbursementDoc = await getDoc(doc(db, 'reimbursements', data.reimbursementId));
    if (!reimbursementDoc.exists()) {
      console.error('❌ Reimbursement not found:', data.reimbursementId);
      return false;
    }
    
    const reimbursement = { id: reimbursementDoc.id, ...reimbursementDoc.data() } as any;
    
    // Get user details
    const userDoc = await getDoc(doc(db, 'users', reimbursement.submittedBy));
    if (!userDoc.exists()) {
      console.error('❌ User not found:', reimbursement.submittedBy);
      return false;
    }
    
    const user = { id: userDoc.id, ...userDoc.data() } as any;

    const treasurerEmail = 'treasurer@ieeeatucsd.org';
    const treasurerSubject = `New Reimbursement Request Submitted: ${reimbursement.title}`;
    const userSubject = `Your Reimbursement Request Has Been Submitted: ${reimbursement.title}`;

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

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
      }).format(amount);
    };

    // Email to treasurer
    const treasurerHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${treasurerSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; }
          .expense-item { background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 15px; margin: 10px 0; }
          .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; border-bottom: 1px solid #eee; }
          .status-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: white; margin: 0; font-size: 24px;">💰 New Reimbursement Request</h1>
          </div>
          
          <div class="content">
            <h2 style="margin-top: 0; color: #2c3e50;">Reimbursement Submitted for Review</h2>
            <p>A new reimbursement request has been submitted and requires your review.</p>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057; border-bottom: 2px solid #28a745; padding-bottom: 10px;">${reimbursement.title}</h3>
              
              <table>
                <tr>
                  <td style="font-weight: bold; width: 120px;">Submitted By</td>
                  <td>${user.name} (${user.email})</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Department</td>
                  <td style="text-transform: capitalize;">${reimbursement.department}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Total Amount</td>
                  <td style="color: #28a745; font-weight: bold; font-size: 16px;">${formatCurrency(reimbursement.totalAmount)}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Purchase Date</td>
                  <td>${reimbursement.dateOfPurchase}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Payment Method</td>
                  <td>${reimbursement.paymentMethod}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Status</td>
                  <td><span class="status-badge">Submitted for Review</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #495057;">Organization Purpose</h4>
              <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${reimbursement.businessPurpose}</p>
            </div>

            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h4 style="margin-top: 0; color: #495057;">Itemized Expenses (${reimbursement.expenses?.length || 0} items)</h4>
              ${reimbursement.expenses?.map((expense: any, index: number) => `
                <div class="expense-item">
                  <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                    <strong>${expense.description}</strong>
                    <span style="color: #28a745; font-weight: bold;">${formatCurrency(expense.amount)}</span>
                  </div>
                  <div style="color: #6c757d; font-size: 14px;">
                    Category: ${expense.category}
                    ${expense.receipt ? ' • Receipt attached ✓' : ' • No receipt'}
                  </div>
                </div>
              `).join('') || '<p>No expenses listed</p>'}
            </div>

            ${reimbursement.additionalInfo ? `
              <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h4 style="margin-top: 0; color: #495057;">Additional Information</h4>
                <p style="margin: 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">${reimbursement.additionalInfo}</p>
              </div>
            ` : ''}
            
            <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #155724; font-size: 16px;">📋 Next Steps</h4>
              <ul style="margin: 0; padding-left: 20px; color: #155724; line-height: 1.7;">
                <li>Review the reimbursement request details</li>
                <li>Verify all receipts and documentation</li>
                <li>Contact the submitter if clarification is needed</li>
                <li>Update the request status in the dashboard</li>
              </ul>
            </div>
          </div>
          
          <div class="footer">
            <p>Reference ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${reimbursement.id}</code></p>
            <p>Access the dashboard at <a href="https://ieeeucsd.org/dashboard/manage-reimbursements" style="color: #28a745; text-decoration: none;">ieeeucsd.org/dashboard</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Reimbursement Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Email to user (confirmation)
    const userHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${userSubject}</title>
        <style>
          .container { max-width: 600px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px; margin-bottom: 30px; }
          .content { background: #f8f9fa; padding: 25px; border-radius: 10px; margin-bottom: 25px; }
          .footer { text-align: center; padding: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; }
          td { padding: 8px 0; border-bottom: 1px solid #eee; }
          .status-badge { background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 12px; font-size: 12px; font-weight: 500; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="color: white; margin: 0; font-size: 24px;">✅ Reimbursement Submitted</h1>
          </div>
          
          <div class="content">
            <h2 style="margin-top: 0; color: #2c3e50;">Thank you for your submission!</h2>
            <p>Hello ${user.name},</p>
            <p>Your reimbursement request "<strong>${reimbursement.title}</strong>" has been successfully submitted and is now under review by our treasurer team.</p>
            
            <div style="background: white; border: 1px solid #e9ecef; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h3 style="margin-top: 0; color: #495057; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Request Summary</h3>
              
              <table>
                <tr>
                  <td style="font-weight: bold; width: 120px;">Title</td>
                  <td>${reimbursement.title}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Department</td>
                  <td style="text-transform: capitalize;">${reimbursement.department}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Total Amount</td>
                  <td style="color: #28a745; font-weight: bold; font-size: 16px;">${formatCurrency(reimbursement.totalAmount)}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Expenses</td>
                  <td>${reimbursement.expenses?.length || 0} item${(reimbursement.expenses?.length || 0) !== 1 ? 's' : ''}</td>
                </tr>
                <tr>
                  <td style="font-weight: bold;">Status</td>
                  <td><span class="status-badge">Submitted for Review</span></td>
                </tr>
              </table>
            </div>
            
            <div style="background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 25px 0;">
              <h4 style="margin: 0 0 12px 0; color: #1d4ed8; font-size: 16px;">⏱️ What Happens Next?</h4>
              <ul style="margin: 0; padding-left: 20px; color: #1d4ed8; line-height: 1.7;">
                <li>Our treasurer team will review your request and receipts</li>
                <li>You'll receive email updates as the status changes</li>
                <li>We may contact you if we need additional information</li>
                <li>Typical review time is 5-7 business days</li>
                <li>Approved requests are processed for payment weekly</li>
              </ul>
            </div>

            <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; color: #856404;"><strong>💡 Tip:</strong> You can track your reimbursement status anytime by visiting your dashboard.</p>
            </div>
          </div>
          
          <div class="footer">
            <p>Reference ID: <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px;">${reimbursement.id}</code></p>
            <p>Questions? Contact us at <a href="mailto:treasurer@ieeeatucsd.org" style="color: #3b82f6; text-decoration: none;">treasurer@ieeeatucsd.org</a></p>
            <p>Track your request: <a href="https://ieeeucsd.org/dashboard/reimbursement" style="color: #3b82f6; text-decoration: none;">Dashboard</a></p>
            <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;">
            <p style="font-size: 12px; color: #94a3b8;">IEEE UCSD Reimbursement Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send to treasurer
    await resend.emails.send({
      from: fromEmail,
      to: [treasurerEmail],
      replyTo: user.email,
      subject: treasurerSubject,
      html: treasurerHtml,
    });

    // Send confirmation to user
    await resend.emails.send({
      from: fromEmail,
      to: [user.email],
      replyTo: replyToEmail,
      subject: userSubject,
      html: userHtml,
    });

    console.log('✅ Reimbursement submission emails sent successfully!');
    return true;
  } catch (error) {
    console.error('❌ Failed to send reimbursement submission emails:', error);
    return false;
  }
} 