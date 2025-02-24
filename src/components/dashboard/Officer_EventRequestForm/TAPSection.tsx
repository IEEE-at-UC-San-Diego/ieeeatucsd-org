import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import InfoCard from './InfoCard';
import Tooltip from './Tooltip';
import { tooltips, infoNotes } from './tooltips';
import { Icon } from '@iconify/react';
import { FileManager } from '../../../scripts/pocketbase/FileManager';
import Toast from '../universal/Toast';
import type { ASFundingSectionProps, InvoiceItem } from './ASFundingSection';

interface TAPSectionProps {
    onDataChange?: (data: any) => void;
    onASFundingChange?: (enabled: boolean) => void;
    children?: React.ReactElement<ASFundingSectionProps>;
}

interface TAPData {
    expected_attendance: number;
    room_booking: string | File;
    as_funding_required: boolean;
    food_drinks_being_served: boolean;
    itemized_items?: InvoiceItem[];
}

const TAPSection: React.FC<TAPSectionProps> = ({ onDataChange, onASFundingChange, children }) => {
    const [expectedAttendance, setExpectedAttendance] = useState<number>(0);
    const [roomBooking, setRoomBooking] = useState<string>('');
    const [needsASFunding, setNeedsASFunding] = useState<boolean>(false);
    const [needsFoodDrinks, setNeedsFoodDrinks] = useState<boolean>(false);
    const [roomBookingFile, setRoomBookingFile] = useState<File | null>(null);
    const [itemizedItems, setItemizedItems] = useState<InvoiceItem[]>([]);
    const fileManager = FileManager.getInstance();

    const handleAttendanceChange = (value: number) => {
        setExpectedAttendance(value);
        if (value > 100) {
            toast.custom((t) => (
                <div className="alert alert-warning">
                    <Icon icon="mdi:warning" className="h-6 w-6" />
                    <span>Large attendance detected! Please ensure proper room capacity.</span>
                </div>
            ), { duration: 4000 });
        }
        onDataChange?.({ expected_attendance: value });
    };

    const handleRoomBookingChange = (value: string) => {
        setRoomBooking(value);
        onDataChange?.({ room_booking: value });
    };

    const handleASFundingChange = (enabled: boolean) => {
        setNeedsASFunding(enabled);
        if (!enabled) {
            setNeedsFoodDrinks(false);
            setItemizedItems([]);
            onDataChange?.({ food_drinks_being_served: false });
        }
        onASFundingChange?.(enabled);
        onDataChange?.({
            as_funding_required: enabled,
            itemized_items: enabled ? itemizedItems : undefined
        });

        toast.custom((t) => (
            <div className={`alert ${enabled ? 'alert-info' : 'alert-warning'}`}>
                <Icon icon={enabled ? 'mdi:cash' : 'mdi:cash-off'} className="h-6 w-6" />
                <span>{enabled ? 'AS Funding enabled - please fill out funding details.' : 'AS Funding disabled'}</span>
            </div>
        ), { duration: 3000 });
    };

    const handleFoodDrinksChange = (enabled: boolean) => {
        setNeedsFoodDrinks(enabled);
        onDataChange?.({ food_drinks_being_served: enabled });
    };

    const handleRoomBookingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setRoomBookingFile(file);
            onDataChange?.({ room_booking: file });
            toast.custom((t) => (
                <div className="alert alert-success">
                    <Icon icon="mdi:check-circle" className="h-6 w-6" />
                    <span>Room booking file uploaded successfully</span>
                </div>
            ));
        }
    };

    const uploadRoomBookingFile = async (recordId: string) => {
        if (roomBookingFile) {
            try {
                await fileManager.uploadFile(
                    'event_request',
                    recordId,
                    'room_booking',
                    roomBookingFile
                );
            } catch (error) {
                console.error('Failed to upload room booking file:', error);
                toast.custom((t) => (
                    <div className="alert alert-error">
                        <Icon icon="mdi:error" className="h-6 w-6" />
                        <span>Failed to upload room booking file</span>
                    </div>
                ), { duration: 4000 });
            }
        }
    };

    const handleItemizedItemsUpdate = (items: InvoiceItem[]) => {
        setItemizedItems(items);
        onDataChange?.({ itemized_items: items });
    };

    return (
        <>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="card bg-base-100/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300"
            >
                <div className="card-body">
                    <motion.h2
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 }}
                        className="card-title text-xl mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2"
                    >
                        <Icon icon="mdi:clipboard-text-outline" className="h-6 w-6" />
                        TAP Form
                    </motion.h2>

                    <div className="space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="form-control w-full"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">
                                    <span className="label-text font-medium text-lg flex items-center gap-2">
                                        <Icon icon="mdi:account-group" className="h-5 w-5 text-primary" />
                                        Expected Attendance
                                    </span>
                                </label>
                                <Tooltip
                                    title={tooltips.attendance.title}
                                    description={tooltips.attendance.description}
                                    position="left"
                                >
                                    <div className="badge badge-primary badge-outline p-3 cursor-help">
                                        <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                    </div>
                                </Tooltip>
                            </div>
                            <InfoCard
                                title={infoNotes.funding.title}
                                items={infoNotes.funding.items}
                                type="warning"
                                className="mb-4"
                            />

                            <div className="relative group">
                                <input
                                    type="number"
                                    min="0"
                                    name="expected_attendance"
                                    className="input input-bordered w-full pl-12 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                    value={expectedAttendance}
                                    onChange={(e) => handleAttendanceChange(parseInt(e.target.value) || 0)}
                                    required
                                />
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="form-control w-full"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">
                                    <span className="label-text font-medium text-lg flex items-center gap-2">
                                        <Icon icon="mdi:office-building-outline" className="h-5 w-5 text-primary" />
                                        Room Booking
                                    </span>
                                </label>
                                <Tooltip
                                    title={tooltips.room.title}
                                    description={tooltips.room.description}
                                    position="left"
                                >
                                    <div className="badge badge-primary badge-outline p-3 cursor-help">
                                        <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                    </div>
                                </Tooltip>
                            </div>

                            <InfoCard
                                title={infoNotes.room.title}
                                items={infoNotes.room.items}
                                type="info"
                                className="mb-4"
                            />

                            <div className="relative group">
                                <input
                                    type="text"
                                    placeholder="Enter room number and building (e.g. EBU1 2315)"
                                    className="input input-bordered w-full pl-12 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                    value={roomBooking}
                                    onChange={(e) => handleRoomBookingChange(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="form-control w-full mt-4">
                                <label className="label">
                                    <span className="label-text font-medium text-lg flex items-center gap-2">
                                        <Icon icon="mdi:upload" className="h-5 w-5 text-primary" />
                                        Room Booking File Upload
                                    </span>
                                </label>
                                <div className="flex flex-col space-y-2">
                                    <input
                                        type="file"
                                        name="room_booking"
                                        className="file-input file-input-bordered file-input-primary w-full"
                                        onChange={handleRoomBookingFileChange}
                                        accept=".pdf,.jpg,.jpeg,.png"
                                    />
                                    <div className="text-xs text-gray-500">
                                        Max file size: 50MB
                                    </div>
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 }}
                            className="form-control w-full"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <label className="label">
                                    <span className="label-text font-medium text-lg flex items-center gap-2">
                                        <Icon icon="mdi:cash" className="h-5 w-5 text-primary" />
                                        AS Funding
                                    </span>
                                </label>
                                <Tooltip
                                    title={tooltips.asFunding.title}
                                    description={tooltips.asFunding.description}
                                    position="left"
                                >
                                    <div className="badge badge-primary badge-outline p-3 cursor-help">
                                        <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                    </div>
                                </Tooltip>
                            </div>

                            <div className="flex flex-col gap-2">
                                <label className="label cursor-pointer justify-start gap-4 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                    <input
                                        type="radio"
                                        name="as_funding"
                                        className="radio radio-primary"
                                        checked={needsASFunding}
                                        onChange={() => handleASFundingChange(true)}
                                        value="true"
                                    />
                                    <span className="label-text">Yes, I need AS Funding</span>
                                </label>
                                <label className="label cursor-pointer justify-start gap-4 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                    <input
                                        type="radio"
                                        name="as_funding"
                                        className="radio radio-primary"
                                        checked={!needsASFunding}
                                        onChange={() => handleASFundingChange(false)}
                                        value="false"
                                    />
                                    <span className="label-text">No, I don't need AS Funding</span>
                                </label>
                            </div>
                        </motion.div>

                        <AnimatePresence mode="wait">
                            {needsASFunding && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className="form-control w-full overflow-hidden"
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="label">
                                            <span className="label-text font-medium text-lg flex items-center gap-2">
                                                <Icon icon="mdi:food" className="h-5 w-5 text-primary" />
                                                Food/Drinks
                                            </span>
                                        </label>
                                        <Tooltip
                                            title={tooltips.food.title}
                                            description={tooltips.food.description}
                                            position="left"
                                        >
                                            <div className="badge badge-primary badge-outline p-3 cursor-help">
                                                <Icon icon="mdi:information-outline" className="h-4 w-4" />
                                            </div>
                                        </Tooltip>
                                    </div>

                                    <div className="flex flex-col gap-2">
                                        <label className="label cursor-pointer justify-start gap-4 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                            <input
                                                type="radio"
                                                name="food_drinks"
                                                className="radio radio-primary"
                                                checked={needsFoodDrinks}
                                                onChange={() => handleFoodDrinksChange(true)}
                                                value="true"
                                            />
                                            <span className="label-text">Yes, I need food/drinks</span>
                                        </label>
                                        <label className="label cursor-pointer justify-start gap-4 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                            <input
                                                type="radio"
                                                name="food_drinks"
                                                className="radio radio-primary"
                                                checked={!needsFoodDrinks}
                                                onChange={() => handleFoodDrinksChange(false)}
                                                value="false"
                                            />
                                            <span className="label-text">No, I don't need food/drinks</span>
                                        </label>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </motion.div>

            <input
                type="hidden"
                name="itemized_items"
                value={JSON.stringify(itemizedItems)}
            />

            <input
                type="hidden"
                name="itemized_invoice"
                value={JSON.stringify({
                    items: itemizedItems,
                    tax: 0,
                    tip: 0,
                    total: itemizedItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0),
                    vendor: ''
                })}
            />

            <AnimatePresence mode="popLayout">
                {needsASFunding && (
                    <motion.div
                        initial={{ opacity: 0, height: 0, y: -20 }}
                        animate={{ opacity: 1, height: 'auto', y: 0 }}
                        exit={{ opacity: 0, height: 0, y: -20 }}
                        transition={{
                            duration: 0.3,
                            height: { duration: 0.4 },
                            opacity: { duration: 0.3 },
                            y: { duration: 0.3 }
                        }}
                        className="mt-8"
                    >
                        {children && React.cloneElement(children, {
                            onItemizedItemsUpdate: handleItemizedItemsUpdate
                        })}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default TAPSection; 