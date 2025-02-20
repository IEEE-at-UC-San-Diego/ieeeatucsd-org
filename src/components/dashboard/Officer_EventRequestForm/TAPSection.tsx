import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import InfoCard from './InfoCard';
import Tooltip from './Tooltip';
import { tooltips, infoNotes } from './tooltips';
import { Icon } from '@iconify/react';

interface TAPSectionProps {
    onDataChange?: (data: any) => void;
    onASFundingChange?: (enabled: boolean) => void;
    children?: React.ReactNode;
}

const TAPSection: React.FC<TAPSectionProps> = ({ onDataChange, onASFundingChange, children }) => {
    const [expectedAttendance, setExpectedAttendance] = useState<number>(0);
    const [roomBooking, setRoomBooking] = useState<string>('');
    const [needsASFunding, setNeedsASFunding] = useState<boolean>(false);
    const [needsFoodDrinks, setNeedsFoodDrinks] = useState<boolean>(false);

    const handleAttendanceChange = (value: number) => {
        setExpectedAttendance(value);
        if (value > 100) {
            toast('Large attendance detected! Please ensure proper room capacity.', {
                icon: '⚠️',
                duration: 4000
            });
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
            onDataChange?.({ needs_food_drinks: false });
        }
        onASFundingChange?.(enabled);
        onDataChange?.({ as_funding_required: enabled });

        toast(enabled ? 'AS Funding enabled - please fill out funding details.' : 'AS Funding disabled', {
            icon: enabled ? '💰' : '❌',
            duration: 3000
        });
    };

    const handleFoodDrinksChange = (enabled: boolean) => {
        setNeedsFoodDrinks(enabled);
        onDataChange?.({ needs_food_drinks: enabled });
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

                            <div className="relative group">
                                <input
                                    type="number"
                                    min="0"
                                    className="input input-bordered w-full pl-12 transition-all duration-300 focus:ring-2 focus:ring-primary/20"
                                    value={expectedAttendance || ''}
                                    onChange={(e) => handleAttendanceChange(Number(e.target.value))}
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
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};

export default TAPSection; 