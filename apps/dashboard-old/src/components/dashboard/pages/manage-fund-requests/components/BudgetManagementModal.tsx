import { useState, useEffect } from 'react';
import {
    Modal,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    Tabs,
    Tab,
    Divider,
    Textarea,
    Card,
    CardBody,
    Spinner,
    Chip,
} from '@heroui/react';
import { DollarSign, Calendar, Save, Plus, Trash2, Briefcase } from 'lucide-react';
import { doc, setDoc, collection, addDoc, getDocs, deleteDoc, Timestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../../../../firebase/client';
import type { FundRequestDepartment, BudgetConfig, BudgetAdjustment } from '../../../shared/types/fund-requests';
import { DEPARTMENT_LABELS } from '../../../shared/types/fund-requests';
import { showToast } from '../../../shared/utils/toast';

interface BudgetManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    budgetConfigs: Record<FundRequestDepartment, BudgetConfig | null>;
    onBudgetUpdate: () => void;
    currentUserId: string;
    currentUserName: string;
}

const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

const formatDateForInput = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
};

export default function BudgetManagementModal({
    isOpen,
    onClose,
    budgetConfigs,
    onBudgetUpdate,
    currentUserId,
    currentUserName,
}: BudgetManagementModalProps) {
    const [selectedDepartment, setSelectedDepartment] = useState<FundRequestDepartment>('events');
    const [budgetAmount, setBudgetAmount] = useState('');
    const [startDate, setStartDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // Manual adjustments
    const [adjustments, setAdjustments] = useState<BudgetAdjustment[]>([]);
    const [isLoadingAdjustments, setIsLoadingAdjustments] = useState(false);
    const [newAdjustmentAmount, setNewAdjustmentAmount] = useState('');
    const [newAdjustmentDescription, setNewAdjustmentDescription] = useState('');
    const [isAddingAdjustment, setIsAddingAdjustment] = useState(false);

    // Load current config when department changes
    useEffect(() => {
        const config = budgetConfigs[selectedDepartment];
        if (config) {
            setBudgetAmount(config.totalBudget.toString());
            const date = config.startDate?.toDate ? config.startDate.toDate() : null;
            setStartDate(formatDateForInput(date));
        } else {
            setBudgetAmount('');
            setStartDate('');
        }
    }, [selectedDepartment, budgetConfigs]);

    // Load adjustments when department changes
    useEffect(() => {
        if (!isOpen) return;

        const loadAdjustments = async () => {
            setIsLoadingAdjustments(true);
            try {
                const adjustmentsRef = collection(db, 'budgetConfig', selectedDepartment, 'adjustments');
                const q = query(adjustmentsRef, orderBy('createdAt', 'desc'));
                const snapshot = await getDocs(q);
                const adjustmentsData = snapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                })) as BudgetAdjustment[];
                setAdjustments(adjustmentsData);
            } catch (error) {
                console.error('Error loading adjustments:', error);
            } finally {
                setIsLoadingAdjustments(false);
            }
        };

        loadAdjustments();
    }, [selectedDepartment, isOpen]);

    const handleSaveBudget = async () => {
        if (!budgetAmount || parseFloat(budgetAmount) <= 0) {
            showToast.error('Please enter a valid budget amount');
            return;
        }

        if (!startDate) {
            showToast.error('Please select a start date');
            return;
        }

        setIsSaving(true);
        try {
            const budgetConfig: BudgetConfig = {
                department: selectedDepartment,
                totalBudget: parseFloat(budgetAmount),
                startDate: Timestamp.fromDate(new Date(startDate)),
                updatedAt: Timestamp.now(),
                updatedBy: currentUserId,
                updatedByName: currentUserName,
            };

            await setDoc(doc(db, 'budgetConfig', selectedDepartment), budgetConfig);
            showToast.success(`${DEPARTMENT_LABELS[selectedDepartment]} budget updated successfully`);
            onBudgetUpdate();
        } catch (error) {
            console.error('Error saving budget:', error);
            showToast.error('Failed to save budget configuration');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddAdjustment = async () => {
        if (!newAdjustmentAmount || parseFloat(newAdjustmentAmount) <= 0) {
            showToast.error('Please enter a valid adjustment amount');
            return;
        }

        if (!newAdjustmentDescription.trim()) {
            showToast.error('Please enter a description for the adjustment');
            return;
        }

        setIsAddingAdjustment(true);
        try {
            const adjustmentData = {
                department: selectedDepartment,
                amount: parseFloat(newAdjustmentAmount),
                description: newAdjustmentDescription.trim(),
                createdAt: Timestamp.now(),
                createdBy: currentUserId,
                createdByName: currentUserName,
            };

            const adjustmentsRef = collection(db, 'budgetConfig', selectedDepartment, 'adjustments');
            await addDoc(adjustmentsRef, adjustmentData);

            // Refresh adjustments
            const q = query(adjustmentsRef, orderBy('createdAt', 'desc'));
            const snapshot = await getDocs(q);
            const adjustmentsData = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            })) as BudgetAdjustment[];
            setAdjustments(adjustmentsData);

            // Clear form
            setNewAdjustmentAmount('');
            setNewAdjustmentDescription('');

            showToast.success('Budget adjustment added');
            onBudgetUpdate();
        } catch (error) {
            console.error('Error adding adjustment:', error);
            showToast.error('Failed to add budget adjustment');
        } finally {
            setIsAddingAdjustment(false);
        }
    };

    const handleDeleteAdjustment = async (adjustmentId: string) => {
        try {
            await deleteDoc(doc(db, 'budgetConfig', selectedDepartment, 'adjustments', adjustmentId));
            setAdjustments((prev) => prev.filter((a) => a.id !== adjustmentId));
            showToast.success('Adjustment deleted');
            onBudgetUpdate();
        } catch (error) {
            console.error('Error deleting adjustment:', error);
            showToast.error('Failed to delete adjustment');
        }
    };

    const totalAdjustments = adjustments.reduce((sum, a) => sum + a.amount, 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
            <ModalContent>
                <ModalHeader className="bg-default-50/50 p-6 border-b border-default-100 block">
                    <h2 className="text-xl font-bold">Budget Management</h2>
                    <p className="text-sm text-default-500 font-normal">Configure department budgets and add manual adjustments.</p>
                </ModalHeader>

                <ModalBody className="p-6">
                    {/* Department Tabs */}
                    <Tabs
                        selectedKey={selectedDepartment}
                        onSelectionChange={(key) => setSelectedDepartment(key as FundRequestDepartment)}
                        color="primary"
                        variant="underlined"
                        classNames={{
                            tabList: "gap-6 w-full relative rounded-none p-0 border-b border-divider",
                            cursor: "w-full bg-primary",
                            tab: "max-w-fit px-0 h-12",
                            tabContent: "group-data-[selected=true]:text-primary font-medium"
                        }}
                    >
                        <Tab key="events" title="Events" />
                        <Tab key="projects" title="Projects" />
                        <Tab key="internal" title="Internal" />
                    </Tabs>

                    <div className="space-y-8 mt-4">
                        {/* Budget Configuration */}
                        <Card className="border border-default-200 shadow-sm">
                            <CardBody className="p-4 gap-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="p-2 rounded bg-primary-100 text-primary-600">
                                        <Briefcase className="w-5 h-5" />
                                    </div>
                                    <h3 className="font-semibold text-lg">Configuration</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="Total Budget"
                                        placeholder="5000.00"
                                        value={budgetAmount}
                                        onValueChange={(value) => {
                                            const sanitized = value.replace(/[^0-9.]/g, '');
                                            setBudgetAmount(sanitized);
                                        }}
                                        startContent={<DollarSign className="w-4 h-4 text-default-400" />}
                                        type="text"
                                        inputMode="decimal"
                                        variant="bordered"
                                    />
                                    <Input
                                        label="Budget Start Date"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        startContent={<Calendar className="w-4 h-4 text-default-400" />}
                                        variant="bordered"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <Button
                                        color="primary"
                                        onPress={handleSaveBudget}
                                        isLoading={isSaving}
                                        startContent={<Save className="w-4 h-4" />}
                                    >
                                        Save Configuration
                                    </Button>
                                </div>
                            </CardBody>
                        </Card>

                        {/* Manual Adjustments */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="p-2 rounded bg-warning-100 text-warning-600">
                                        <DollarSign className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-lg">Manual Adjustments</h3>
                                        <p className="text-sm text-default-500">
                                            External expenses counting against budget
                                        </p>
                                    </div>
                                </div>
                                {totalAdjustments > 0 && (
                                    <Chip color="warning" variant="flat" size="lg">
                                        Total: {formatCurrency(totalAdjustments)}
                                    </Chip>
                                )}
                            </div>

                            {/* Add new adjustment */}
                            <div className="flex gap-3 items-start bg-default-50 p-4 rounded-lg border border-default-100">
                                <Input
                                    label="Amount"
                                    placeholder="0.00"
                                    value={newAdjustmentAmount}
                                    onValueChange={(value) => {
                                        const sanitized = value.replace(/[^0-9.]/g, '');
                                        setNewAdjustmentAmount(sanitized);
                                    }}
                                    startContent={<DollarSign className="w-4 h-4 text-default-400" />}
                                    className="w-40"
                                    variant="bordered"
                                    size="sm"
                                />
                                <Input
                                    label="Description"
                                    placeholder="e.g. Catering for Fall GBM"
                                    value={newAdjustmentDescription}
                                    onValueChange={setNewAdjustmentDescription}
                                    className="flex-1"
                                    variant="bordered"
                                    size="sm"
                                />
                                <Button
                                    isIconOnly
                                    color="primary"
                                    onPress={handleAddAdjustment}
                                    isLoading={isAddingAdjustment}
                                    className="mt-1"
                                >
                                    <Plus className="w-5 h-5" />
                                </Button>
                            </div>

                            {/* Existing adjustments */}
                            {isLoadingAdjustments ? (
                                <div className="flex justify-center py-8">
                                    <Spinner color="primary" />
                                </div>
                            ) : adjustments.length > 0 ? (
                                <div className="space-y-2 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                                    {adjustments.map((adjustment) => (
                                        <div key={adjustment.id} className="flex items-center justify-between p-3 bg-white border border-default-200 rounded-lg hover:border-default-300 transition-colors">
                                            <div className="flex-1">
                                                <p className="font-medium text-sm">{adjustment.description}</p>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-default-400 bg-default-100 px-2 py-0.5 rounded">
                                                        {formatDateForInput(adjustment.createdAt?.toDate?.() || new Date())}
                                                    </span>
                                                    <span className="text-xs text-default-400">
                                                        by {adjustment.createdByName || 'Unknown'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="font-bold text-warning-600">
                                                    {formatCurrency(adjustment.amount)}
                                                </span>
                                                <Button
                                                    isIconOnly
                                                    size="sm"
                                                    variant="light"
                                                    color="danger"
                                                    onPress={() => handleDeleteAdjustment(adjustment.id)}
                                                    className="opacity-50 hover:opacity-100"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 border-2 border-dashed border-default-200 rounded-lg">
                                    <p className="text-default-400 text-sm">No manual adjustments recorded.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter className="border-t border-default-100 bg-default-50/50">
                    <Button variant="light" onPress={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
