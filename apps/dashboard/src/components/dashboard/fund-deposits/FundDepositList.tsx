import { useState, useMemo } from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    Search,
    Plus,
    Filter,
    ArrowUpDown,
    MoreHorizontal,
    Trash2,
    Eye,
    CheckCircle,
    Clock,
    TrendingUp,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

import type { FundDeposit, FundDepositStatus } from "./types";
import { STATUS_COLORS, STATUS_LABELS } from "./types";
import { cn } from "@/lib/utils";

interface FundDepositListProps {
    deposits: FundDeposit[] | undefined;
    isLoading: boolean;
    onNewDeposit: () => void;
    onViewDeposit: (deposit: FundDeposit) => void;
    onDeleteDeposit: (deposit: FundDeposit) => void;
    userRole: "Administrator" | "Member" | undefined;
    logtoId: string;
}

export function FundDepositList({
    deposits,
    isLoading,
    onNewDeposit,
    onViewDeposit,
    onDeleteDeposit,
    userRole,
    logtoId,
}: FundDepositListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState<FundDepositStatus | "all">("all");
    const [sortConfig, setSortConfig] = useState<{
        key: keyof FundDeposit | "amount";
        direction: "asc" | "desc";
    }>({ key: "submittedAt", direction: "desc" });

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Stats calculation
    const stats = useMemo(() => {
        if (!deposits) return { total: 0, verified: 0, pending: 0, pendingAmount: 0, totalAmount: 0 };
        return deposits.reduce(
            (acc, curr) => {
                acc.total++;
                if (curr.status === "verified") {
                    acc.verified++;
                    acc.totalAmount += curr.amount || 0;
                }
                if (curr.status === "pending") {
                    acc.pending++;
                    acc.pendingAmount += curr.amount || 0;
                }
                return acc;
            },
            { total: 0, verified: 0, pending: 0, pendingAmount: 0, totalAmount: 0 }
        );
    }, [deposits]);

    // Filtering and Sorting
    const filteredDeposits = useMemo(() => {
        if (!deposits) return [];
        let filtered = [...deposits];

        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(
                (d) =>
                    d.title.toLowerCase().includes(query) ||
                    d.amount.toString().includes(query) ||
                    d.depositedByName?.toLowerCase().includes(query) ||
                    d.referenceNumber?.toLowerCase().includes(query)
            );
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter((d) => d.status === statusFilter);
        }

        filtered.sort((a, b) => {
            const aValue = a[sortConfig.key];
            const bValue = b[sortConfig.key];

            if (aValue === undefined && bValue === undefined) return 0;
            if (aValue === undefined) return 1;
            if (bValue === undefined) return -1;

            if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
            if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [deposits, searchQuery, statusFilter, sortConfig]);

    const totalPages = Math.ceil(filteredDeposits.length / itemsPerPage);
    const paginatedDeposits = filteredDeposits.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    );

    const handleSort = (key: keyof FundDeposit | "amount") => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
        }));
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: "USD",
        }).format(amount);
    };

    const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
        <Card className="border-none shadow-sm bg-card">
            <CardContent className="p-4 flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <div className="flex items-baseline gap-2 mt-1">
                        <h3 className="text-2xl font-bold">{value}</h3>
                        {subValue && <span className="text-xs text-muted-foreground">{subValue}</span>}
                    </div>
                </div>
                <div className={cn("p-2 rounded-full bg-opacity-10", color.replace("text-", "bg-"))}>
                    <Icon className={cn("w-5 h-5", color)} />
                </div>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-6">
            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Pending Review"
                    value={stats.pending}
                    subValue={formatCurrency(stats.pendingAmount)}
                    icon={Clock}
                    color="text-yellow-600"
                />
                <StatCard
                    title="Verified Deposits"
                    value={stats.verified}
                    subValue={formatCurrency(stats.totalAmount)}
                    icon={CheckCircle}
                    color="text-emerald-600"
                />
                <StatCard
                    title="Total Requests"
                    value={stats.total}
                    icon={TrendingUp}
                    color="text-blue-600"
                />
                {/* Placeholder for maybe 'Rejected' or 'This Month' */}
                <Card className="border-dashed shadow-none bg-muted/30 flex items-center justify-center p-6">
                    <div className="text-center">
                        <Button variant="outline" size="sm" onClick={onNewDeposit} className="gap-2">
                            <Plus className="w-4 h-4" /> New Deposit
                        </Button>
                    </div>
                </Card>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-[300px]">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search deposits..."
                            className="pl-9"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                        <SelectTrigger className="w-[140px]">
                            <div className="flex items-center gap-2">
                                <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                                <SelectValue placeholder="Status" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Mobile: New Deposit button if stats card is hidden/stacked */}
                <div className="sm:hidden w-full">
                    <Button onClick={onNewDeposit} className="w-full">
                        <Plus className="w-4 h-4 mr-2" /> New Deposit
                    </Button>
                </div>
            </div>

            {/* Data Table */}
            <div className="rounded-md border bg-card overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/50">
                            <TableHead className="w-[300px] cursor-pointer" onClick={() => handleSort("title")}>
                                <div className="flex items-center gap-1">Deposit <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer" onClick={() => handleSort("submittedAt")}>
                                <div className="flex items-center gap-1">Date <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right cursor-pointer" onClick={() => handleSort("amount")}>
                                <div className="flex items-center justify-end gap-1">Amount <ArrowUpDown className="w-3 h-3" /></div>
                            </TableHead>
                            <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    Loading deposits...
                                </TableCell>
                            </TableRow>
                        ) : paginatedDeposits.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    No deposits found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedDeposits.map((deposit) => (
                                <TableRow
                                    key={deposit._id}
                                    className="group cursor-pointer hover:bg-muted/30"
                                    onClick={() => onViewDeposit(deposit)}
                                >
                                    <TableCell>
                                        <div className="font-medium">{deposit.title}</div>
                                        <div className="text-xs text-muted-foreground truncate max-w-[200px]">{deposit.purpose}</div>
                                    </TableCell>
                                    <TableCell className="text-sm">
                                        {deposit.depositDate ? new Date(deposit.depositDate).toLocaleDateString() : "-"}
                                    </TableCell>
                                    <TableCell className="text-sm capitalize">
                                        {deposit.depositMethod === "other" ? deposit.otherDepositMethod : deposit.depositMethod?.replace("_", " ")}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className={cn("text-xs font-normal", STATUS_COLORS[deposit.status])}>
                                            {STATUS_LABELS[deposit.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right font-medium">
                                        {formatCurrency(deposit.amount)}
                                    </TableCell>
                                    <TableCell>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                                <DropdownMenuItem onClick={() => onViewDeposit(deposit)}>
                                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                                </DropdownMenuItem>
                                                {(userRole === "Administrator" || (deposit.depositedBy === logtoId && deposit.status === "pending")) && (
                                                    <>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={(e) => { e.stopPropagation(); onDeleteDeposit(deposit); }}
                                                            className="text-destructive focus:text-destructive"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" /> Delete
                                                        </DropdownMenuItem>
                                                    </>
                                                )}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                {filteredDeposits.length > itemsPerPage && (
                    <div className="flex items-center justify-between p-4 border-t">
                        <div className="text-sm text-muted-foreground">
                            Page {currentPage} of {totalPages}
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
