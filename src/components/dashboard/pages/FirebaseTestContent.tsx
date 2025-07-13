import React, { useState, useEffect } from 'react';
import { Search, Calendar, Bell, User, Database, Play, Trash2, RefreshCw, CheckCircle, XCircle, Plus } from 'lucide-react';
import { FirebaseTestService } from '../services/firebase';

interface TestResult {
    success: boolean;
    message: string;
    data?: any;
    id?: string;
}

interface TestDocument {
    id: string;
    name: string;
    value: string;
    timestamp: any;
    createdBy: string;
}

interface FirebaseEnvStatus {
    isValid: boolean;
    missingVars: string[];
    envStatus: Record<string, boolean>;
}

export default function FirebaseTestContent() {
    const [connectionStatus, setConnectionStatus] = useState<TestResult | null>(null);
    const [testDocuments, setTestDocuments] = useState<TestDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', value: '' });
    const [readId, setReadId] = useState('');
    const [readResult, setReadResult] = useState<TestResult | null>(null);
    const [envStatus, setEnvStatus] = useState<FirebaseEnvStatus | null>(null);
    const [checkingEnv, setCheckingEnv] = useState(false);

    const firebaseService = FirebaseTestService.getInstance();

    useEffect(() => {
        checkEnvironmentVariables();
        // Only load documents if config is valid
    }, []);

    // Load documents only when environment is confirmed valid
    useEffect(() => {
        if (envStatus?.isValid) {
            loadDocuments();
        }
    }, [envStatus?.isValid]);

    const checkEnvironmentVariables = async () => {
        setCheckingEnv(true);
        try {
            const response = await fetch('/api/check-firebase-env');
            const data = await response.json();
            setEnvStatus({
                isValid: data.isValid,
                missingVars: data.missingVars || [],
                envStatus: data.envStatus || {}
            });
        } catch (error) {
            console.error('Failed to check environment variables:', error);
            // Fallback - assume invalid if we can't check
            setEnvStatus({
                isValid: false,
                missingVars: ['Unable to verify environment variables'],
                envStatus: {}
            });
        } finally {
            setCheckingEnv(false);
        }
    };

    const testConnection = async () => {
        if (!envStatus?.isValid) {
            setConnectionStatus({
                success: false,
                message: 'Cannot test connection: Firebase configuration is invalid or missing'
            });
            return;
        }

        setLoading(true);
        try {
            const result = await firebaseService.testConnection();
            setConnectionStatus(result);
        } catch (error) {
            setConnectionStatus({
                success: false,
                message: `Connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            setLoading(false);
        }
    };

    const loadDocuments = async () => {
        if (!envStatus?.isValid) {
            return; // Don't try to load if config is invalid
        }

        setLoading(true);
        try {
            const result = await firebaseService.getAllTestDocuments();
            if (result.success && result.data) {
                setTestDocuments(result.data);
            }
        } catch (error) {
            console.error('Failed to load documents:', error);
        } finally {
            setLoading(false);
        }
    };

    const createDocument = async () => {
        if (!createForm.name || !createForm.value || !envStatus?.isValid) return;

        setLoading(true);
        try {
            const result = await firebaseService.createTestDocument(createForm);
            if (result.success) {
                setCreateForm({ name: '', value: '' });
                await loadDocuments();
            }
        } catch (error) {
            console.error('Failed to create document:', error);
        } finally {
            setLoading(false);
        }
    };

    const readDocument = async () => {
        if (!readId || !envStatus?.isValid) return;

        setLoading(true);
        try {
            const result = await firebaseService.readTestDocument(readId);
            setReadResult(result);
        } catch (error) {
            setReadResult({
                success: false,
                message: `Read failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });
        } finally {
            setLoading(false);
        }
    };

    const deleteDocument = async (id: string) => {
        if (!envStatus?.isValid) return;

        setLoading(true);
        try {
            await firebaseService.deleteTestDocument(id);
            await loadDocuments();
        } catch (error) {
            console.error('Failed to delete document:', error);
        } finally {
            setLoading(false);
        }
    };

    const configValid = envStatus?.isValid ?? false;

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
                                placeholder="Search..."
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

            {/* Firebase Test Content */}
            <main className="p-6">
                <div className="grid grid-cols-1 gap-6">
                    {/* Page Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 mb-2">Firebase Test</h1>
                        <p className="text-gray-600">Test Firebase connectivity and operations</p>
                    </div>

                    {/* Configuration Status */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                            <Database className="w-5 h-5 mr-2" />
                            Configuration Status
                            <button
                                onClick={checkEnvironmentVariables}
                                disabled={checkingEnv}
                                className="ml-auto flex items-center space-x-2 px-3 py-1 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${checkingEnv ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </h2>
                        <div className={`p-4 rounded-lg ${configValid ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <div className="flex items-center">
                                {configValid ? (
                                    <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                                ) : (
                                    <XCircle className="w-5 h-5 text-red-600 mr-2" />
                                )}
                                <span className={`font-medium ${configValid ? 'text-green-800' : 'text-red-800'}`}>
                                    {configValid ? 'Firebase configuration is valid' : 'Firebase configuration is missing or invalid'}
                                </span>
                            </div>
                            {!configValid && envStatus && (
                                <div className="mt-3">
                                    <p className="text-red-700 text-sm font-medium">
                                        Required Firebase environment variables:
                                    </p>
                                    <ul className="text-red-700 text-sm mt-1 ml-4 list-disc">
                                        <li><code>FIREBASE_PROJECT_ID</code> - Your Firebase project ID</li>
                                        <li><code>FIREBASE_CLIENT_EMAIL</code> - Service account email</li>
                                        <li><code>FIREBASE_PRIVATE_KEY</code> - Service account private key</li>
                                        <li><code>FIREBASE_WEB_API_KEY</code> - Web API key from Firebase console</li>
                                    </ul>
                                    {envStatus.missingVars.length > 0 && (
                                        <p className="text-red-700 text-sm mt-2">
                                            <strong>Missing:</strong> {envStatus.missingVars.join(', ')}
                                        </p>
                                    )}
                                    <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                                        <p className="text-yellow-800 text-xs">
                                            💡 <strong>How to fix:</strong> Create a <code>.env</code> file in your project root with the required Firebase credentials from your Firebase project settings.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Connection Test */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Connection Test</h2>
                        <div className="space-y-4">
                            <button
                                onClick={testConnection}
                                disabled={loading || !configValid}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Play className="w-4 h-4" />
                                <span>Test Connection</span>
                                {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
                            </button>

                            {!configValid && (
                                <div className="p-4 rounded-lg bg-yellow-50 border border-yellow-200">
                                    <p className="text-yellow-800 text-sm">
                                        ⚠️ Connection testing is disabled until Firebase configuration is valid.
                                    </p>
                                </div>
                            )}

                            {connectionStatus && (
                                <div className={`p-4 rounded-lg ${connectionStatus.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                    <div className="flex items-center">
                                        {connectionStatus.success ? (
                                            <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                                        ) : (
                                            <XCircle className="w-5 h-5 text-red-600 mr-2" />
                                        )}
                                        <span className={`font-medium ${connectionStatus.success ? 'text-green-800' : 'text-red-800'}`}>
                                            {connectionStatus.message}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Create Document */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Test Document</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <input
                                type="text"
                                placeholder="Document name"
                                value={createForm.name}
                                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={!configValid}
                            />
                            <input
                                type="text"
                                placeholder="Document value"
                                value={createForm.value}
                                onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={!configValid}
                            />
                        </div>
                        <button
                            onClick={createDocument}
                            disabled={loading || !configValid || !createForm.name || !createForm.value}
                            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Document</span>
                        </button>
                    </div>

                    {/* Read Document */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-4">Read Document</h2>
                        <div className="flex space-x-4 mb-4">
                            <input
                                type="text"
                                placeholder="Document ID"
                                value={readId}
                                onChange={(e) => setReadId(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={!configValid}
                            />
                            <button
                                onClick={readDocument}
                                disabled={loading || !configValid || !readId}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Read
                            </button>
                        </div>

                        {readResult && (
                            <div className={`p-4 rounded-lg ${readResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                                <p className={`font-medium ${readResult.success ? 'text-green-800' : 'text-red-800'}`}>
                                    {readResult.message}
                                </p>
                                {readResult.success && readResult.data && (
                                    <pre className="mt-2 text-sm text-gray-700 bg-gray-100 p-2 rounded overflow-auto">
                                        {JSON.stringify(readResult.data, null, 2)}
                                    </pre>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Documents List */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold text-gray-900">Test Documents</h2>
                            <button
                                onClick={loadDocuments}
                                disabled={loading || !configValid}
                                className="flex items-center space-x-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                                <span>Refresh</span>
                            </button>
                        </div>

                        {!configValid ? (
                            <div className="text-center py-8 text-gray-500">
                                <p>Configure Firebase credentials to view and manage test documents.</p>
                            </div>
                        ) : testDocuments.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {testDocuments.map((doc) => (
                                            <tr key={doc.id}>
                                                <td className="px-4 py-2 text-sm font-mono text-gray-900">{doc.id}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900">{doc.name}</td>
                                                <td className="px-4 py-2 text-sm text-gray-900">{doc.value}</td>
                                                <td className="px-4 py-2 text-sm text-gray-500">
                                                    {doc.timestamp?.toDate ? doc.timestamp.toDate().toLocaleDateString() : 'N/A'}
                                                </td>
                                                <td className="px-4 py-2 text-right">
                                                    <button
                                                        onClick={() => deleteDocument(doc.id)}
                                                        className="text-red-600 hover:text-red-900"
                                                        title="Delete document"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-gray-500">
                                No test documents found. Create one to get started.
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
} 