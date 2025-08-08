import React, { useState, useEffect } from 'react';
import {
    AlertTriangle,
    Play,
    Eye,
    Trash2,
    CheckCircle,
    XCircle,
    Clock,
    FileText,
    Database,
    HardDrive,
    Users,
    Shield
} from 'lucide-react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Alert, AlertDescription } from '../../../ui/alert';
import { Badge } from '../../../ui/badge';
import { Progress } from '../../../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../../../ui/dialog';
import { useAdminAccess } from '../../../../hooks/useAdminAccess';
import { FileMigrationService } from '../../../../utils/fileMigration';
// Avoid pulling Node-only test script into browser bundle. Import dynamically when used.
// import { FileMigrationTester } from '../../../../scripts/testFileMigration';
import DashboardHeader from '../../shared/DashboardHeader';

interface MigrationProgress {
    phase: 'idle' | 'preview' | 'testing' | 'migrating' | 'cleanup' | 'complete' | 'error';
    currentStep: string;
    progress: number;
    filesProcessed: number;
    totalFiles: number;
    errors: string[];
    warnings: string[];
}

interface MigrationStats {
    totalFilesToMigrate: number;
    filesByCategory: { [category: string]: number };
    eventsAffected: number;
    estimatedTime: string;
}

export default function MigrationContent() {
    const { hasAdminAccess } = useAdminAccess();
    const [migrationService] = useState(() => new FileMigrationService());
    const [migrationTester, setMigrationTester] = useState<any | null>(null);

    const [progress, setProgress] = useState<MigrationProgress>({
        phase: 'idle',
        currentStep: 'Ready to start',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        errors: [],
        warnings: []
    });

    const [stats, setStats] = useState<MigrationStats | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState<string | null>(null);
    const [migrationResults, setMigrationResults] = useState<any>(null);
    const [testResults, setTestResults] = useState<any[]>([]);

    // Admin access is now handled by the useAdminAccess hook

    useEffect(() => {
        if (!hasAdminAccess) {
            return;
        }

        // Load initial stats
        loadMigrationStats();

        // Dynamically import Node-only tester to avoid pulling into client pre-bundle
        import('../../../../scripts/testFileMigration').then(mod => {
            setMigrationTester(new mod.FileMigrationTester());
        }).catch(() => {
            // Optional: surface a warning if import fails
            console.warn('FileMigrationTester not available in this environment.');
        });
    }, [hasAdminAccess]);

    const loadMigrationStats = async () => {
        try {
            setProgress(prev => ({ ...prev, phase: 'preview', currentStep: 'Loading migration preview...' }));

            const filesToMigrate = await migrationService.previewMigration();

            // Calculate statistics
            const filesByCategory = filesToMigrate.reduce((acc, file) => {
                acc[file.category] = (acc[file.category] || 0) + 1;
                return acc;
            }, {} as { [category: string]: number });

            const eventsAffected = new Set(filesToMigrate.map(f => f.eventId)).size;
            const estimatedTime = calculateEstimatedTime(filesToMigrate.length);

            setStats({
                totalFilesToMigrate: filesToMigrate.length,
                filesByCategory,
                eventsAffected,
                estimatedTime
            });

            setProgress(prev => ({
                ...prev,
                phase: 'idle',
                currentStep: 'Ready to start',
                totalFiles: filesToMigrate.length
            }));

        } catch (error) {
            console.error('Error loading migration stats:', error);
            setProgress(prev => ({
                ...prev,
                phase: 'error',
                currentStep: 'Failed to load migration preview',
                errors: [...prev.errors, `Preview error: ${error}`]
            }));
        }
    };

    const calculateEstimatedTime = (fileCount: number): string => {
        // Estimate ~2 seconds per file for migration
        const totalSeconds = fileCount * 2;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;

        if (minutes > 0) {
            return `~${minutes}m ${seconds}s`;
        }
        return `~${seconds}s`;
    };

    const runTests = async () => {
        try {
            setProgress(prev => ({
                ...prev,
                phase: 'testing',
                currentStep: 'Running pre-migration tests...',
                progress: 0
            }));

            if (!migrationTester) {
                throw new Error('Test runner not initialized');
            }
            const results = await migrationTester.runAllTests();
            setTestResults(results);

            const passedTests = results.filter((r: any) => r.passed).length;
            const progressPercent = (passedTests / results.length) * 100;

            setProgress(prev => ({
                ...prev,
                phase: 'idle',
                currentStep: `Tests completed: ${passedTests}/${results.length} passed`,
                progress: progressPercent
            }));

        } catch (error) {
            console.error('Error running tests:', error);
            setProgress(prev => ({
                ...prev,
                phase: 'error',
                currentStep: 'Test execution failed',
                errors: [...prev.errors, `Test error: ${error}`]
            }));
        }
    };

    const runMigration = async () => {
        try {
            setProgress(prev => ({
                ...prev,
                phase: 'migrating',
                currentStep: 'Starting file migration...',
                progress: 0,
                filesProcessed: 0,
                errors: [],
                warnings: []
            }));

            const result = await migrationService.migrateAllFiles();

            setMigrationResults(result);

            if (result.success) {
                setProgress(prev => ({
                    ...prev,
                    phase: 'complete',
                    currentStep: 'Migration completed successfully',
                    progress: 100,
                    filesProcessed: result.migratedFiles
                }));
            } else {
                setProgress(prev => ({
                    ...prev,
                    phase: 'error',
                    currentStep: 'Migration completed with errors',
                    progress: 100,
                    errors: result.errors
                }));
            }

        } catch (error) {
            console.error('Error during migration:', error);
            setProgress(prev => ({
                ...prev,
                phase: 'error',
                currentStep: 'Migration failed',
                errors: [...prev.errors, `Migration error: ${error}`]
            }));
        }
    };

    const runCleanup = async () => {
        try {
            setProgress(prev => ({
                ...prev,
                phase: 'cleanup',
                currentStep: 'Cleaning up temporary files...',
                progress: 0
            }));

            const result = await migrationService.cleanupTemporaryFiles();

            setProgress(prev => ({
                ...prev,
                phase: 'complete',
                currentStep: `Cleanup completed: ${result.migratedFiles} folders processed`,
                progress: 100
            }));

        } catch (error) {
            console.error('Error during cleanup:', error);
            setProgress(prev => ({
                ...prev,
                phase: 'error',
                currentStep: 'Cleanup failed',
                errors: [...prev.errors, `Cleanup error: ${error}`]
            }));
        }
    };

    const handleConfirmAction = (action: string) => {
        setShowConfirmDialog(null);

        switch (action) {
            case 'test':
                runTests();
                break;
            case 'migrate':
                runMigration();
                break;
            case 'cleanup':
                runCleanup();
                break;
        }
    };

    if (!hasAdminAccess) {
        return (
            <div className="flex-1 overflow-auto">
                <DashboardHeader
                    title="File Storage Migration"
                    subtitle="Access Denied"
                    showSearch={false}
                />
                <main className="p-6">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center space-x-3 text-red-600">
                                <Shield className="w-6 h-6" />
                                <div>
                                    <h3 className="font-semibold">Access Denied</h3>
                                    <p className="text-sm text-gray-600">
                                        This page is restricted to administrators only.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </main>
            </div>
        );
    };

    return (
        <div className="flex-1 overflow-auto">
            <DashboardHeader
                title="File Storage Migration"
                subtitle="Migrate from user-based to event-based file organization"
                showSearch={false}
            />

            <main className="p-6">
                <div className="max-w-6xl mx-auto space-y-6">
                    {/* Warning Banner */}
                    <Alert className="border-orange-200 bg-orange-50">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                        <AlertDescription className="text-orange-800">
                            <strong>Important:</strong> This migration will reorganize all files in Firebase Storage.
                            Ensure you have a backup before proceeding. This operation cannot be easily undone.
                        </AlertDescription>
                    </Alert>

                    {/* Migration Stats */}
                    {stats && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center space-x-2">
                                    <Database className="w-5 h-5" />
                                    <span>Migration Overview</span>
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-blue-600">{stats.totalFilesToMigrate}</div>
                                        <div className="text-sm text-gray-600">Files to Migrate</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-green-600">{stats.eventsAffected}</div>
                                        <div className="text-sm text-gray-600">Events Affected</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-purple-600">
                                            {Object.keys(stats.filesByCategory).length}
                                        </div>
                                        <div className="text-sm text-gray-600">File Categories</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-2xl font-bold text-orange-600">{stats.estimatedTime}</div>
                                        <div className="text-sm text-gray-600">Estimated Time</div>
                                    </div>
                                </div>

                                {/* File Categories Breakdown */}
                                <div className="mt-4">
                                    <h4 className="font-medium mb-2">Files by Category:</h4>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(stats.filesByCategory).map(([category, count]) => (
                                            <Badge key={category} variant="outline">
                                                {category}: {count}
                                            </Badge>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Progress Section */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <Clock className="w-5 h-5" />
                                <span>Migration Progress</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-sm mb-2">
                                        <span>{progress.currentStep}</span>
                                        <span>{progress.filesProcessed}/{progress.totalFiles}</span>
                                    </div>
                                    <Progress value={progress.progress} className="w-full" />
                                </div>

                                <div className="flex items-center space-x-2">
                                    {progress.phase === 'idle' && <CheckCircle className="w-5 h-5 text-green-500" />}
                                    {progress.phase === 'error' && <XCircle className="w-5 h-5 text-red-500" />}
                                    {['preview', 'testing', 'migrating', 'cleanup'].includes(progress.phase) && (
                                        <Clock className="w-5 h-5 text-blue-500 animate-spin" />
                                    )}
                                    {progress.phase === 'complete' && <CheckCircle className="w-5 h-5 text-green-500" />}

                                    <span className="text-sm font-medium capitalize">
                                        {progress.phase === 'idle' ? 'Ready' : progress.phase}
                                    </span>
                                </div>

                                {progress.errors.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-medium text-red-600 mb-2">Errors:</h4>
                                        <div className="bg-red-50 border border-red-200 rounded p-3 max-h-32 overflow-y-auto">
                                            {progress.errors.map((error, index) => (
                                                <div key={index} className="text-sm text-red-700">{error}</div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Migration Actions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Button
                                    onClick={() => setShowConfirmDialog('test')}
                                    disabled={['testing', 'migrating', 'cleanup'].includes(progress.phase)}
                                    className="flex items-center space-x-2"
                                >
                                    <Eye className="w-4 h-4" />
                                    <span>Run Tests</span>
                                </Button>

                                <Button
                                    onClick={() => setShowConfirmDialog('migrate')}
                                    disabled={['testing', 'migrating', 'cleanup'].includes(progress.phase) || !stats}
                                    variant="destructive"
                                    className="flex items-center space-x-2"
                                >
                                    <Play className="w-4 h-4" />
                                    <span>Start Migration</span>
                                </Button>

                                <Button
                                    onClick={() => setShowConfirmDialog('cleanup')}
                                    disabled={['testing', 'migrating', 'cleanup'].includes(progress.phase)}
                                    variant="outline"
                                    className="flex items-center space-x-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    <span>Cleanup Temp Files</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Results Tabs */}
                    <Tabs defaultValue="overview" className="w-full">
                        <TabsList>
                            <TabsTrigger value="overview">Overview</TabsTrigger>
                            <TabsTrigger value="tests">Test Results</TabsTrigger>
                            <TabsTrigger value="migration">Migration Results</TabsTrigger>
                        </TabsList>

                        <TabsContent value="overview" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Migration Process</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        <div className="flex items-start space-x-3">
                                            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">1</div>
                                            <div>
                                                <h4 className="font-medium">Run Pre-Migration Tests</h4>
                                                <p className="text-sm text-gray-600">Validate system readiness and identify potential issues</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-sm font-medium">2</div>
                                            <div>
                                                <h4 className="font-medium">Execute Migration</h4>
                                                <p className="text-sm text-gray-600">Move files from user-based to event-based structure</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start space-x-3">
                                            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-medium">3</div>
                                            <div>
                                                <h4 className="font-medium">Clean Up</h4>
                                                <p className="text-sm text-gray-600">Remove temporary files and finalize migration</p>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="tests">
                            {testResults.length > 0 ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Test Results</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {testResults.map((test, index) => (
                                                <div key={index} className="flex items-center justify-between p-3 border rounded">
                                                    <div className="flex items-center space-x-3">
                                                        {test.passed ? (
                                                            <CheckCircle className="w-5 h-5 text-green-500" />
                                                        ) : (
                                                            <XCircle className="w-5 h-5 text-red-500" />
                                                        )}
                                                        <div>
                                                            <div className="font-medium">{test.testName}</div>
                                                            <div className="text-sm text-gray-600">{test.message}</div>
                                                        </div>
                                                    </div>
                                                    <Badge variant={test.passed ? "default" : "destructive"}>
                                                        {test.passed ? "PASS" : "FAIL"}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-center text-gray-500">
                                            <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No test results available. Run tests to see results here.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>

                        <TabsContent value="migration">
                            {migrationResults ? (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Migration Results</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-600">{migrationResults.migratedFiles}</div>
                                                <div className="text-sm text-gray-600">Files Migrated</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-600">{migrationResults.updatedDocuments}</div>
                                                <div className="text-sm text-gray-600">Documents Updated</div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-red-600">{migrationResults.errors.length}</div>
                                                <div className="text-sm text-gray-600">Errors</div>
                                            </div>
                                        </div>

                                        {migrationResults.errors.length > 0 && (
                                            <div>
                                                <h4 className="font-medium text-red-600 mb-2">Migration Errors:</h4>
                                                <div className="bg-red-50 border border-red-200 rounded p-3 max-h-40 overflow-y-auto">
                                                    {migrationResults.errors.map((error: string, index: number) => (
                                                        <div key={index} className="text-sm text-red-700 mb-1">{error}</div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            ) : (
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="text-center text-gray-500">
                                            <HardDrive className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                            <p>No migration results available. Run migration to see results here.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </TabsContent>
                    </Tabs>

                    {/* Confirmation Dialog */}
                    <Dialog open={!!showConfirmDialog} onOpenChange={() => setShowConfirmDialog(null)}>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>
                                    {showConfirmDialog === 'test' && 'Run Pre-Migration Tests'}
                                    {showConfirmDialog === 'migrate' && 'Start File Migration'}
                                    {showConfirmDialog === 'cleanup' && 'Clean Up Temporary Files'}
                                </DialogTitle>
                            </DialogHeader>
                            <div className="py-4">
                                {showConfirmDialog === 'test' && (
                                    <p>This will run comprehensive tests to validate the migration system. No files will be modified.</p>
                                )}
                                {showConfirmDialog === 'migrate' && (
                                    <div className="space-y-3">
                                        <p className="text-red-600 font-medium">
                                            ⚠️ This will permanently reorganize all files in Firebase Storage.
                                        </p>
                                        <p>
                                            This operation will move {stats?.totalFilesToMigrate} files from user-based to event-based organization.
                                            Ensure you have a backup before proceeding.
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            Estimated time: {stats?.estimatedTime}
                                        </p>
                                    </div>
                                )}
                                {showConfirmDialog === 'cleanup' && (
                                    <p>This will clean up temporary files created during event request submissions. This is a safe operation.</p>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowConfirmDialog(null)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={() => handleConfirmAction(showConfirmDialog!)}
                                    variant={showConfirmDialog === 'migrate' ? 'destructive' : 'default'}
                                >
                                    {showConfirmDialog === 'test' && 'Run Tests'}
                                    {showConfirmDialog === 'migrate' && 'Start Migration'}
                                    {showConfirmDialog === 'cleanup' && 'Start Cleanup'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </main>
        </div>
    );
}