import { useState, useEffect, useCallback } from 'react';
import {
    Search,
    Plus,
    DollarSign,
    Clock,
    CheckCircle,
    XCircle,
    AlertCircle,
    Eye,
    FileText,
    Edit,
    Trash2,
    RefreshCw,
    TrendingUp,
    Users,
} from 'lucide-react';
import {
    Card,
    CardBody,
    Button,
    Chip,
    Input,
    Tabs,
    Tab,
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Spinner,
    Tooltip,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
    Progress,
} from '@heroui/react';
import { collection, query, where, orderBy, onSnapshot, deleteDoc, doc, Timestamp, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import type { FundRequest, FundRequestStatus, FundRequestDepartment, BudgetConfig } from '../../shared/types/fund-requests';
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, DEPARTMENT_LABELS } from '../../shared/types/fund-requests';
import FundRequestFormModal from './components/FundRequestFormModal';
import FundRequestDetailModal from './components/FundRequestDetailModal';
import BudgetLogModal from './components/BudgetLogModal';
import { showToast } from '../../shared/utils/toast';

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
    });
};

type FilterTab = 'all' | FundRequestStatus;

export default function FundRequestsContent() {
    const [user] = useAuthState(auth);
    const [requests, setRequests] = useState<FundRequest[]>([]);
    const [filteredRequests, setFilteredRequests] = useState<FundRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState<FilterTab>('all');

    // Modals
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(null);
    const [isEditMode, setIsEditMode] = useState(false);

    // Delete confirmation
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [requestToDelete, setRequestToDelete] = useState<FundRequest | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Budget tracking
    const [budgetConfigs, setBudgetConfigs] = useState<Record<FundRequestDepartment, BudgetConfig | null>>({
        events: null,
        projects: null,
        internal: null,
        other: null,
    });
    const [allRequests, setAllRequests] = useState<FundRequest[]>([]);
    const [isBudgetLogOpen, setIsBudgetLogOpen] = useState(false);
    const [selectedBudgetDepartment, setSelectedBudgetDepartment] = useState<FundRequestDepartment>('events');
    // Manual adjustments totals per department
    const [adjustmentsTotals, setAdjustmentsTotals] = useState<Record<FundRequestDepartment, number>>({
        events: 0,
        projects: 0,
        internal: 0,
        other: 0,
    });

    // Fetch user's fund requests
    useEffect(() => {
        if (!user) {
            setIsLoading(false);
            return;
        }

        const requestsRef = collection(db, 'fundRequests');
        const q = query(
            requestsRef,
            where('submittedBy', '==', user.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const requestsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as FundRequest[];
                setRequests(requestsData);
                setIsLoading(false);
            },
            (error) => {
                console.error('Error fetching fund requests:', error);
                showToast.error('Failed to load fund requests');
                setIsLoading(false);
            }
        );

        return () => unsubscribe();
    }, [user]);

    // Fetch budget configurations and all requests for budget tracking
    useEffect(() => {
        const fetchBudgetData = async () => {
            try {
                // Fetch budget configurations
                const departments: FundRequestDepartment[] = ['events', 'projects', 'internal', 'other'];
                const configPromises = departments.map(async (dept) => {
                    const configDoc = await getDoc(doc(db, 'budgetConfig', dept));
                    if (configDoc.exists()) {
                        return { dept, config: configDoc.data() as BudgetConfig };
                    }
                    return { dept, config: null };
                });

                const configs = await Promise.all(configPromises);
                const configMap: Record<FundRequestDepartment, BudgetConfig | null> = {
                    events: null,
                    projects: null,
                    internal: null,
                    other: null,
                };
                configs.forEach(({ dept, config }) => {
                    configMap[dept] = config;
                });
                setBudgetConfigs(configMap);

                // Fetch manual adjustments for each department
                const adjustmentsMap: Record<FundRequestDepartment, number> = {
                    events: 0,
                    projects: 0,
                    internal: 0,
                    other: 0,
                };
                await Promise.all(
                    departments.map(async (dept) => {
                        const adjustmentsRef = collection(db, 'budgetConfig', dept, 'adjustments');
                        const adjustmentsSnapshot = await getDocs(adjustmentsRef);
                        let total = 0;
                        adjustmentsSnapshot.forEach((doc) => {
                            const data = doc.data();
                            total += data.amount || 0;
                        });
                        adjustmentsMap[dept] = total;
                    })
                );
                setAdjustmentsTotals(adjustmentsMap);
            } catch (error) {
                console.error('Error fetching budget configs:', error);
            }
        };

        fetchBudgetData();

        // Subscribe to all fund requests for budget calculations
        const requestsRef = collection(db, 'fundRequests');
        const q = query(requestsRef, orderBy('createdAt', 'desc'));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requestsData = snapshot.docs.map((docSnap) => ({
                id: docSnap.id,
                ...docSnap.data(),
            })) as FundRequest[];
            setAllRequests(requestsData.filter(r => r.status !== 'draft'));
        });

        return () => unsubscribe();
    }, []);

    // Filter requests based on tab and search
    useEffect(() => {
        let filtered = [...requests];

        // Filter by status tab
        if (selectedTab !== 'all') {
            filtered = filtered.filter((r) => r.status === selectedTab);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (r) =>
                    r.title.toLowerCase().includes(query) ||
                    r.purpose.toLowerCase().includes(query) ||
                    CATEGORY_LABELS[r.category].toLowerCase().includes(query)
            );
        }

        setFilteredRequests(filtered);
    }, [requests, selectedTab, searchQuery]);

    const handleNewRequest = () => {
        setSelectedRequest(null);
        setIsEditMode(false);
        setIsFormModalOpen(true);
    };

    const handleEditRequest = (request: FundRequest) => {
        setSelectedRequest(request);
        setIsEditMode(true);
        setIsFormModalOpen(true);
    };

    const handleViewRequest = (request: FundRequest) => {
        setSelectedRequest(request);
        setIsDetailModalOpen(true);
    };

    const handleDeleteClick = (request: FundRequest) => {
        setRequestToDelete(request);
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!requestToDelete) return;

        setIsDeleting(true);
        try {
            await deleteDoc(doc(db, 'fundRequests', requestToDelete.id));
            showToast.success('Fund request deleted successfully');
            setIsDeleteModalOpen(false);
            setRequestToDelete(null);
        } catch (error) {
            console.error('Error deleting fund request:', error);
            showToast.error('Failed to delete fund request');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleFormClose = () => {
        setIsFormModalOpen(false);
        setSelectedRequest(null);
        setIsEditMode(false);
    };

    const handleFormSuccess = () => {
        handleFormClose();
        showToast.success(
            isEditMode ? 'Fund request updated successfully' : 'Fund request created successfully'
        );
    };

    const getStats = () => {
        return {
            total: requests.length,
            draft: requests.filter((r) => r.status === 'draft').length,
            submitted: requests.filter((r) => r.status === 'submitted').length,
            needsInfo: requests.filter((r) => r.status === 'needs_info').length,
            approved: requests.filter((r) => r.status === 'approved').length,
            denied: requests.filter((r) => r.status === 'denied').length,
            totalAmount: requests
                .filter((r) => r.status === 'approved' || r.status === 'completed')
                .reduce((sum, r) => sum + r.amount, 0),
        };
    };

    // Calculate budget stats for a department
    const getBudgetStats = (department: FundRequestDepartment) => {
        const config = budgetConfigs[department];
        const totalBudget = config?.totalBudget || 0;
        const startDate = config?.startDate?.toDate ? config.startDate.toDate() : null;

        // Filter requests by department and start date
        let deptRequests = allRequests.filter((r) => r.department === department);
        if (startDate) {
            deptRequests = deptRequests.filter((r) => {
                const requestDate = r.createdAt?.toDate ? r.createdAt.toDate() : new Date(r.createdAt as any);
                return requestDate >= startDate;
            });
        }

        // Include manual adjustments in used budget
        const adjustmentsTotal = adjustmentsTotals[department] || 0;

        const requestsUsed = deptRequests
            .filter((r) => r.status === 'approved' || r.status === 'completed')
            .reduce((sum, r) => sum + r.amount, 0);

        const usedBudget = requestsUsed + adjustmentsTotal;

        const pendingBudget = deptRequests
            .filter((r) => r.status === 'submitted' || r.status === 'needs_info')
            .reduce((sum, r) => sum + r.amount, 0);

        const remainingBudget = totalBudget - usedBudget - pendingBudget;
        const percentUsed = totalBudget > 0 ? ((usedBudget + pendingBudget) / totalBudget) * 100 : 0;

        return {
            totalBudget,
            usedBudget,
            pendingBudget,
            remainingBudget,
            percentUsed,
            startDate,
            adjustmentsTotal,
        };
    };

    const handleBudgetCardClick = (department: FundRequestDepartment) => {
        setSelectedBudgetDepartment(department);
        setIsBudgetLogOpen(true);
    };

    const stats = getStats();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner size="lg" color="primary" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Fund Requests</h1>
                    <p className="text-default-500 mt-1 max-w-2xl">
                        Manage your funding requests for events, equipment, and travel. Track status and budget usage in real-time.
                    </p>
                </div>
                <Button
                    color="primary"
                    size="lg"
                    startContent={<Plus className="w-5 h-5" />}
                    onPress={handleNewRequest}
                    className="font-medium shadow-md shadow-primary/20"
                >
                    New Request
                </Button>
            </div>

            {/* Stats Cards */}
            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Total Requests</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.total}</p>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Pending Review</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.submitted + stats.needsInfo}</p>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Approved</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.approved}</p>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Total Awarded</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{formatCurrency(stats.totalAmount)}</p>
                    </CardBody>
                </Card>
            </div>

            {/* Budget Tracking Section */}
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Department Budgets</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    {(['events', 'projects', 'internal'] as FundRequestDepartment[]).map((dept) => {
                        const budgetStats = getBudgetStats(dept);
                        const hasConfig = budgetConfigs[dept] !== null;

                        return (
                            <Card
                                key={dept}
                                isPressable={hasConfig}
                                className={`
                                    border border-default-200 shadow-sm
                                    ${hasConfig ? 'hover:border-primary-300 hover:shadow-md cursor-pointer' : 'opacity-70 bg-default-50'}
                                    transition-all duration-200
                                `}
                                onPress={() => hasConfig && handleBudgetCardClick(dept)}
                            >
                                <CardBody className="p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2.5">
                                            <div className={`p-2 rounded-lg ${hasConfig ? 'bg-primary-50 text-primary-600' : 'bg-default-100 text-default-500'}`}>
                                                <Users className="w-4 h-4" />
                                            </div>
                                            <span className="font-semibold text-foreground">{DEPARTMENT_LABELS[dept]}</span>
                                        </div>
                                        {!hasConfig && (
                                            <Chip size="sm" variant="flat" color="default" className="text-default-500 text-xs h-6">Not Configured</Chip>
                                        )}
                                    </div>

                                    {hasConfig ? (
                                        <>
                                            <div className="flex items-end justify-between">
                                                <div>
                                                    <p className="text-3xl font-bold text-foreground">
                                                        {formatCurrency(budgetStats.remainingBudget)}
                                                    </p>
                                                    <p className="text-sm text-default-500 font-medium mt-1">
                                                        of {formatCurrency(budgetStats.totalBudget)} remaining
                                                    </p>
                                                </div>
                                                {budgetStats.pendingBudget > 0 && (
                                                    <div className="text-right bg-warning-50 px-2 py-1 rounded-md border border-warning-100">
                                                        <p className="text-sm font-semibold text-warning-700">
                                                            -{formatCurrency(budgetStats.pendingBudget)}
                                                        </p>
                                                        <p className="text-[10px] text-warning-600 uppercase tracking-wider font-medium">pending</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="space-y-1.5">
                                                <Progress
                                                    value={Math.min(budgetStats.percentUsed, 100)}
                                                    size="sm"
                                                    radius="sm"
                                                    classNames={{
                                                        indicator: budgetStats.percentUsed > 90 ? 'bg-danger-500' : budgetStats.percentUsed > 75 ? 'bg-warning-500' : 'bg-success-500',
                                                        track: 'bg-default-100',
                                                    }}
                                                    className="max-w-full"
                                                />
                                                <div className="flex justify-between text-xs text-default-400 font-medium">
                                                    <span>0%</span>
                                                    <span>50%</span>
                                                    <span>100%</span>
                                                </div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="py-4 text-center">
                                            <div className="w-full h-1.5 bg-default-100 rounded-full mb-2 opacity-50"></div>
                                            <p className="text-sm text-default-400">
                                                Budget has not been configured by admins yet.
                                            </p>
                                        </div>
                                    )}
                                </CardBody>
                            </Card>
                        );
                    })}
                </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between sticky top-0 z-20 bg-background/80 backdrop-blur-md py-2 -mx-2 px-2">
                <Tabs
                    selectedKey={selectedTab}
                    onSelectionChange={(key) => setSelectedTab(key as FilterTab)}
                    aria-label="Filter by status"
                    color="primary"
                    variant="underlined"
                    classNames={{
                        tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                        cursor: "w-full bg-primary",
                        tab: "max-w-fit px-0 h-12",
                        tabContent: "group-data-[selected=true]:text-primary font-medium"
                    }}
                >
                    <Tab key="all" title={
                        <div className="flex items-center gap-2">
                            <span>All Requests</span>
                            <Chip size="sm" variant="flat" className="text-default-500 bg-default-100">{stats.total}</Chip>
                        </div>
                    } />
                    <Tab key="submitted" title={
                        <div className="flex items-center gap-2">
                            <span>Submitted</span>
                            {stats.submitted > 0 && <Chip size="sm" variant="flat" color="warning" className="text-warning-700 bg-warning-100">{stats.submitted}</Chip>}
                        </div>
                    } />
                    <Tab key="approved" title={
                        <div className="flex items-center gap-2">
                            <span>Approved</span>
                            <Chip size="sm" variant="flat" color="success" className="text-success-700 bg-success-100">{stats.approved}</Chip>
                        </div>
                    } />
                </Tabs>
                <Input
                    placeholder="Search requests..."
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    startContent={<Search className="w-4 h-4 text-default-400" />}
                    className="w-full sm:max-w-xs"
                    radius="lg"
                    variant="bordered"
                />
            </div>

            {/* Request List */}
            {filteredRequests.length === 0 ? (
                <Card className="border-dashed border-2 border-default-200 bg-transparent shadow-none">
                    <CardBody className="py-12 text-center">
                        <div className="w-16 h-16 rounded-full bg-default-100 flex items-center justify-center mx-auto mb-4 text-default-400">
                            <FileText className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-semibold text-foreground mb-2">
                            {requests.length === 0 ? 'No fund requests yet' : 'No matching requests found'}
                        </h3>
                        <p className="text-default-500 max-w-sm mx-auto mb-6">
                            {requests.length === 0
                                ? 'Create your first fund request to get started with your project funding.'
                                : 'Try adjusting your filters or search query to find what you are looking for.'}
                        </p>
                        {requests.length === 0 && (
                            <Button
                                color="primary"
                                startContent={<Plus className="w-4 h-4" />}
                                onPress={handleNewRequest}
                            >
                                New Fund Request
                            </Button>
                        )}
                    </CardBody>
                </Card>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredRequests.map((request) => (
                        <Card
                            key={request.id}
                            isPressable
                            onPress={() => handleViewRequest(request)}
                            className="w-full border border-default-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all duration-200"
                        >
                            <CardBody className="p-4 sm:p-5">
                                <div className="flex flex-col md:flex-row gap-5 items-start md:items-center">

                                    {/* Status Indicator Bar (Mobile/Desktop) */}
                                    <div className={`
                                        hidden md:block w-1.5 self-stretch rounded-full
                                        ${request.status === 'approved' || request.status === 'completed' ? 'bg-success-500' :
                                            request.status === 'denied' ? 'bg-danger-500' :
                                                request.status === 'submitted' || request.status === 'needs_info' ? 'bg-warning-500' : 'bg-default-300'}
                                    `} />

                                    {/* Main Content */}
                                    <div className="flex-1 min-w-0 space-y-2 w-full">
                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                            <h3 className="text-lg font-semibold text-foreground truncate max-w-full">
                                                {request.title}
                                            </h3>
                                            <Chip
                                                size="sm"
                                                color={STATUS_COLORS[request.status]}
                                                variant="flat"
                                                className="border-none gap-1 pl-1"
                                                startContent={getStatusIcon(request.status)}
                                            >
                                                <span className="font-medium text-xs">{STATUS_LABELS[request.status]}</span>
                                            </Chip>
                                        </div>

                                        <p className="text-sm text-default-500 line-clamp-1">{request.purpose}</p>

                                        <div className="flex flex-wrap items-center gap-4 text-xs text-default-400 mt-2">
                                            <div className="flex items-center gap-1.5 bg-default-100 px-2 py-1 rounded-md">
                                                <DollarSign className="w-3.5 h-3.5 text-default-500" />
                                                <span className="font-semibold text-foreground">{formatCurrency(request.amount)}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <div className="w-1.5 h-1.5 rounded-full bg-default-300"></div>
                                                <span>{CATEGORY_LABELS[request.category]}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5" />
                                                <span>{formatDate(request.createdAt)}</span>
                                            </div>
                                        </div>

                                        {request.status === 'needs_info' && request.infoRequestNotes && (
                                            <div className="mt-3 p-3 bg-warning-50/50 rounded-lg border border-warning-100 flex items-start gap-2.5">
                                                <AlertCircle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <span className="text-xs font-semibold text-warning-700 block mb-0.5">Action Required</span>
                                                    <p className="text-xs text-warning-800 line-clamp-1">
                                                        {request.infoRequestNotes}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-2 self-end md:self-center flex-shrink-0 border-t md:border-t-0 border-default-100 pt-3 md:pt-0 w-full md:w-auto justify-end">
                                        {(request.status === 'draft' || request.status === 'needs_info') && (
                                            <Tooltip content="Edit Request">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="flat"
                                                    color="primary"
                                                    onPress={() => handleEditRequest(request)}
                                                    className="bg-primary-50 text-primary-600"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        )}
                                        {request.status === 'draft' && (
                                            <Tooltip content="Delete Request" color="danger">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="flat"
                                                    color="danger"
                                                    onPress={() => handleDeleteClick(request)}
                                                    className="bg-danger-50 text-danger-600"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        )}
                                        <Button
                                            size="sm"
                                            variant="light"
                                            onPress={() => handleViewRequest(request)}
                                            endContent={<Eye className="w-3.5 h-3.5" />}
                                            className="font-medium text-default-500"
                                        >
                                            Details
                                        </Button>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>
                    ))}
                </div>
            )}

            {/* Form Modal */}
            <FundRequestFormModal
                isOpen={isFormModalOpen}
                onClose={handleFormClose}
                onSuccess={handleFormSuccess}
                request={selectedRequest}
                isEditMode={isEditMode}
            />

            {/* Detail Modal */}
            <FundRequestDetailModal
                isOpen={isDetailModalOpen}
                onClose={() => {
                    setIsDetailModalOpen(false);
                    setSelectedRequest(null);
                }}
                request={selectedRequest}
                onEdit={() => {
                    setIsDetailModalOpen(false);
                    if (selectedRequest) {
                        handleEditRequest(selectedRequest);
                    }
                }}
            />

            {/* Delete Confirmation Modal */}
            <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} size="sm">
                <ModalContent>
                    <ModalHeader className="flex flex-col gap-1 items-center text-center">
                        <div className="p-3 bg-danger-100 rounded-full mb-2 text-danger-600">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <span>Delete Fund Request</span>
                    </ModalHeader>
                    <ModalBody className="text-center">
                        <p className="text-default-500">
                            Are you sure you want to delete <span className="font-semibold text-foreground">"{requestToDelete?.title}"</span>?
                            <br />This action cannot be undone.
                        </p>
                    </ModalBody>
                    <ModalFooter className="justify-center">
                        <Button variant="flat" onPress={() => setIsDeleteModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            color="danger"
                            onPress={handleConfirmDelete}
                            isLoading={isDeleting}
                        >
                            Delete Request
                        </Button>
                    </ModalFooter>
                </ModalContent>
            </Modal>

            {/* Budget Log Modal */}
            <BudgetLogModal
                isOpen={isBudgetLogOpen}
                onClose={() => setIsBudgetLogOpen(false)}
                department={selectedBudgetDepartment}
                budgetStartDate={budgetConfigs[selectedBudgetDepartment]?.startDate?.toDate?.() || undefined}
            />
        </div>
    );
}
