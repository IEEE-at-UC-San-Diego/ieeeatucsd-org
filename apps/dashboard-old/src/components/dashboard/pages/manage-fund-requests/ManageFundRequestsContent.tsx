import { useState, useEffect, useMemo } from 'react';
import {
    Table,
    TableHeader,
    TableColumn,
    TableBody,
    TableRow,
    TableCell,
    Chip,
    Tooltip,
    Button,
    Input,
    Tabs,
    Tab,
    User as UserAvatar,
    Pagination,
    Card,
    CardBody,
    Spinner,
    Dropdown,
    DropdownTrigger,
    DropdownMenu,
    DropdownItem,
} from '@heroui/react';
import {
    Search,
    Eye,
    CheckCircle,
    XCircle,
    AlertCircle,
    Clock,
    Filter,
    ArrowUpDown,
    Download,
    DollarSign,
    Briefcase,
    Settings,
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, getDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../../../firebase/client';
import { useAuthState } from 'react-firebase-hooks/auth';
import type { FundRequest, FundRequestStatus, BudgetConfig, FundRequestDepartment } from '../../shared/types/fund-requests';
import { STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, DEPARTMENT_LABELS } from '../../shared/types/fund-requests';
import FundRequestActionModal from './components/FundRequestActionModal';
import BudgetManagementModal from './components/BudgetManagementModal';

// Status icons helper
const getStatusIcon = (status: FundRequestStatus) => {
    switch (status) {
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
            return <Clock className="w-3.5 h-3.5" />;
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

type FilterTab = 'all' | 'pending' | 'needs_info' | 'processed';

export default function ManageFundRequestsContent() {
    const [user] = useAuthState(auth);
    const [requests, setRequests] = useState<FundRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState<FilterTab>('all');

    // Pagination
    const [page, setPage] = useState(1);
    const rowsPerPage = 10;

    // Modals
    const [selectedRequest, setSelectedRequest] = useState<FundRequest | null>(null);
    const [isActionModalOpen, setIsActionModalOpen] = useState(false);
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [budgetConfigs, setBudgetConfigs] = useState<Record<FundRequestDepartment, BudgetConfig | null>>({
        events: null,
        projects: null,
        internal: null,
        other: null,
    });

    // Initial role check
    useEffect(() => {
        const checkRole = async () => {
            if (!user) return;
            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    // Both Administrator and Executive Officer roles grant access and budget management
                    const hasAccess = userData.role === 'Administrator' || userData.role === 'Executive Officer';

                    // We use isAdmin to control the Configure Budgets button visibility, 
                    // so we update this to true if they have either key role.
                    setIsAdmin(hasAccess);

                    if (!hasAccess) {
                        setIsLoading(false);
                        // In a real app, maybe redirect or show error
                    }
                }
            } catch (error) {
                console.error('Error checking user role:', error);
            }
        };
        checkRole();
    }, [user]);

    // Fetch requests
    useEffect(() => {
        if (!user) return;

        // Query all requests except drafts
        const requestsRef = collection(db, 'fundRequests');
        const q = query(
            requestsRef,
            where('status', '!=', 'draft'),
            orderBy('status'), // Firestore requires orderBy field to be same as inequality filter first? No wait, != requires it. Actually for complex queries usually yes.
            // Let's rely on client side sorting for status != draft if needed, or simple query
            // Optimized query:
            // where('status', 'in', ['submitted', 'needs_info', 'approved', 'denied', 'completed']) - this is better 
            // but for simplicity and real-time updates:
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requestsData = snapshot.docs
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as FundRequest[];

            // Filter out drafts client-side just in case
            setRequests(requestsData.filter(r => r.status !== 'draft'));
            setIsLoading(false);
        });

        // Also fetch budget configs
        const fetchBudgetConfigs = () => {
            const departments: FundRequestDepartment[] = ['events', 'projects', 'internal', 'other'];
            const unsubscribes = departments.map(dept =>
                onSnapshot(doc(db, 'budgetConfig', dept), (docSnap) => {
                    setBudgetConfigs(prev => ({
                        ...prev,
                        [dept]: docSnap.exists() ? docSnap.data() as BudgetConfig : null
                    }));
                })
            );
            return () => unsubscribes.forEach(unsub => unsub());
        };

        const cleanupBudgets = fetchBudgetConfigs();

        return () => {
            unsubscribe();
            cleanupBudgets();
        };
    }, [user]);

    // Derived filtered requests
    const filteredRequests = useMemo(() => {
        let filtered = [...requests];

        if (selectedTab === 'pending') {
            filtered = filtered.filter(r => r.status === 'submitted');
        } else if (selectedTab === 'needs_info') {
            filtered = filtered.filter(r => r.status === 'needs_info');
        } else if (selectedTab === 'processed') {
            filtered = filtered.filter(r => ['approved', 'denied', 'completed'].includes(r.status));
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                r =>
                    r.title.toLowerCase().includes(query) ||
                    r.submittedByName?.toLowerCase().includes(query) ||
                    formatCurrency(r.amount).includes(query)
            );
        }

        return filtered;
    }, [requests, selectedTab, searchQuery]);

    // Pagination logic
    const pages = Math.ceil(filteredRequests.length / rowsPerPage);
    const items = useMemo(() => {
        const start = (page - 1) * rowsPerPage;
        const end = start + rowsPerPage;
        return filteredRequests.slice(start, end);
    }, [page, filteredRequests]);

    const handleActionClick = (request: FundRequest) => {
        setSelectedRequest(request);
        setIsActionModalOpen(true);
    };

    const getStats = () => {
        const pendingValue = requests
            .filter(r => r.status === 'submitted')
            .reduce((sum, r) => sum + r.amount, 0);

        const approvedValue = requests
            .filter(r => r.status === 'approved' || r.status === 'completed')
            .reduce((sum, r) => sum + r.amount, 0);

        return {
            pendingCount: requests.filter(r => r.status === 'submitted').length,
            needsInfoCount: requests.filter(r => r.status === 'needs_info').length,
            pendingValue,
            approvedValue
        };
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
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Manage Fund Requests</h1>
                    <p className="text-default-500 mt-1">
                        Review and manage funding requests from all departments.
                    </p>
                </div>
                {isAdmin && (
                    <Button
                        color="secondary"
                        variant="flat"
                        startContent={<Settings className="w-4 h-4" />}
                        onPress={() => setIsBudgetModalOpen(true)}
                        className="font-medium"
                    >
                        Configure Budgets
                    </Button>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Pending Review</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.pendingCount}</p>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Needs Information</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{stats.needsInfoCount}</p>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Pending Amount</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{formatCurrency(stats.pendingValue)}</p>
                    </CardBody>
                </Card>
                <Card className="border border-default-200 shadow-sm bg-default-50/50">
                    <CardBody className="p-4">
                        <p className="text-small text-default-500 font-medium">Total Approved</p>
                        <p className="text-2xl font-semibold text-foreground mt-1">{formatCurrency(stats.approvedValue)}</p>
                    </CardBody>
                </Card>
            </div>

            {/* Main Content: Tabs and Table */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-background/80 backdrop-blur-md sticky top-0 z-20 py-2">
                    <Tabs
                        selectedKey={selectedTab}
                        onSelectionChange={(key) => {
                            setSelectedTab(key as FilterTab);
                            setPage(1);
                        }}
                        aria-label="Filter requests"
                        color="primary"
                        variant="underlined"
                        classNames={{
                            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                            cursor: "w-full bg-primary",
                            tab: "max-w-fit px-0 h-12",
                            tabContent: "group-data-[selected=true]:text-primary font-medium"
                        }}
                    >
                        <Tab key="all" title="All Requests" />
                        <Tab
                            key="pending"
                            title={
                                <div className="flex items-center gap-2">
                                    <span>Pending</span>
                                    {stats.pendingCount > 0 && <Chip size="sm" color="warning" variant="flat" className="h-5 text-[10px] m-0">{stats.pendingCount}</Chip>}
                                </div>
                            }
                        />
                        <Tab
                            key="needs_info"
                            title={
                                <div className="flex items-center gap-2">
                                    <span>Needs Info</span>
                                    {stats.needsInfoCount > 0 && <Chip size="sm" color="primary" variant="flat" className="h-5 text-[10px] m-0">{stats.needsInfoCount}</Chip>}
                                </div>
                            }
                        />
                        <Tab key="processed" title="Processed" />
                    </Tabs>

                    <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onValueChange={(val) => {
                            setSearchQuery(val);
                            setPage(1);
                        }}
                        startContent={<Search className="w-4 h-4 text-default-400" />}
                        className="w-full sm:max-w-xs"
                        size="sm"
                        variant="bordered"
                        radius="lg"
                    />
                </div>

                <div className="border border-default-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <Table
                        aria-label="Fund requests table"
                        removeWrapper
                        classNames={{
                            th: "bg-default-50 text-default-500 font-medium py-3",
                            td: "py-3 border-b border-default-100 last:border-0",
                        }}
                        bottomContent={
                            pages > 0 ? (
                                <div className="flex w-full justify-center px-4 py-4 border-t border-default-100">
                                    <Pagination
                                        isCompact
                                        showControls
                                        showShadow
                                        color="primary"
                                        page={page}
                                        total={pages}
                                        onChange={(getPage) => setPage(getPage)}
                                    />
                                </div>
                            ) : null
                        }
                    >
                        <TableHeader>
                            <TableColumn>REQUEST</TableColumn>
                            <TableColumn>SUBMITTED BY</TableColumn>
                            <TableColumn>DEPARTMENT</TableColumn>
                            <TableColumn>AMOUNT</TableColumn>
                            <TableColumn>STATUS</TableColumn>
                            <TableColumn align="end">ACTIONS</TableColumn>
                        </TableHeader>
                        <TableBody emptyContent={
                            <div className="py-12 text-center text-default-400">
                                <p>No requests found matching your filters.</p>
                            </div>
                        }>
                            {items.map((request) => (
                                <TableRow key={request.id} className="hover:bg-default-50/50 transition-colors cursor-pointer" onClick={() => handleActionClick(request)}>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-foreground">{request.title}</span>
                                            <span className="text-xs text-default-500 truncate max-w-[250px]">{request.purpose}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <UserAvatar
                                            name={request.submittedByName || 'Unknown'}
                                            description={formatDate(request.createdAt)}
                                            classNames={{
                                                name: "text-sm font-medium",
                                                description: "text-xs text-default-400"
                                            }}
                                            avatarProps={{
                                                size: "sm",
                                                className: "hidden"
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-1">
                                            <Chip size="sm" variant="flat" color="default" className="bg-default-100 text-default-600 border-none capitalize h-6">
                                                {DEPARTMENT_LABELS[request.department as FundRequestDepartment] || request.department}
                                            </Chip>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-semibold text-foreground">{formatCurrency(request.amount)}</span>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            size="sm"
                                            color={STATUS_COLORS[request.status]}
                                            variant="flat"
                                            className="border-none gap-1 pl-1 capitalize"
                                            startContent={getStatusIcon(request.status)}
                                        >
                                            {STATUS_LABELS[request.status]}
                                        </Chip>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            <Tooltip content="Review Request">
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="primary"
                                                    onPress={() => handleActionClick(request)}
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Button>
                                            </Tooltip>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>

            {/* Modals */}
            <FundRequestActionModal
                isOpen={isActionModalOpen}
                onClose={() => {
                    setIsActionModalOpen(false);
                    setSelectedRequest(null);
                }}
                request={selectedRequest}
            />

            <BudgetManagementModal
                isOpen={isBudgetModalOpen}
                onClose={() => setIsBudgetModalOpen(false)}
                budgetConfigs={budgetConfigs}
                onBudgetUpdate={() => { }} // Real-time updates handled by onSnapshot
                currentUserId={user?.uid || ''}
                currentUserName={user?.displayName || 'Admin'}
            />
        </div>
    );
}
