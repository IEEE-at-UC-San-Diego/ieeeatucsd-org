import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Chip,
    Card,
    CardBody,
    Divider,
    Link,
    ScrollShadow,
} from '@heroui/react';
import {
    DollarSign,
    Calendar,
    User,
    FileText,
    ExternalLink,
    Edit,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Download,
    Eye,
    Briefcase,
    Tag,
    History,
} from 'lucide-react';
import type { FundRequest, FundRequestStatus } from '../../../shared/types/fund-requests';
import {
    STATUS_LABELS,
    STATUS_COLORS,
    CATEGORY_LABELS,
    DEPARTMENT_LABELS,
    FUNDING_SOURCE_LABELS,
} from '../../../shared/types/fund-requests';

interface FundRequestDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: FundRequest | null;
    onEdit?: () => void;
}

const getStatusIcon = (status: FundRequestStatus) => {
    switch (status) {
        case 'draft':
            return <FileText className="w-3.5 h-3.5" />;
        case 'submitted':
            return <Clock className="w-3.5 h-3.5" />;
        case 'needs_info':
            return <AlertCircle className="w-3.5 h-3.5" />;
        case 'approved':
            return <CheckCircle className="w-3.5 h-3.5" />;
        case 'denied':
            return <XCircle className="w-3.5 h-3.5" />;
        case 'completed':
            return <CheckCircle className="w-3.5 h-3.5" />;
        default:
            return <FileText className="w-3.5 h-3.5" />;
    }
};

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

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

