import React from 'react';
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

interface EventDetailsSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const EventDetailsSection: React.FC<EventDetailsSectionProps> = ({ formData, onDataChange }) => {
    return (
        <motion.div
            className="space-y-8"
            initial="hidden"
            animate="visible"
            variants={containerVariants}
        >
            <motion.div variants={itemVariants}>
                <h2 className="text-3xl font-bold mb-4 text-primary bg-gradient-to-r from-primary to-primary-focus bg-clip-text text-transparent">
                    Event Details
                </h2>
            </motion.div>

            <motion.div variants={itemVariants}>
                <CustomAlert
                    type="info"
                    title="Coordinator Notification"
                    message="Please remember to ping @Coordinators in #-events on Slack once you've submitted this form so that they can fill out a TAP form for you."
                    className="mb-6"
                    icon="heroicons:information-circle"
                />
            </motion.div>

            {/* Event Name */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Event Name</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <motion.input
                    type="text"
                    className="input input-bordered focus:input-primary transition-all duration-300 mt-2"
                    value={formData.name}
                    onChange={(e) => onDataChange({ name: e.target.value })}
                    placeholder="Enter event name"
                    required
                    whileHover="hover"
                    variants={inputHoverVariants}
                />
            </motion.div>

            {/* Event Description */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Event Description</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <motion.textarea
                    className="textarea textarea-bordered focus:textarea-primary transition-all duration-300 min-h-[120px] mt-2"
                    value={formData.event_description}
                    onChange={(e) => onDataChange({ event_description: e.target.value })}
                    placeholder="Provide a detailed description of your event"
                    rows={4}
                    required
                    whileHover="hover"
                    variants={inputHoverVariants}
                />
            </motion.div>

            {/* Date and Time Section */}
            <motion.div
                variants={itemVariants}
                className="grid grid-cols-1 gap-6"
            >
                {/* Event Start Date */}
                <motion.div
                    className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                    whileHover={{ y: -2 }}
                >
                    <label className="label">
                        <span className="label-text font-medium text-lg">Event Start Date & Time</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <motion.input
                        type="datetime-local"
                        className="input input-bordered focus:input-primary transition-all duration-300 mt-2"
                        value={formData.start_date_time}
                        onChange={(e) => {
                            const newStartDateTime = e.target.value;
                            onDataChange({ start_date_time: newStartDateTime });
                            
                            // If there's already an end time set, update it to use the new start date
                            if (formData.end_date_time && newStartDateTime) {
                                try {
                                    const existingEndDate = new Date(formData.end_date_time);
                                    const newStartDate = new Date(newStartDateTime);
                                    
                                    if (!isNaN(existingEndDate.getTime()) && !isNaN(newStartDate.getTime())) {
                                        // Keep the same time but update to the new date
                                        const updatedEndDate = new Date(newStartDate);
                                        updatedEndDate.setHours(existingEndDate.getHours(), existingEndDate.getMinutes(), 0, 0);
                                        onDataChange({ end_date_time: updatedEndDate.toISOString() });
                                    }
                                } catch (error) {
                                    console.error('Error updating end date when start date changed:', error);
                                }
                            }
                        }}
                        required
                        whileHover="hover"
                        variants={inputHoverVariants}
                    />
                    <p className="text-sm text-base-content/70 mt-2">
                        Note: For multi-day events, please submit a separate request for each day.
                    </p>
                    <p className="text-sm text-base-content/70 mt-1">
                        The event time should not include setup time.
                    </p>
                </motion.div>

                {/* Event End Time */}
                <motion.div
                    className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                    whileHover={{ y: -2 }}
                >
                    <label className="label">
                        <span className="label-text font-medium text-lg">Event End Time</span>
                        <span className="label-text-alt text-error">*</span>
                    </label>
                    <div className="flex flex-col gap-2">
                        <motion.input
                            type="time"
                            className="input input-bordered focus:input-primary transition-all duration-300"
                            value={formData.end_date_time ? (() => {
                                try {
                                    const endDate = new Date(formData.end_date_time);
                                    if (isNaN(endDate.getTime())) return '';
                                    return endDate.toTimeString().substring(0, 5);
                                } catch (e) {
                                    return '';
                                }
                            })() : ''}
                            onChange={(e) => {
                                const timeValue = e.target.value;
                                if (timeValue && formData.start_date_time) {
                                    try {
                                        // Create a new date object from start_date_time
                                        const startDate = new Date(formData.start_date_time);
                                        if (isNaN(startDate.getTime())) {
                                            console.error('Invalid start date time');
                                            return;
                                        }
                                        
                                        // Parse the time value
                                        const [hours, minutes] = timeValue.split(':').map(Number);
                                        
                                        // Validate hours and minutes
                                        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
                                            console.error('Invalid time values');
                                            return;
                                        }
                                        
                                        // Create a new date with the same date as start but different time
                                        const endDate = new Date(startDate);
                                        endDate.setHours(hours, minutes, 0, 0);
                                        
                                        // Update end_date_time with the new time but same date as start
                                        onDataChange({ end_date_time: endDate.toISOString() });
                                    } catch (error) {
                                        console.error('Error setting end time:', error);
                                    }
                                } else if (!timeValue) {
                                    // Clear end_date_time if time is cleared
                                    onDataChange({ end_date_time: '' });
                                }
                            }}
                            required
                            disabled={!formData.start_date_time}
                            whileHover="hover"
                            variants={inputHoverVariants}
                        />
                        <p className="text-xs text-base-content/60">
                            {!formData.start_date_time 
                                ? "Please set the start date and time first." 
                                : "The end time will use the same date as the start date."
                            }
                        </p>
                    </div>
                </motion.div>
            </motion.div>

            {/* Event Location */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Event Location</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <motion.input
                    type="text"
                    className="input input-bordered focus:input-primary transition-all duration-300 mt-2"
                    value={formData.location}
                    onChange={(e) => onDataChange({ location: e.target.value })}
                    placeholder="Enter event location"
                    required
                    whileHover="hover"
                    variants={inputHoverVariants}
                />
            </motion.div>

            {/* Room Booking */}
            <motion.div
                variants={itemVariants}
                className="form-control bg-base-200/50 p-6 rounded-xl shadow-sm hover:shadow-md transition-all duration-300"
                whileHover={{ y: -2 }}
            >
                <label className="label">
                    <span className="label-text font-medium text-lg">Room Booking Status</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="flex gap-6 mt-2">
                    <motion.label
                        className="flex items-center gap-3 cursor-pointer bg-base-100 p-3 rounded-lg hover:bg-primary/10 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.will_or_have_room_booking === true}
                            onChange={() => onDataChange({ will_or_have_room_booking: true })}
                            required
                        />
                        <span className="font-medium">Yes, I have a room booking</span>
                    </motion.label>
                    <motion.label
                        className="flex items-center gap-3 cursor-pointer bg-base-100 p-3 rounded-lg hover:bg-primary/10 transition-colors"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.will_or_have_room_booking === false}
                            onChange={() => {
                                onDataChange({ will_or_have_room_booking: false });
                            }}
                            required
                        />
                        <span className="font-medium">No, I don't need a booking</span>
                    </motion.label>
                </div>

                {formData.will_or_have_room_booking === false && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-4"
                    >
                        <CustomAlert
                            type="warning"
                            title="IMPORTANT: Event Will Be Cancelled"
                            message="If you need a booking and submit without one, your event WILL BE CANCELLED. This is non-negotiable. Contact the event coordinator immediately if you have any booking concerns."
                        />
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
    );
};

export default EventDetailsSection; 