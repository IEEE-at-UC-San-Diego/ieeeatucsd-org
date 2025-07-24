import React, { useState } from 'react';
import { PlayCircle, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { PublicProfileService } from '../services/publicProfile';
import DashboardHeader from '../DashboardHeader';

export default function MigrationContent() {
    const [migrationStatus, setMigrationStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
    const [migrationLog, setMigrationLog] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    const addToLog = (message: string) => {
        setMigrationLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    };

    const runMigration = async () => {
        setMigrationStatus('running');
        setError(null);
        setMigrationLog([]);

        try {
            addToLog('Starting migration of user data to public profiles...');

            // Override console.log temporarily to capture migration logs
            const originalConsoleLog = console.log;
            console.log = (message: string) => {
                addToLog(message);
                originalConsoleLog(message);
            };

            await PublicProfileService.migrateFromUsersCollection();

            // Restore console.log
            console.log = originalConsoleLog;

            addToLog('Migration completed successfully!');
            setMigrationStatus('completed');
        } catch (err: any) {
            addToLog(`Migration failed: ${err.message}`);
            setError(err.message);
            setMigrationStatus('error');
        }
    };

    const resetMigration = () => {
        setMigrationStatus('idle');
        setMigrationLog([]);
        setError(null);
    };

    return (
        <div className="flex-1 overflow-auto">
            <DashboardHeader
                title="Data Migration"
                subtitle="Migrate existing user data to public profiles for leaderboard functionality"
                showSearch={false}
            />

            <main className="p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Warning Banner */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                        <div className="flex">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                            <div>
                                <h3 className="text-sm font-medium text-yellow-800">Important Notice</h3>
                                <p className="text-sm text-yellow-700 mt-1">
                                    This migration tool will copy user data from the private users collection to public profiles 
                                    for leaderboard functionality. Only run this once after implementing the new firestore rules.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Migration Controls */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Migration Control</h2>
                        
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={runMigration}
                                disabled={migrationStatus === 'running'}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {migrationStatus === 'running' ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <PlayCircle className="w-4 h-4" />
                                )}
                                <span>
                                    {migrationStatus === 'running' ? 'Running Migration...' : 'Start Migration'}
                                </span>
                            </button>

                            {migrationStatus !== 'idle' && (
                                <button
                                    onClick={resetMigration}
                                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Reset</span>
                                </button>
                            )}
                        </div>

                        {/* Status Indicator */}
                        {migrationStatus !== 'idle' && (
                            <div className="mt-4 flex items-center space-x-2">
                                {migrationStatus === 'running' && (
                                    <>
                                        <RefreshCw className="w-4 h-4 text-blue-600 animate-spin" />
                                        <span className="text-sm text-blue-600">Migration in progress...</span>
                                    </>
                                )}
                                {migrationStatus === 'completed' && (
                                    <>
                                        <CheckCircle className="w-4 h-4 text-green-600" />
                                        <span className="text-sm text-green-600">Migration completed successfully</span>
                                    </>
                                )}
                                {migrationStatus === 'error' && (
                                    <>
                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                        <span className="text-sm text-red-600">Migration failed</span>
                                    </>
                                )}
                            </div>
                        )}

                        {error && (
                            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        )}
                    </div>

                    {/* Migration Log */}
                    {migrationLog.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Migration Log</h2>
                            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                                <pre className="text-sm text-gray-800 whitespace-pre-wrap">
                                    {migrationLog.join('\n')}
                                </pre>
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">What This Migration Does</h2>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">•</span>
                                <span>Reads all user documents from the private users collection</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">•</span>
                                <span>Creates public profile documents containing name, points, major, graduation year, events attended, and position</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">•</span>
                                <span>Stores public profiles in both the top-level public_profiles collection and users/&#123;uid&#125;/public_profile/profile subcollection</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">•</span>
                                <span>Enables the leaderboard to work with the new security rules</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">•</span>
                                <span>Only migrates users with valid names (skips users with 'Unknown User' names)</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </main>
        </div>
    );
} 