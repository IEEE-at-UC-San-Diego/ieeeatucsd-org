import React from 'react';
import { motion } from 'framer-motion';
import type { EventRequestFormData } from './EventRequestForm';

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

interface EventDetailsSectionProps {
    formData: EventRequestFormData;
    onDataChange: (data: Partial<EventRequestFormData>) => void;
}

const EventDetailsSection: React.FC<EventDetailsSectionProps> = ({ formData, onDataChange }) => {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold mb-4 text-primary">Event Details</h2>

            <div className="bg-base-300/50 p-4 rounded-lg mb-6">
                <p className="text-sm">
                    Please remember to ping @Coordinators in #-events on Slack once you've submitted this form so that they can fill out a TAP form for you.
                </p>
            </div>

            {/* Event Name */}
            <motion.div variants={itemVariants} className="form-control bg-base-200/50 p-4 rounded-lg">
                <label className="label">
                    <span className="label-text font-medium text-lg">Event Name</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <input
                    type="text"
                    className="input input-bordered focus:input-primary transition-all duration-300 mt-2"
                    value={formData.name}
                    onChange={(e) => onDataChange({ name: e.target.value })}
                    placeholder="Enter event name"
                    required
                />
            </motion.div>

            {/* Event Description */}
            <motion.div variants={itemVariants} className="form-control bg-base-200/50 p-4 rounded-lg">
                <label className="label">
                    <span className="label-text font-medium text-lg">Event Description</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <textarea
                    className="textarea textarea-bordered focus:textarea-primary transition-all duration-300 min-h-[120px] mt-2"
                    value={formData.event_description}
                    onChange={(e) => onDataChange({ event_description: e.target.value })}
                    placeholder="Provide a detailed description of your event"
                    rows={4}
                    required
                />
            </motion.div>

            {/* Event Start Date */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Event Start Date & Time</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <input
                    type="datetime-local"
                    className="input input-bordered focus:input-primary transition-all duration-300"
                    value={formData.start_date_time}
                    onChange={(e) => onDataChange({ start_date_time: e.target.value })}
                    required
                />
            </motion.div>

            {/* Event End Date */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Event End Date & Time</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <input
                    type="datetime-local"
                    className="input input-bordered focus:input-primary transition-all duration-300"
                    value={formData.end_date_time}
                    onChange={(e) => onDataChange({ end_date_time: e.target.value })}
                    required
                />
            </motion.div>

            {/* Event Location */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Event Location</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <input
                    type="text"
                    className="input input-bordered focus:input-primary transition-all duration-300"
                    value={formData.location}
                    onChange={(e) => onDataChange({ location: e.target.value })}
                    placeholder="Enter event location"
                    required
                />
            </motion.div>

            {/* Room Booking */}
            <motion.div variants={itemVariants} className="form-control">
                <label className="label">
                    <span className="label-text font-medium">Do you/will you have a room booking for this event?</span>
                    <span className="label-text-alt text-error">*</span>
                </label>
                <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.will_or_have_room_booking === true}
                            onChange={() => onDataChange({ will_or_have_room_booking: true })}
                            required
                        />
                        <span>Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="radio"
                            className="radio radio-primary"
                            checked={formData.will_or_have_room_booking === false}
                            onChange={() => onDataChange({ will_or_have_room_booking: false })}
                            required
                        />
                        <span>No</span>
                    </label>
                </div>
            </motion.div>
        </div>
    );
};

export default EventDetailsSection; 