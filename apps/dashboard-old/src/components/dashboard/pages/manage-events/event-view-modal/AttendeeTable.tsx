import React from 'react';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Tooltip } from '@heroui/react';
import type { AttendeeRecord, UserDirectory } from './types';
import { formatDateTime, getUserName } from './utils';

interface AttendeeTableProps {
    attendees: AttendeeRecord[];
    users: UserDirectory;
}

export default function AttendeeTable({ attendees, users }: AttendeeTableProps) {
    return (
        <Table
            aria-label="Event attendees"
            shadow="none"
            classNames={{
                base: "overflow-hidden border border-gray-200 rounded-lg",
                table: "min-w-full divide-y divide-gray-200"
            }}
        >
            <TableHeader>
                <TableColumn>Name</TableColumn>
                <TableColumn>Email</TableColumn>
                <TableColumn>Check-in Time</TableColumn>
                <TableColumn>Points Earned</TableColumn>
            </TableHeader>
            <TableBody emptyContent={<span className="text-gray-500 text-sm">No attendees to display</span>}>
                {attendees.map((attendee, index) => {
                    const attendeeId = attendee.userId || attendee.id || '';
                    const displayName = getUserName(users, attendeeId);
                    const email = users[attendeeId]?.email || 'N/A';
                    const checkInTime = attendee.timeCheckedIn
                        ? formatDateTime(attendee.timeCheckedIn)
                        : 'Not specified';

                    return (
                        <TableRow key={attendee.id || index} className="hover:bg-gray-50">
                            <TableCell>
                                <div className="flex flex-col">
                                    <Tooltip content={displayName} delay={500} isDisabled={displayName.length <= 20}>
                                        <span className="font-medium text-sm truncate max-w-[200px]">{displayName}</span>
                                    </Tooltip>
                                    <Tooltip content={attendeeId} delay={500}>
                                        <span className="text-xs text-gray-500 font-mono truncate max-w-[200px] hidden md:block">{attendeeId}</span>
                                    </Tooltip>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Tooltip content={email} delay={500} isDisabled={email.length <= 25}>
                                    <span className="text-sm truncate block max-w-[250px]">{email}</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell>
                                <Tooltip content={checkInTime} delay={500}>
                                    <span className="text-sm truncate block max-w-[200px]">{checkInTime}</span>
                                </Tooltip>
                            </TableCell>
                            <TableCell>
                                <Chip
                                    color="success"
                                    variant="flat"
                                    size="sm"
                                    className="text-xs"
                                >
                                    {attendee.pointsEarned || 0}
                                </Chip>
                            </TableCell>
                        </TableRow>
                    );
                })}
            </TableBody>
        </Table>
    );
}
