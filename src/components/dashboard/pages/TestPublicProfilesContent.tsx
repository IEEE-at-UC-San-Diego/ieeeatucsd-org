import React, { useState } from 'react';
import { PlayCircle, CheckCircle, AlertTriangle, RefreshCw, Users, Award } from 'lucide-react';
import { PublicProfileService } from '../services/publicProfile';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth } from '../../../firebase/client';
import DashboardHeader from '../DashboardHeader';

export default function TestPublicProfilesContent() {
    const [user] = useAuthState(auth);
    const [testResults, setTestResults] = useState<string[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [publicProfiles, setPublicProfiles] = useState<any[]>([]);

    const addTestResult = (message: string, success: boolean = true) => {
        const prefix = success ? '✅' : '❌';
        setTestResults(prev => [...prev, `${prefix} ${message}`]);
    };

    const runTests = async () => {
        if (!user) {
            addTestResult('Must be logged in to run tests', false);
            return;
        }

        setIsRunning(true);
        setTestResults([]);

        try {
            addTestResult('Starting public profiles system tests...');

            // Test 1: Create/Update own public profile
            addTestResult('Test 1: Creating/updating public profile...');
            await PublicProfileService.syncPublicProfile(user.uid, {
                name: 'Test User',
                points: 100,
                eventsAttended: 5,
                major: 'Computer Science',
                graduationYear: 2025,
                position: 'Member'
            });
            addTestResult('Successfully created/updated public profile');

            // Test 2: Read own public profile
            addTestResult('Test 2: Reading public profile...');
            const profile = await PublicProfileService.getPublicProfile(user.uid);
            if (profile && profile.name === 'Test User') {
                addTestResult('Successfully read public profile');
            } else {
                addTestResult('Failed to read public profile correctly', false);
            }

            // Test 3: Update user stats
            addTestResult('Test 3: Updating user stats...');
            await PublicProfileService.updateUserStats(user.uid, {
                points: 150,
                eventsAttended: 6
            });
            addTestResult('Successfully updated user stats');

            // Test 4: Get leaderboard
            addTestResult('Test 4: Fetching leaderboard...');
            const leaderboard = await PublicProfileService.getLeaderboard();
            setPublicProfiles(leaderboard);
            addTestResult(`Successfully fetched leaderboard with ${leaderboard.length} profiles`);

            // Test 5: Verify updated stats in leaderboard
            const updatedProfile = leaderboard.find(p => p.id === user.uid);
            if (updatedProfile && updatedProfile.points === 150) {
                addTestResult('Stats correctly reflected in leaderboard');
            } else {
                addTestResult('Stats not correctly reflected in leaderboard', false);
            }

            addTestResult('All tests completed successfully! 🎉');

        } catch (error: any) {
            addTestResult(`Test failed: ${error.message}`, false);
        } finally {
            setIsRunning(false);
        }
    };

    const clearResults = () => {
        setTestResults([]);
        setPublicProfiles([]);
    };

    return (
        <div className="flex-1 overflow-auto">
            <DashboardHeader
                title="Public Profiles System Test"
                subtitle="Test the public profiles functionality to ensure everything is working correctly"
                showSearch={false}
            />

            <main className="p-6">
                <div className="max-w-4xl mx-auto">
                    {/* Test Controls */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Controls</h2>
                        
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={runTests}
                                disabled={isRunning || !user}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isRunning ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                    <PlayCircle className="w-4 h-4" />
                                )}
                                <span>
                                    {isRunning ? 'Running Tests...' : 'Run Tests'}
                                </span>
                            </button>

                            {testResults.length > 0 && (
                                <button
                                    onClick={clearResults}
                                    className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    <RefreshCw className="w-4 h-4" />
                                    <span>Clear Results</span>
                                </button>
                            )}
                        </div>

                        {!user && (
                            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <p className="text-sm text-yellow-800">You must be logged in to run tests</p>
                            </div>
                        )}
                    </div>

                    {/* Test Results */}
                    {testResults.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>
                            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
                                {testResults.map((result, index) => (
                                    <div key={index} className="text-sm text-gray-800 py-1">
                                        {result}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Current Leaderboard */}
                    {publicProfiles.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Current Leaderboard ({publicProfiles.length} profiles)
                            </h2>
                            <div className="space-y-3">
                                {publicProfiles.slice(0, 10).map((profile, index) => (
                                    <div key={profile.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center space-x-3">
                                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                                <span className="text-blue-600 font-medium text-sm">
                                                    #{index + 1}
                                                </span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-gray-900">
                                                    {profile.name || 'Unknown User'}
                                                    {profile.id === user?.uid && (
                                                        <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                                            You
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {profile.major || 'No major'} • {profile.position || 'Member'}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                            <div className="text-right">
                                                <div className="font-bold text-gray-900">{profile.points || 0} pts</div>
                                                <div className="text-sm text-gray-500">{profile.eventsAttended || 0} events</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Test Description */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">What These Tests Do</h2>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">1.</span>
                                <span>Creates/updates your public profile with test data</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">2.</span>
                                <span>Reads your public profile to verify it was saved correctly</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">3.</span>
                                <span>Updates your points and events attended</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">4.</span>
                                <span>Fetches the full leaderboard to test query permissions</span>
                            </li>
                            <li className="flex items-start">
                                <span className="text-blue-600 mr-2">5.</span>
                                <span>Verifies that your updated stats appear correctly in the leaderboard</span>
                            </li>
                        </ul>
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                            <p className="text-sm text-blue-800">
                                <strong>Note:</strong> This test will temporarily modify your public profile data. 
                                Make sure to update your actual profile in Settings afterward if needed.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
} 