export default function FundRequestDetailModal({
    isOpen,
    onClose,
    request,
    onEdit,
}: FundRequestDetailModalProps) {
    if (!request) return null;

    const canEdit = request.status === 'draft' || request.status === 'needs_info';

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            size="2xl"
            scrollBehavior="inside"
            classNames={{
                body: "p-0",
                header: "border-b border-default-100",
                footer: "border-t border-default-100",
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 p-6 bg-default-50/50">
                    <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0 pr-4">
                            <h2 className="text-xl font-bold truncate pr-2">{request.title}</h2>
                            <div className="flex items-center gap-2 mt-2">
                                <Chip
                                    size="sm"
                                    color={STATUS_COLORS[request.status]}
                                    variant="flat"
                                    className="border-none gap-1 pl-1"
                                    startContent={getStatusIcon(request.status)}
                                >
                                    <span className="font-medium">{STATUS_LABELS[request.status]}</span>
                                </Chip>
                                <span className="text-sm text-default-400">•</span>
                                <span className="text-sm text-default-500">
                                    {formatDate(request.createdAt)}
                                </span>
                            </div>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody>
                    <ScrollShadow className="p-6 space-y-6">
                        {/* Alerts for Needs Info / Denied / Approved */}
                        {request.status === 'needs_info' && request.infoRequestNotes && (
                            <Card className="border-warning-200 bg-warning-50 shadow-none">
                                <CardBody className="p-4 flex flex-row gap-3">
                                    <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-warning-800 text-sm mb-1">Information Requested</h4>
                                        <p className="text-sm text-warning-700 leading-relaxed">{request.infoRequestNotes}</p>
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {request.status === 'denied' && request.reviewNotes && (
                            <Card className="border-danger-200 bg-danger-50 shadow-none">
                                <CardBody className="p-4 flex flex-row gap-3">
                                    <XCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-danger-800 text-sm mb-1">Request Denied</h4>
                                        <p className="text-sm text-danger-700 leading-relaxed">{request.reviewNotes}</p>
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {request.status === 'approved' && (
                            <Card className="border-success-200 bg-success-50 shadow-none">
                                <CardBody className="p-4 flex flex-row gap-3">
                                    <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h4 className="font-semibold text-success-800 text-sm mb-1">Request Approved</h4>
                                        <div className="space-y-1">
                                            {request.selectedFundingSource && (
                                                <p className="text-sm text-success-700">
                                                    <span className="font-medium">Funding Source:</span> {FUNDING_SOURCE_LABELS[request.selectedFundingSource]}
                                                </p>
                                            )}
                                            {request.reviewNotes && (
                                                <p className="text-sm text-success-700 leading-relaxed">{request.reviewNotes}</p>
                                            )}
                                        </div>
                                    </div>
                                </CardBody>
                            </Card>
                        )}

                        {/* Purpose */}
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold text-default-500 uppercase tracking-wide flex items-center gap-2">
                                <FileText className="w-4 h-4" /> Purpose
                            </h3>
                            <p className="text-sm text-default-700 leading-relaxed whitespace-pre-wrap bg-default-50 p-4 rounded-lg border border-default-100">
                                {request.purpose}
                            </p>
                        </div>

                        {request.infoResponseNotes && (
                            <div className="space-y-2">
                                <h3 className="text-sm font-semibold text-warning-600 uppercase tracking-wide flex items-center gap-2">
                                    <Briefcase className="w-4 h-4" /> Additional Context
                                </h3>
                                <div className="bg-warning-50/30 p-4 rounded-lg border border-warning-100">
                                    <p className="text-xs font-semibold text-warning-700 mb-2">Response to Info Request:</p>
                                    <p className="text-sm text-default-700 leading-relaxed whitespace-pre-wrap">
                                        {request.infoResponseNotes}
                                    </p>
                                </div>
                            </div>
                        )}

                        <Divider />

                        {/* Details Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-3 rounded-lg border border-default-200 bg-default-50">
                                <span className="text-xs text-default-500 font-medium">Amount</span>
                                <div className="flex items-center gap-1 mt-1 text-success-600 font-bold text-lg">
                                    {formatCurrency(request.amount)}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg border border-default-200 bg-white">
                                <span className="text-xs text-default-500 font-medium">Department</span>
                                <div className="flex items-center gap-2 mt-1 font-medium text-default-700">
                                    <Briefcase className="w-3.5 h-3.5 text-default-400" />
                                    {request.department ? DEPARTMENT_LABELS[request.department] : 'N/A'}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg border border-default-200 bg-white">
                                <span className="text-xs text-default-500 font-medium">Category</span>
                                <div className="flex items-center gap-2 mt-1 font-medium text-default-700">
                                    <Tag className="w-3.5 h-3.5 text-default-400" />
                                    {CATEGORY_LABELS[request.category]}
                                </div>
                            </div>
                            <div className="p-3 rounded-lg border border-default-200 bg-white">
                                <span className="text-xs text-default-500 font-medium">Timeline</span>
                                <div className="flex items-center gap-2 mt-1 font-medium text-default-700">
                                    <Calendar className="w-3.5 h-3.5 text-default-400" />
                                    {formatDate(request.createdAt)}
                                </div>
                            </div>
                        </div>

                        {/* Vendor Links & Attachments Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Vendor Links */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-default-500 uppercase tracking-wide flex items-center gap-2">
                                    <ExternalLink className="w-4 h-4" /> Links
                                </h3>
                                {request.vendorLinks && request.vendorLinks.length > 0 ? (
                                    <div className="space-y-2">
                                        {request.vendorLinks.map((link) => (
                                            <Card key={link.id} isPressable as={Link} href={link.url} target="_blank" className="border border-default-200 shadow-sm hover:border-primary-400 bg-white w-full">
                                                <CardBody className="p-3 flex flex-row items-center justify-between gap-3">
                                                    <div className="flex items-center gap-2 min-w-0 flex-1">
                                                        <span className="text-xs font-medium bg-default-100 text-default-600 px-1.5 py-0.5 rounded flex-shrink-0">
                                                            x{link.quantity || 1}
                                                        </span>
                                                        <div className="min-w-0 flex-1">
                                                            <p className="text-sm font-medium truncate text-foreground">{link.itemName || link.label || 'Link'}</p>
                                                            {link.url && <p className="text-xs text-default-400 truncate">{link.url}</p>}
                                                        </div>
                                                    </div>
                                                    <ExternalLink className="w-3.5 h-3.5 text-default-400 flex-shrink-0" />
                                                </CardBody>
                                            </Card>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-default-400 italic">No links provided.</p>
                                )}
                            </div>

                            {/* Attachments */}
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-default-500 uppercase tracking-wide flex items-center gap-2">
                                    <Download className="w-4 h-4" /> Attachments
                                </h3>
                                {request.attachments && request.attachments.length > 0 ? (
                                    <div className="space-y-2">
                                        {request.attachments.map((attachment) => (
                                            <div key={attachment.id} className="group flex items-center justify-between p-2 rounded-lg border border-default-200 bg-white hover:border-primary-200 transition-colors">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="p-2 rounded bg-default-100 text-default-500">
                                                        <FileText className="w-4 h-4" />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-medium truncate max-w-[150px]">{attachment.name}</p>
                                                        <p className="text-xs text-default-400">{(attachment.size / 1024).toFixed(1)} KB</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        isIconOnly size="sm" variant="light" as="a"
                                                        href={attachment.url} target="_blank"
                                                    >
                                                        <Eye className="w-3.5 h-3.5" />
                                                    </Button>
                                                    <Button
                                                        isIconOnly size="sm" variant="light" as="a"
                                                        href={attachment.url} download={attachment.name}
                                                    >
                                                        <Download className="w-3.5 h-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-default-400 italic">No attachments.</p>
                                )}
                            </div>
                        </div>

                        {/* Audit Trail - Timeline */}
                        {request.auditLogs && request.auditLogs.length > 0 && (
                            <div className="pt-2">
                                <h3 className="text-sm font-semibold text-default-500 uppercase tracking-wide flex items-center gap-2 mb-4">
                                    <History className="w-4 h-4" /> Activity History
                                </h3>
                                <div className="space-y-0 pl-2">
                                    {request.auditLogs.map((log, index) => (
                                        <div key={log.id} className="relative pl-6 pb-6 last:pb-0 border-l border-default-200 last:border-l-0">
                                            {/* Timeline Dot */}
                                            <div className="absolute top-0 left-0 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white bg-default-200 shadow-sm z-10 box-content" />

                                            <div className="flex flex-col gap-1 -mt-1">
                                                <p className="text-sm font-medium text-foreground">
                                                    <span className="capitalize">{log.action.replace(/_/g, ' ')}</span>
                                                    {log.performedByName && (
                                                        <span className="text-default-500 font-normal"> by {log.performedByName}</span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-default-400">{formatDate(log.timestamp)}</p>
                                                {log.notes && (
                                                    <p className="text-sm text-default-600 bg-default-50 p-2 rounded border border-default-100 mt-1 inline-block">
                                                        {log.notes}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </ScrollShadow>
                </ModalBody>

                <ModalFooter className="p-4 bg-default-50/50">
                    <Button variant="light" onPress={onClose}>
                        Close
                    </Button>
                    {canEdit && onEdit && (
                        <Button
                            color="primary"
                            startContent={<Edit className="w-4 h-4" />}
                            onPress={onEdit}
                            className="font-medium shadow-sm"
                        >
                            {request.status === 'needs_info' ? 'Respond & Resubmit' : 'Edit Request'}
                        </Button>
                    )}
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
