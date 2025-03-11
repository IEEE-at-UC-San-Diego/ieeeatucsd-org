import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';
import type { EventRequest } from '../../../schemas/pocketbase';
import CustomAlert from '../universal/CustomAlert';

// Enhanced animation variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1,
            when: "beforeChildren"
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            type: "spring",
            stiffness: 300,
            damping: 24
        }
    }
};

// Input field hover animation
const inputHoverVariants = {
    hover: {
        scale: 1.01,
        boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
        transition: { duration: 0.2 }
    }
};

// File upload animation
const fileUploadVariants = {
    initial: { scale: 1 },
    hover: {
        scale: 1.02,
        boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
        transition: { duration: 0.2 }
    },
    tap: { scale: 0.98 }
};

interface TAPFormSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const TAPFormSection: React.FC<TAPFormSectionProps> = ({ formData, onDataChange }) => {
    const [roomBookingFile, setRoomBookingFile] = useState<File | null>(formData.room_booking);
    const [isDragging, setIsDragging] = useState(false);

    // Handle room booking file upload
    const handleRoomBookingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setRoomBookingFile(file);
            onDataChange({ room_booking: file });
        }
    };

    // Handle drag events for file upload
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const file = e.dataTransfer.files[0];
            setRoomBookingFile(file);
            onDataChange({ room_booking: file });
        }
    };

    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.div variants={itemVariants}>
                <h2 className="text-3xl font-bold mb-4 text-primary bg-gradient-to-r from-primary to-primary-focus bg-clip-text text-transparent">
                    TAP Form Information
                </h2>
            </motion.div>

            <motion.div variants={itemVariants}>
                <CustomAlert
                    type="info"
                    title="Important Information"
                    message="Please ensure you have ALL sections completed. If something is not available, let the coordinators know and be advised on how to proceed."
                    className="mb-6"
                    icon="heroicons:information-circle"
                />
            </motion.div>

            {/* Expected attendance */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Expected Attendance</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="relative mt-2">
                    <motion.input
                        type="number"
                        className="input input-bordered focus:input-primary transition-all duration-300 w-full pr-20"
                        value={formData.expected_attendance || ''}
                        onChange={(e) => onDataChange({ expected_attendance: parseInt(e.target.value) || 0 })}
                        min="0"
                        placeholder="Enter expected attendance"
                        required
                        whileHover="hover"
                        variants={inputHoverVariants}
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400 bg-base-100 px-2 py-1 rounded">
                        people
                    </div>
                </div>

                <motion.div
                    className="mt-4 p-4 bg-base-300/30 rounded-lg text-xs text-gray-400"
                    initial={{ opacity: 0.8 }}
                    whileHover={{ opacity: 1, scale: 1.01 }}
                >
                    <ul className="space-y-2 list-disc list-inside">
                        <li>PROGRAMMING FUNDS EVENTS FUNDED BY PROGRAMMING FUNDS MAY ONLY ADMIT UC SAN DIEGO STUDENTS, STAFF OR FACULTY AS GUESTS.</li>
                        <li>ONLY UC SAN DIEGO UNDERGRADUATE STUDENTS MAY RECEIVE ITEMS FUNDED BY THE ASSOCIATED STUDENTS.</li>
                        <li>EVENT FUNDING IS GRANTED UP TO A MAXIMUM OF $10.00 PER EXPECTED STUDENT ATTENDEE AND $5,000 PER EVENT</li>
                    </ul>
                </motion.div>
            </motion.div>

            {/* Room booking confirmation */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Room Booking Confirmation</span>
                    <span className="label-text-alt text-error">*</span>
                </label>

                <motion.div
                    className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'
                        }`}
                    variants={fileUploadVariants}
                    initial="initial"
                    whileHover="hover"
                    whileTap="tap"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('room-booking-file')?.click()}
                >
                    <input
                        id="room-booking-file"
                        type="file"
                        className="hidden"
                        onChange={handleRoomBookingFileChange}
                        accept=".pdf,.png,.jpg,.jpeg"
                    />

                    <div className="flex flex-col items-center justify-center gap-3">
                        <motion.div
                            className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary"
                            whileHover={{ rotate: 15, scale: 1.1 }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </motion.div>

                        {roomBookingFile ? (
                            <>
                                <p className="font-medium text-primary">File selected:</p>
                                <p className="text-sm">{roomBookingFile.name}</p>
                                <p className="text-xs text-gray-500">Click or drag to replace</p>
                            </>
                        ) : (
                            <>
                                <p className="font-medium">Drop your file here or click to browse</p>
                                <p className="text-xs text-gray-500">Accepted formats: PDF, PNG, JPG</p>
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>

            {/* Food/Drinks */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Food & Drinks</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <p className="text-sm text-gray-500 mb-3">Will you be serving food or drinks at your event?</p>

                <div className="flex gap-6 mt-2">
                    <motion.label
                        className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg transition-colors ${formData.food_drinks_being_served === true
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-base-100 hover:bg-primary/10'
                            }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.food_drinks_being_served === true}
                            onChange={() => onDataChange({ food_drinks_being_served: true })}
                            required
                        />
                        <span className="font-medium">Yes, we'll have food/drinks</span>
                    </motion.label>

                    <motion.label
                        className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg transition-colors ${formData.food_drinks_being_served === false
                            ? 'bg-primary/20 border border-primary/50'
                            : 'bg-base-100 hover:bg-primary/10'
                            }`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.food_drinks_being_served === false}
                            onChange={() => onDataChange({ food_drinks_being_served: false })}
                            required
                        />
                        <span className="font-medium">No, no food/drinks</span>
                    </motion.label>
                </div>
            </motion.div>

            {/* AS Funding Question - only show if food/drinks are being served */}
            {formData.food_drinks_being_served && (
                <motion.div
                    variants={itemVariants}
                    className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                    whileHover={{ y: -2 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                >
                    <label className="label">
                        <span className="label-text font-medium text-lg">AS Funding Request</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <p className="text-sm text-gray-500 mb-3">Do you need funding from AS?</p>

                    <div className="flex gap-6 mt-2">
                        <motion.label
                            className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg transition-colors ${formData.needs_as_funding === true
                                ? 'bg-primary/20 border border-primary/50'
                                : 'bg-base-100 hover:bg-primary/10'
                                }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <input
                                type="radio"
                                className="radio radio-primary"
                                checked={formData.needs_as_funding === true}
                                onChange={() => onDataChange({
                                    needs_as_funding: true,
                                    as_funding_required: true
                                })}
                                required
                            />
                            <span className="font-medium">Yes, we need AS funding</span>
                        </motion.label>

                        <motion.label
                            className={`flex items-center gap-3 cursor-pointer p-4 rounded-lg transition-colors ${formData.needs_as_funding === false
                                ? 'bg-primary/20 border border-primary/50'
                                : 'bg-base-100 hover:bg-primary/10'
                                }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                        >
                            <input
                                type="radio"
                                className="radio radio-primary"
                                checked={formData.needs_as_funding === false}
                                onChange={() => onDataChange({
                                    needs_as_funding: false,
                                    as_funding_required: false
                                })}
                                required
                            />
                            <span className="font-medium">No, we don't need funding</span>
                        </motion.label>
                    </div>
                </motion.div>
            )}

            {/* Single information alert container that changes content based on selection */}
            {formData.food_drinks_being_served && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="mb-4"
                >
                    <CustomAlert
                        type="info"
                        title={formData.needs_as_funding ? "AS Funding Information" : "Food and Drinks Information"}
                        message={formData.needs_as_funding
                            ? "In the next step, you'll be asked to provide vendor information and invoice details for your AS funding request."
                            : "Please make sure to follow all campus policies regarding food and drinks at your event."}
                        className="mb-4"
                        icon={formData.needs_as_funding ? "heroicons:currency-dollar" : "heroicons:cake"}
                    />
                </motion.div>
            )}
        </motion.div>
    );
};

export default TAPFormSection; 