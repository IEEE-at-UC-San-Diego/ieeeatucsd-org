import React from 'react';

interface EventDetailsSectionProps {
    onDataChange?: (data: any) => void;
}

const EventDetailsSection: React.FC<EventDetailsSectionProps> = ({ onDataChange }) => {
    return (
        <div className="card bg-base-100/95 backdrop-blur-md shadow-lg">
            <div className="card-body">
                <h2 className="card-title text-xl mb-6 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Event Details
                </h2>

                <div className="space-y-6 mt-4">
                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-medium flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Event Name
                            </span>
                        </label>
                        <input
                            type="text"
                            name="event_name"
                            className="input input-bordered w-full"
                            onChange={(e) => onDataChange?.({ name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-medium flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Event Description
                            </span>
                        </label>
                        <textarea
                            name="event_description"
                            className="textarea textarea-bordered h-32"
                            onChange={(e) => onDataChange?.({ description: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-medium flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Event Start Date
                            </span>
                        </label>
                        <input
                            type="datetime-local"
                            name="start_date_time"
                            className="input input-bordered w-full"
                            onChange={(e) => onDataChange?.({ start_date_time: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-medium flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                Event End Date
                            </span>
                        </label>
                        <input
                            type="datetime-local"
                            name="end_date_time"
                            className="input input-bordered w-full"
                            onChange={(e) => onDataChange?.({ end_date_time: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-medium flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                Event Location
                            </span>
                        </label>
                        <input
                            type="text"
                            name="location"
                            className="input input-bordered w-full"
                            onChange={(e) => onDataChange?.({ location: e.target.value })}
                            required
                        />
                    </div>

                    <div className="form-control w-full">
                        <label className="label">
                            <span className="label-text font-medium flex items-center gap-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                                Room Booking Status
                            </span>
                        </label>
                        <div className="flex gap-4">
                            <label className="label cursor-pointer justify-start gap-3 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                <input
                                    type="radio"
                                    name="will_or_have_room_booking"
                                    value="true"
                                    className="radio radio-primary"
                                    onChange={(e) => onDataChange?.({ will_or_have_room_booking: e.target.value === 'true' })}
                                    required
                                />
                                <span className="label-text">Yes</span>
                            </label>
                            <label className="label cursor-pointer justify-start gap-3 hover:bg-base-200/50 p-4 rounded-lg transition-colors duration-300">
                                <input
                                    type="radio"
                                    name="will_or_have_room_booking"
                                    value="false"
                                    className="radio radio-primary"
                                    onChange={(e) => onDataChange?.({ will_or_have_room_booking: e.target.value === 'true' })}
                                    required
                                />
                                <span className="label-text">No</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EventDetailsSection; 