import { useState, useEffect } from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Textarea,
    RadioGroup,
    Radio,
    Input,
    Select,
    SelectItem,
    Chip,
    Divider,
    Card,
    CardBody,
    ScrollShadow,
} from '@heroui/react';
import {
    CheckCircle,
    XCircle,
    AlertCircle,
    DollarSign,
    FileText,
    ExternalLink,
    Download,
    History,
    Megaphone,
    Briefcase,
    Tag,
    Calendar,
    Send
} from 'lucide-react';
import { doc, updateDoc, Timestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import type { FundRequest, FundRequestStatus, FundingSource } from '../../../shared/types/fund-requests';
import {
    STATUS_LABELS,
    STATUS_COLORS,
    CATEGORY_LABELS,
    DEPARTMENT_LABELS,
    FUNDING_SOURCE_LABELS,
    FUNDING_SOURCES
} from '../../../shared/types/fund-requests';
import { showToast } from '../../../shared/utils/toast';

interface FundRequestActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: FundRequest | null;
}

const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

export default function FundRequestActionModal({
    isOpen,
    onClose,
    request,
}: FundRequestActionModalProps) {
    const [user] = useAuthState(auth);
    const [action, setAction] = useState<'approve' | 'deny' | 'needs_info'>('approve');
    const [notes, setNotes] = useState('');
    const [fundingSource, setFundingSource] = useState<FundingSource>('department');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset form when modal opens or request changes
    useEffect(() => {
        if (isOpen) {
            setAction('approve');
            setNotes('');
            setFundingSource('department');
        }
    }, [isOpen, request]);

    const handleSubmit = async () => {
        if (!request || !user) return;

        if (action === 'approve' && !fundingSource) {
            showToast.error('Please select a funding source');
            return;
        }

        if ((action === 'deny' || action === 'needs_info') && !notes.trim()) {
            showToast.error('Please provide a reason/note');
            return;
        }

        setIsSubmitting(true);

        try {
            let newStatus: FundRequestStatus;
            switch (action) {
                case 'approve':
                    newStatus = 'approved';
                    break;
                case 'deny':
                    newStatus = 'denied';
                    break;
                case 'needs_info':
                    newStatus = 'needs_info';
                    break;
                default:
                    return;
            }

            const auditLog: Record<string, any> = {
                id: crypto.randomUUID(),
                action,
                performedBy: user.uid,
                performedByName: user.displayName || user.email || 'Admin',
                timestamp: Timestamp.now(),
                previousStatus: request.status,
                newStatus,
                notes: notes.trim(),
            };

            // Only include fundingSource if action is approve (Firestore doesn't accept undefined values)
            if (action === 'approve') {
                auditLog.fundingSource = fundingSource;
            }

            const updateData: any = {
                status: newStatus,
                auditLogs: [...(request.auditLogs || []), auditLog],
                updatedAt: Timestamp.now(),
            };

            if (action === 'approve') {
                updateData.selectedFundingSource = fundingSource;
                if (notes.trim()) updateData.reviewNotes = notes.trim();
                // Clear any previous rejection/info notes
                updateData.infoRequestNotes = '';
            } else if (action === 'needs_info') {
                updateData.infoRequestNotes = notes.trim();
            } else if (action === 'deny') {
                updateData.reviewNotes = notes.trim();
            }

            await updateDoc(doc(db, 'fundRequests', request.id), updateData);

            // Send email notification
            try {
                await fetch('/api/email/send-fund-request-notification', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'fund_request_status_change',
                        requestId: request.id,
                        status: newStatus,
                    }),
                });
            } catch (emailError) {
                console.error('Failed to send email:', emailError);
            }

            showToast.success(`Request ${action === 'needs_info' ? 'returned for info' : action + 'd'} successfully`);
            onClose();
        } catch (error) {
            console.error('Error processing request:', error);
            showToast.error('Failed to process request');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!request) return null;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="3xl"
            scrollBehavior="inside"
            isDismissable={!isSubmitting}
            hideCloseButton={isSubmitting}
            classNames={{
                base: "max-w-[95vw] md:max-w-4xl",
                body: "p-0 overflow-hidden",
                header: "border-b border-default-100 flex-shrink-0",
                footer: "border-t border-default-100 flex-shrink-0",
            }}
        >
            <ModalContent>
                <ModalHeader className="bg-default-50/50 p-6">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl font-bold">Review Fund Request</h2>
                        <div className="flex items-center gap-2 text-sm text-default-500">
                            <span>ID: {request.id.slice(0, 8)}...</span>
                            <span>•</span>
                            <span>Submitted on {formatDate(request.createdAt)}</span>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="flex flex-col md:flex-row p-0 min-h-0 max-h-[70vh] overflow-hidden">
                    {/* Left Column: Request Details (Scrollable) */}
                    <ScrollShadow className="flex-1 p-4 md:p-6 md:border-r border-default-100 space-y-6 overflow-y-auto min-w-0">

                        {/* User & Financials */}
                        <div className="flex items-center justify-between p-4 bg-default-50 rounded-lg border border-default-200">
                            <div>
                                <p className="text-xs font-semibold text-default-500 uppercase">Requested by</p>
                                <p className="font-medium text-foreground">{request.submittedByName || 'Unknown'}</p>
                                <p className="text-xs text-default-400">{request.submittedByEmail}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-semibold text-default-500 uppercase">Amount</p>
                                <p className="text-xl font-bold text-success-600">{formatCurrency(request.amount)}</p>
                            </div>
                        </div>

                        {/* Title & Purpose */}
                        <div>
                            <h3 className="text-lg font-bold mb-1">{request.title}</h3>
                            <div className="flex gap-2 mb-3">
                                <Chip size="sm" variant="flat" color="default">{DEPARTMENT_LABELS[request.department]}</Chip>
                                <Chip size="sm" variant="flat" color="primary">{CATEGORY_LABELS[request.category]}</Chip>
                            </div>
                            <div className="space-y-2">
                                <h4 className="text-xs font-bold text-default-500 uppercase flex items-center gap-1">
                                    <FileText className="w-3 h-3" /> Justification
                                </h4>
                                <p className="text-sm text-default-700 whitespace-pre-wrap leading-relaxed p-3 bg-white rounded border border-default-100">
                                    {request.purpose}
                                </p>
                            </div>
                        </div>

                        {/* Info Response (Context) */}
                        {request.infoResponseNotes && (
                            <div className="bg-warning-50/50 p-4 rounded-lg border border-warning-100">
                                <h4 className="text-xs font-bold text-warning-700 uppercase flex items-center gap-1 mb-2">
                                    <Megaphone className="w-3 h-3" /> Additional Context
                                </h4>
                                <p className="text-sm text-default-700 whitespace-pre-wrap">
                                    {request.infoResponseNotes}
                                </p>
                            </div>
                        )}

                        <Divider />

                        {/* Attachments & Links */}
                        <div className="space-y-4">
                            {request.vendorLinks && request.vendorLinks.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-default-500 uppercase mb-2">Purchase Links</h4>
                                    <ul className="space-y-1">
                                        {request.vendorLinks.map((link) => (
                                            <li key={link.id} className="text-sm flex items-center gap-2">
                                                <span className="text-default-500 text-xs bg-default-100 px-1.5 py-0.5 rounded">
                                                    x{link.quantity || 1}
                                                </span>
                                                <a href={link.url} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                                                    <ExternalLink className="w-3 h-3" />
                                                    {link.itemName || link.url}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            {request.attachments && request.attachments.length > 0 && (
                                <div>
                                    <h4 className="text-xs font-bold text-default-500 uppercase mb-2">Attachments</h4>
                                    <div className="grid grid-cols-1 gap-2">
                                        {request.attachments.map((file) => (
                                            <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 border border-default-200 rounded hover:bg-default-50 transition-colors">
                                                <div className="bg-primary-50 p-1.5 rounded text-primary">
                                                    <Download className="w-4 h-4" />
                                                </div>
                                                <div className="text-sm truncate flex-1">{file.name}</div>
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </ScrollShadow>

                    {/* Right Column: Decisions */}
                    <ScrollShadow className="w-full md:w-[320px] lg:w-[350px] flex-shrink-0 p-4 md:p-6 bg-default-50/30 flex flex-col gap-6 border-t md:border-t-0 border-default-100 overflow-y-auto">
                        <div>
                            <h3 className="font-semibold text-lg mb-4">Decision</h3>
                            <RadioGroup
                                value={action}
                                onValueChange={(val) => setAction(val as any)}
                                color={
                                    action === 'approve' ? 'success' :
                                        action === 'deny' ? 'danger' : 'warning'
                                }
                            >
                                <Radio
                                    value="approve"
                                    description="Authorize funding"
                                    classNames={{ label: "font-semibold" }}
                                >
                                    Approve Request
                                </Radio>
                                <Radio
                                    value="needs_info"
                                    description="Ask user for details"
                                    classNames={{ label: "font-semibold" }}
                                >
                                    Request More Info
                                </Radio>
                                <Radio
                                    value="deny"
                                    description="Reject this request"
                                    classNames={{ label: "font-semibold" }}
                                >
                                    Deny Request
                                </Radio>
                            </RadioGroup>
                        </div>

                        {action === 'approve' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <Select
                                    label="Funding Source"
                                    placeholder="Select source"
                                    selectedKeys={[fundingSource]}
                                    onSelectionChange={(keys) => setFundingSource(Array.from(keys)[0] as FundingSource)}
                                    variant="bordered"
                                    classNames={{
                                        trigger: "bg-white",
                                    }}
                                >
                                    {FUNDING_SOURCES.map((source) => (
                                        <SelectItem key={source}>
                                            {FUNDING_SOURCE_LABELS[source]}
                                        </SelectItem>
                                    ))}
                                </Select>
                                <Textarea
                                    label="Approval Notes (Optional)"
                                    placeholder="Any internal notes or instructions..."
                                    value={notes}
                                    onValueChange={setNotes}
                                    variant="bordered"
                                    classNames={{
                                        inputWrapper: "bg-white",
                                    }}
                                />
                            </div>
                        )}

                        {action === 'needs_info' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <Textarea
                                    label="Information Requested"
                                    placeholder="What information is missing? Be specific."
                                    value={notes}
                                    onValueChange={setNotes}
                                    minRows={4}
                                    isRequired
                                    variant="bordered"
                                    color="warning"
                                    classNames={{
                                        inputWrapper: "bg-white",
                                    }}
                                />
                            </div>
                        )}

                        {action === 'deny' && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <Textarea
                                    label="Rejection Reason"
                                    placeholder="Why is this request being denied?"
                                    value={notes}
                                    onValueChange={setNotes}
                                    minRows={4}
                                    isRequired
                                    variant="bordered"
                                    color="danger"
                                    classNames={{
                                        inputWrapper: "bg-white",
                                    }}
                                />
                            </div>
                        )}
                    </ScrollShadow>
                </ModalBody>

                <ModalFooter className="flex flex-col sm:flex-row justify-between items-center gap-3 p-4 bg-default-50/50">
                    <div className="text-xs text-default-400 italic text-center sm:text-left">
                        An email notification will be sent to the user.
                    </div>
                    <div className="flex gap-2">
                        <Button variant="light" onPress={onClose} isDisabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button
                            color={
                                action === 'approve' ? 'success' :
                                    action === 'deny' ? 'danger' : 'warning'
                            }
                            onPress={handleSubmit}
                            isLoading={isSubmitting}
                            startContent={!isSubmitting && <Send className="w-4 h-4" />}
                            className="font-medium shadow-sm"
                        >
                            {action === 'approve' ? 'Approve' :
                                action === 'deny' ? 'Deny' : 'Send Request'}
                        </Button>
                    </div>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
