import type { EventRequest, UserDirectory } from './types';

export const formatDateTime = (timestamp: any): string => {
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
        console.error('Error formatting date/time:', error);
        return 'Invalid date';
    }
};

export const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'Not specified';
    try {
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (error) {
        console.error('Error formatting date:', error);
        return 'Invalid date';
    }
};

export const getUserName = (users: UserDirectory, userId: string): string => {
    if (!userId) return 'Unknown User';
    return users[userId]?.name || userId;
};

export const getStatusColor = (status: string): "success" | "primary" | "warning" | "danger" | "default" => {
    switch (status?.toLowerCase()) {
        case 'approved':
        case 'completed':
            return 'success';
        case 'submitted':
            return 'primary';
        case 'pending':
        case 'needs_review':
            return 'warning';
        case 'declined':
        case 'rejected':
            return 'danger';
        default:
            return 'default';
    }
};

export const formatInvoiceData = (request: EventRequest, invoiceIndex?: number): string => {
    if (!request) {
        return 'No invoice data available';
    }

    try {
        if (request.invoices && request.invoices.length > 0) {
            if (invoiceIndex !== undefined && invoiceIndex >= 0 && invoiceIndex < request.invoices.length) {
                const invoice = request.invoices[invoiceIndex];
                const itemStrings = invoice.items.map((item) => {
                    return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
                });

                const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);

                let invoiceString = itemStrings.join(' | ');

                if (invoice.tax > 0) {
                    invoiceString += ` | Tax = ${invoice.tax.toFixed(2)}`;
                }

                if (invoice.tip > 0) {
                    invoiceString += ` | Tip = ${invoice.tip.toFixed(2)}`;
                }

                invoiceString += ` | Total = ${total.toFixed(2)} from ${invoice.vendor}`;

                return invoiceString;
            }

            const invoiceStrings = request.invoices.map((invoice, index) => {
                const itemStrings = invoice.items.map((item) => {
                    return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
                });

                const subtotal = invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
                const total = subtotal + (invoice.tax || 0) + (invoice.tip || 0);

                let invoiceString = `Invoice ${index + 1}: ${itemStrings.join(' | ')}`;

                if (invoice.tax > 0) {
                    invoiceString += ` | Tax = ${invoice.tax.toFixed(2)}`;
                }

                if (invoice.tip > 0) {
                    invoiceString += ` | Tip = ${invoice.tip.toFixed(2)}`;
                }

                invoiceString += ` | Total = ${total.toFixed(2)} from ${invoice.vendor}`;

                return invoiceString;
            });

            return invoiceStrings.join('\n\n');
        }

        if (!request.itemizedInvoice || request.itemizedInvoice.length === 0) {
            return 'No itemized invoice data available';
        }

        const items = request.itemizedInvoice;
        const itemStrings = items.map((item) => {
            return `${item.quantity} ${item.description} x${item.unitPrice.toFixed(2)} each`;
        });

        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
        const tax = request.invoiceTax || 0;
        const tip = request.invoiceTip || 0;
        const total = subtotal + tax + tip;
        const vendor = request.invoiceVendor || 'Unknown Location';

        let invoiceString = itemStrings.join(' | ');

        if (tax > 0) {
            invoiceString += ` | Tax = ${tax.toFixed(2)}`;
        }

        if (tip > 0) {
            invoiceString += ` | Tip = ${tip.toFixed(2)}`;
        }

        invoiceString += ` | Total = ${total.toFixed(2)} from ${vendor}`;

        return invoiceString;
    } catch (error) {
        console.error('Invoice formatting error:', error);
        return 'Error formatting invoice data';
    }
};

export const getFilenameFromUrl = (url: string, fallback: string): string => {
    try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const filename = pathname.split('/').pop();
        if (filename && filename.includes('_')) {
            return filename.substring(filename.indexOf('_') + 1);
        }
        return filename || fallback;
    } catch (error) {
        console.error('Error parsing filename from url:', error);
        return fallback;
    }
};
