import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';
import type { EventRequest } from '../../../schemas/pocketbase';

// Animation variants
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

interface TAPFormSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const TAPFormSection: React.FC<TAPFormSectionProps> = ({ formData, onDataChange }) => {
    const [roomBookingFile, setRoomBookingFile] = useState<File | null>(formData.room_booking);

    // Handle room booking file upload
    const handleRoomBookingFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            setRoomBookingFile(file);
            onDataChange({ room_booking: file });
        }
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4 text-primary">TAP Form Information</h2>

            <div className="bg-base-300/50 p-4 rounded-lg mb-6">
                <p className="text-sm">
                    Please ensure you have ALL sections completed. If something is not available, let the coordinators know and be advised on how to proceed.
                </p>
            </div>

            {/* Expected attendance */}
            <motion.div variants={itemVariants} className="form-control bg-base-200/50 p-4 rounded-lg">
                <label className="label">
                    <span className="label-text font-medium text-lg">Expected attendance? Include a number NOT a range please.</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="relative mt-2">
                    <input
                        type="number"
                        className="input input-bordered focus:input-primary transition-all duration-300 w-full"
                        value={formData.expected_attendance || ''}
                        onChange={(e) => onDataChange({ expected_attendance: parseInt(e.target.value) || 0 })}
                        min="0"
                        placeholder="Enter expected attendance"
                        required
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                        people
                    </div>
                </div>
                <div className="text-xs text-gray-400 mt-2">
                    <p>PROGRAMMING FUNDS EVENTS FUNDED BY PROGRAMMING FUNDS MAY ONLY ADMIT UC SAN DIEGO STUDENTS, STAFF OR FACULTY AS GUESTS.</p>
                    <p>ONLY UC SAN DIEGO UNDERGRADUATE STUDENTS MAY RECEIVE ITEMS FUNDED BY THE ASSOCIATED STUDENTS.</p>
                    <p>EVENT FUNDING IS GRANTED UP TO A MAXIMUM OF $10.00 PER EXPECTED STUDENT ATTENDEE AND $5,000 PER EVENT</p>
                </div>
            </motion.div>

            {/* Room booking confirmation */}
            <motion.div variants={itemVariants} className="form-control bg-base-200/50 p-4 rounded-lg">
                <label className="label">
                    <span className="label-text font-medium text-lg">Room booking confirmation</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="mt-2">
                    <input
                        type="file"
                        className="file-input file-input-bordered file-input-primary w-full"
                        onChange={handleRoomBookingFileChange}
                        accept=".pdf,.png,.jpg,.jpeg"
                    />
                    {roomBookingFile && (
                        <p className="text-sm mt-2">
                            Selected file: {roomBookingFile.name}
                        </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                        Please upload a screenshot of your room booking confirmation. Accepted formats: PDF, PNG, JPG.
                    </p>
                </div>
            </motion.div>

            {/* Food/Drinks */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Will you be serving food/drinks at your event?</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.food_drinks_being_served === true}
                            onChange={() => onDataChange({ food_drinks_being_served: true })}
                            required
                        />
                        <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.food_drinks_being_served === false}
                            onChange={() => onDataChange({ food_drinks_being_served: false })}
                            required
                        />
                        <span>No</span>
                    </label>
                </div>
            </motion.div>

            {/* AS Funding Notice - only show if food/drinks are being served */}
            {formData.food_drinks_being_served && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="alert alert-info"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" className="h-5 w-5 stroke-current">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <div>
                        <h3 className="font-bold">Food and Drinks Information</h3>
                        <div className="text-xs">
                            If you're serving food or drinks, you'll be asked about AS funding in the next step. Please be prepared with vendor information and invoice details.
                        </div>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export default TAPFormSection; 