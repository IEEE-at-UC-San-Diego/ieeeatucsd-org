import React, { useEffect, useState } from 'react';
import { DataSyncService, SyncStatus } from '../scripts/database/DataSyncService';
import { Collections } from '../schemas/pocketbase/schema';

interface SyncStatusProps {
    collection?: string; // Optional specific collection to show status for
    showLabel?: boolean; // Whether to show the collection name
    onSyncClick?: () => void; // Optional callback when sync button is clicked
}

export const SyncStatusIndicator: React.FC<SyncStatusProps> = ({
    collection,
    showLabel = false,
    onSyncClick,
}) => {
    const [status, setStatus] = useState<SyncStatus>(SyncStatus.SYNCED);
    const [isLoading, setIsLoading] = useState(false);
    const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
    const [showMenu, setShowMenu] = useState(false);

    useEffect(() => {
        const dataSyncService = DataSyncService.getInstance();

        // Initialize auto-sync state
        setAutoSyncEnabled(dataSyncService.isAutoSyncEnabled());

        // If a specific collection is provided, get its status
        if (collection) {
            setStatus(dataSyncService.getSyncStatus(collection));

            // Listen for status changes
            const handleStatusChange = (col: string, newStatus: SyncStatus) => {
                if (col === collection) {
                    setStatus(newStatus);
                }
            };

            dataSyncService.onSyncStatusChange(handleStatusChange);

            return () => {
                dataSyncService.offSyncStatusChange(handleStatusChange);
            };
        } else {
            // If no collection is specified, show an aggregate status
            const checkAllStatuses = () => {
                const allStatuses = Object.values(Collections).map(col =>
                    dataSyncService.getSyncStatus(col)
                );

                if (allStatuses.includes(SyncStatus.ERROR)) {
                    setStatus(SyncStatus.ERROR);
                } else if (allStatuses.includes(SyncStatus.OUT_OF_SYNC)) {
                    setStatus(SyncStatus.OUT_OF_SYNC);
                } else if (allStatuses.includes(SyncStatus.CHECKING)) {
                    setStatus(SyncStatus.CHECKING);
                } else if (allStatuses.includes(SyncStatus.OFFLINE)) {
                    setStatus(SyncStatus.OFFLINE);
                } else {
                    setStatus(SyncStatus.SYNCED);
                }
            };

            // Check initial status
            checkAllStatuses();

            // Listen for any status changes
            const handleStatusChange = () => {
                checkAllStatuses();
            };

            Object.values(Collections).forEach(col => {
                dataSyncService.onSyncStatusChange(handleStatusChange);
            });

            return () => {
                Object.values(Collections).forEach(col => {
                    dataSyncService.offSyncStatusChange(handleStatusChange);
                });
            };
        }
    }, [collection]);

    const handleSync = async () => {
        if (isLoading) return;

        setIsLoading(true);
        const dataSyncService = DataSyncService.getInstance();

        try {
            if (collection) {
                // Sync specific collection
                await dataSyncService.syncCollection(collection);
            } else {
                // Check all collections and sync those that are out of sync
                const outOfSyncCollections = await dataSyncService.checkAllCollectionsVersion();

                for (const [col, isOutOfSync] of Object.entries(outOfSyncCollections)) {
                    if (isOutOfSync) {
                        await dataSyncService.syncCollection(col);
                    }
                }
            }

            if (onSyncClick) {
                onSyncClick();
            }
        } catch (error) {
            console.error('Error syncing data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const toggleAutoSync = () => {
        const dataSyncService = DataSyncService.getInstance();
        const newState = !autoSyncEnabled;
        dataSyncService.setAutoSync(newState);
        setAutoSyncEnabled(newState);
    };

    const toggleMenu = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (showMenu) setShowMenu(false);
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [showMenu]);

    // Get icon and color based on status
    const getStatusInfo = () => {
        switch (status) {
            case SyncStatus.SYNCED:
                return { icon: '✓', color: 'text-green-500', text: 'Synced' };
            case SyncStatus.OUT_OF_SYNC:
                return { icon: '↻', color: 'text-yellow-500', text: 'Out of sync' };
            case SyncStatus.CHECKING:
                return { icon: '⟳', color: 'text-blue-500', text: 'Checking' };
            case SyncStatus.ERROR:
                return { icon: '✗', color: 'text-red-500', text: 'Error' };
            case SyncStatus.OFFLINE:
                return { icon: '⚡', color: 'text-gray-500', text: 'Offline' };
            default:
                return { icon: '?', color: 'text-gray-500', text: 'Unknown' };
        }
    };

    const { icon, color, text } = getStatusInfo();

    return (
        <div className="relative">
            <div className="flex items-center space-x-2">
                {showLabel && collection && (
                    <span className="text-sm font-medium">{collection}:</span>
                )}
                <div
                    className={`flex items-center cursor-pointer ${isLoading ? 'opacity-50' : ''}`}
                    onClick={handleSync}
                    title={`${text}${collection ? ` - ${collection}` : ''} (Click to sync)`}
                >
                    <span className={`${color} text-lg ${status === SyncStatus.CHECKING ? 'animate-spin' : ''}`}>
                        {icon}
                    </span>
                    <span className="ml-1 text-sm">{text}</span>
                </div>
                <button
                    onClick={toggleMenu}
                    className="ml-1 text-gray-500 hover:text-gray-700 focus:outline-none"
                    title="Sync options"
                >
                    ⚙️
                </button>
            </div>

            {showMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 p-2">
                    <div className="flex items-center justify-between p-2 hover:bg-gray-100 rounded">
                        <span className="text-sm">Auto-sync</span>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                checked={autoSyncEnabled}
                                onChange={toggleAutoSync}
                                className="sr-only peer"
                            />
                            <div className={`w-9 h-5 rounded-full peer ${autoSyncEnabled ? 'bg-blue-600' : 'bg-gray-200'} peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all`}></div>
                        </label>
                    </div>
                    <div className="border-t my-1"></div>
                    <button
                        onClick={handleSync}
                        className="w-full text-left p-2 text-sm hover:bg-gray-100 rounded"
                    >
                        Sync now
                    </button>
                </div>
            )}
        </div>
    );
};

// Component to show status for all collections
export const AllCollectionsSyncStatus: React.FC = () => {
    return (
        <div className="space-y-2">
            <h3 className="text-lg font-medium">Data Sync Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {Object.values(Collections).map(collection => (
                    <SyncStatusIndicator
                        key={collection}
                        collection={collection}
                        showLabel={true}
                    />
                ))}
            </div>
        </div>
    );
};

export default SyncStatusIndicator; 