import React from 'react';
import { Search, Calendar, Bell, User, Plus, Filter, MapPin, Clock, Users } from 'lucide-react';

const upcomingEvents = [
    {
        id: 1,
        title: 'IEEE Technical Talk: AI in Engineering',
        date: '2024-02-15',
        time: '6:00 PM',
        location: 'Engineering Building Unit 1, Room 202',
        attendees: 45,
        capacity: 80,
        type: 'Technical Talk',
        status: 'upcoming'
    },
    {
        id: 2,
        title: 'Quarterly Project Showcase',
        date: '2024-02-20',
        time: '7:00 PM',
        location: 'Price Center East, Room 104',
        attendees: 67,
        capacity: 100,
        type: 'Showcase',
        status: 'upcoming'
    },
    {
        id: 3,
        title: 'RoboCup Practice Session',
        date: '2024-02-22',
        time: '4:00 PM',
        location: 'Jacobs Hall, Room 4309',
        attendees: 12,
        capacity: 20,
        type: 'Practice',
        status: 'upcoming'
    }
];

const pastEvents = [
    {
        id: 4,
        title: 'IEEE Welcome Back Social',
        date: '2024-01-25',
        time: '6:00 PM',
        location: 'Warren College, Room 101',
        attendees: 89,
        capacity: 100,
        type: 'Social',
        status: 'completed'
    },
    {
        id: 5,
        title: 'Winter Quarter Kickoff',
        date: '2024-01-10',
        time: '7:00 PM',
        location: 'Price Center West, Room 115',
        attendees: 125,
        capacity: 150,
        type: 'Meeting',
        status: 'completed'
    }
];

export default function EventsContent() {
    return (
        <div className="flex-1 overflow-auto">
            {/* Header */}
            <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search events..."
                                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                            Search
                        </button>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Calendar className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <User className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Events Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">Events</h1>
                            <p className="text-gray-600">Manage your IEEE UCSD events and attendance</p>
                        </div>
                        <div className="flex items-center space-x-3">
                            <button className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                                <Filter className="w-4 h-4" />
                                <span>Filter</span>
                            </button>
                            <button className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                <Plus className="w-4 h-4" />
                                <span>New Event</span>
                            </button>
                        </div>
                    </div>

                    {/* Event Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Events</p>
                                    <p className="text-2xl font-bold text-gray-900">8</p>
                                </div>
                                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                                    <Calendar className="w-6 h-6 text-blue-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">This Month</p>
                                    <p className="text-2xl font-bold text-gray-900">3</p>
                                </div>
                                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                    <Clock className="w-6 h-6 text-green-600" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-medium text-gray-600">Total Attendees</p>
                                    <p className="text-2xl font-bold text-gray-900">338</p>
                                </div>
                                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                                    <Users className="w-6 h-6 text-purple-600" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Upcoming Events */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Events</h2>
                        <div className="space-y-4">
                            {upcomingEvents.map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                                            <Calendar className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{event.title}</h3>
                                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                                <div className="flex items-center space-x-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{event.date} at {event.time}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{event.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">{event.attendees}/{event.capacity}</p>
                                            <p className="text-xs text-gray-500">Registered</p>
                                        </div>
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                            {event.type}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Past Events */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Past Events</h2>
                        <div className="space-y-4">
                            {pastEvents.map((event) => (
                                <div key={event.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg opacity-75">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                                            <Calendar className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-gray-900">{event.title}</h3>
                                            <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                                <div className="flex items-center space-x-1">
                                                    <Clock className="w-4 h-4" />
                                                    <span>{event.date} at {event.time}</span>
                                                </div>
                                                <div className="flex items-center space-x-1">
                                                    <MapPin className="w-4 h-4" />
                                                    <span>{event.location}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-4">
                                        <div className="text-right">
                                            <p className="text-sm font-medium text-gray-900">{event.attendees}/{event.capacity}</p>
                                            <p className="text-xs text-gray-500">Attended</p>
                                        </div>
                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                            Completed
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 