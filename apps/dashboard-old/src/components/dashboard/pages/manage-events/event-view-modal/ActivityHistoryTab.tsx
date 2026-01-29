import React, { useMemo } from 'react';
import { Card, CardBody } from '@heroui/react';
import { Clock } from 'lucide-react';
import type { EventAuditLog } from './types';
import { formatDateTime } from './utils';

interface ActivityHistoryTabProps {
    auditLogs?: EventAuditLog[];
}

export default function ActivityHistoryTab({ auditLogs }: ActivityHistoryTabProps) {
    const sortedLogs = useMemo(() => {
        if (!auditLogs) return [];
        return [...auditLogs].sort((a, b) => {
            const aTime = new Date(a.timestamp?.toDate ? a.timestamp.toDate() : a.timestamp).getTime();
            const bTime = new Date(b.timestamp?.toDate ? b.timestamp.toDate() : b.timestamp).getTime();
            return bTime - aTime;
        });
    }, [auditLogs]);

    return (
        <div className="space-y-6">
            <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    <Clock className="w-5 h-5 mr-2 text-gray-600" />
                    Activity History
                    <span className="text-xs text-gray-500 ml-2">
                        ({auditLogs ? auditLogs.length : 0} logs)
                    </span>
                </h3>
                {sortedLogs.length > 0 ? (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {sortedLogs.map((log, index) => (
                            <div key={log.id || index} className="border-l-4 border-blue-200 bg-blue-50 p-4 rounded-r-lg">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 mb-2">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                {log.action.replace('_', ' ').toUpperCase()}
                                            </span>
                                            <span className="text-sm text-gray-600">
                                                by {log.performedByName || log.performedBy}
                                            </span>
                                        </div>

                                        <ActivityLogDetails log={log} />
                                    </div>
                                    <div className="text-xs text-gray-500 ml-4 flex-shrink-0">
                                        {formatDateTime(log.timestamp)}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card shadow="sm" className="bg-gray-50 border border-gray-200">
                        <CardBody className="p-6 text-center">
                            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                            <p className="text-gray-600 text-sm">No activity history available</p>
                            <p className="text-gray-500 text-xs mt-1">
                                Activity logs will appear here when actions are performed on this event
                            </p>
                        </CardBody>
                    </Card>
                )}
            </div>
        </div>
    );
}

interface ActivityLogDetailsProps {
    log: EventAuditLog;
}

function ActivityLogDetails({ log }: ActivityLogDetailsProps) {
    return (
        <>
            {log.action === 'status_changed' && (
                <div className="text-sm text-gray-700 mb-2">
                    Status changed from <span className="font-medium">{log.oldStatus}</span> to <span className="font-medium">{log.newStatus}</span>
                    {log.statusReason && (
                        <div className="mt-1 text-xs text-gray-600 italic">
                            "{log.statusReason}"
                        </div>
                    )}
                </div>
            )}

            {log.changes && log.changes.length > 0 && (
                <div className="text-sm text-gray-700 mb-2">
                    <div className="font-medium mb-1">Changes made:</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                        {log.changes.map((change, changeIndex) => (
                            <li key={changeIndex}>
                                <span className="font-medium">{change.fieldDisplayName}:</span>
                                {change.changeType === 'updated' && (
                                    <span> changed from "{String(change.oldValue)}" to "{String(change.newValue)}"</span>
                                )}
                                {change.changeType === 'added' && (
                                    <span> set to "{String(change.newValue)}"</span>
                                )}
                                {change.changeType === 'removed' && (
                                    <span> removed (was "{String(change.oldValue)}")</span>
                                )}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {(log as any).fileChanges && (log as any).fileChanges.length > 0 && (
                <div className="text-sm text-gray-700 mb-2">
                    <div className="font-medium mb-1">File changes:</div>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                        {(log as any).fileChanges.map((fileChange: any, fileIndex: number) => (
                            <li key={fileIndex}>
                                {fileChange.action === 'added' ? 'Added' : 'Removed'} {fileChange.fileType} file: {fileChange.fileName}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
}
