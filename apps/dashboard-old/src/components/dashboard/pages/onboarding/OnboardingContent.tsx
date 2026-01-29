import React, { useState, useEffect } from 'react';
import { UserPlus, Mail, List, Lock } from 'lucide-react';
import { useAuthState } from 'react-firebase-hooks/auth';
import { auth, db } from '../../../../firebase/client';
import { doc, getDoc } from 'firebase/firestore';
import type { OnboardingTab } from './types/OnboardingTypes';
import type { UserRole } from '../../shared/types/firestore';
import InvitationFlowTab from './components/InvitationFlowTab';
import DirectOnboardingTab from './components/DirectOnboardingTab';
import PendingInvitationsTab from './components/PendingInvitationsTab';
import { useOnboarding } from './hooks/useOnboarding';
import { Spinner } from '@heroui/react';

export default function OnboardingContent() {
    const [user] = useAuthState(auth);
    const [activeTab, setActiveTab] = useState<OnboardingTab>('invitation');
    const [userRole, setUserRole] = useState<UserRole | null>(null);
    const [checkingPermissions, setCheckingPermissions] = useState(true);

    const {
        invitations,
        stats,
        loading,
        sendInvitation,
        sendDirectOnboarding,
        resendInvitation,
        refreshInvitations,
    } = useOnboarding();

    // Check user permissions
    useEffect(() => {
        const checkPermissions = async () => {
            if (!user) {
                setCheckingPermissions(false);
                return;
            }

            try {
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    const role = userDoc.data().role as UserRole;
                    setUserRole(role);
                }
            } catch (error) {
                console.error('Error checking permissions:', error);
            } finally {
                setCheckingPermissions(false);
            }
        };

        checkPermissions();
    }, [user]);

    // Check if user has permission to access onboarding
    const hasPermission = userRole === 'Executive Officer' || userRole === 'Administrator';

    if (checkingPermissions) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <Spinner size="lg" color="primary" className="mx-auto mb-4" />
                    <p className="text-gray-600">Checking permissions...</p>
                </div>
            </div>
        );
    }

    if (!hasPermission) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="max-w-md w-full mx-4">
                    <div className="bg-white rounded-lg shadow-lg p-8 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <Lock className="w-8 h-8 text-red-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
                        <p className="text-gray-600 mb-6">
                            You don't have permission to access the onboarding page. This page is only accessible to Executive Officers and Administrators.
                        </p>
                        <a
                            href="/"
                            className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Back to Dashboard
                        </a>
                    </div>
                </div>
            </div>
        );
    }

    const tabs = [
        {
            id: 'invitation' as OnboardingTab,
            label: 'Invitation Flow',
            icon: Mail,
            description: 'Send invitations that require acceptance'
        },
        {
            id: 'direct' as OnboardingTab,
            label: 'Direct Onboarding',
            icon: UserPlus,
            description: 'Onboard officers directly without acceptance'
        },
        {
            id: 'pending' as OnboardingTab,
            label: 'Pending Invitations',
            icon: List,
            description: 'View and manage all invitations',
            badge: stats.pendingInvitations > 0 ? stats.pendingInvitations : undefined
        }
    ];

    if (!user) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <p className="text-gray-500">Please sign in to access onboarding.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto">
            {/* Main Content */}
            <main className="p-4 md:p-6">
                {/* Tab Navigation */}
                <div className="mb-6">
                    <div className="border-b border-gray-200">
                        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                            {tabs.map((tab) => {
                                const Icon = tab.icon;
                                const isActive = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => {
                                            setActiveTab(tab.id);
                                        }}
                                        className={`
                                            group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                                            ${isActive
                                                ? 'border-blue-500 text-blue-600'
                                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                            }
                                        `}
                                    >
                                        <Icon
                                            className={`
                                                -ml-0.5 mr-2 h-5 w-5
                                                ${isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}
                                            `}
                                        />
                                        <span>{tab.label}</span>
                                        {tab.badge !== undefined && (
                                            <span className="ml-2 py-0.5 px-2 rounded-full text-xs font-medium bg-blue-100 text-blue-600">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Tab Description */}
                    <div className="mt-2">
                        <p className="text-sm text-gray-500">
                            {tabs.find(t => t.id === activeTab)?.description}
                        </p>
                    </div>
                </div>

                {/* Tab Content */}
                <div className="mt-6">
                    {activeTab === 'invitation' && (
                        <InvitationFlowTab
                            onSendInvitation={sendInvitation}
                            loading={loading}
                        />
                    )}

                    {activeTab === 'direct' && (
                        <DirectOnboardingTab
                            onSendOnboarding={sendDirectOnboarding}
                            loading={loading}
                        />
                    )}

                    {activeTab === 'pending' && (
                        <PendingInvitationsTab
                            invitations={invitations}
                            loading={loading}
                            onRefresh={refreshInvitations}
                            onResend={resendInvitation}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}

