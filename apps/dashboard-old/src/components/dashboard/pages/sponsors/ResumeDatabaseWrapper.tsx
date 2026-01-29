import React from 'react';
import { useAuth } from '../../../../hooks/useAuth';
import { SponsorPermissionService } from './utils/sponsorPermissions';
import ResumeDatabaseTabs from './ResumeDatabaseTabs';
import ResumeDatabaseContent from './ResumeDatabaseContent';
import SponsorInformation from './SponsorInformation';
import { AlertCircle } from 'lucide-react';
import { Spinner } from '@heroui/react';

export default function ResumeDatabaseWrapper() {
    const { userRole, loading } = useAuth();

    if (loading) {
        return (
            <div className="flex-1 overflow-auto p-6">
                <div className="flex items-center justify-center py-12">
                    <Spinner size="lg" color="primary" />
                </div>
            </div>
        );
    }

    // Check if user has access
    if (userRole && !SponsorPermissionService.hasSponsorAccess(userRole)) {
        return (
            <div className="flex-1 overflow-auto p-6">
                <div className="bg-red-50 border border-red-200 rounded-xl p-6">
                    <div className="flex items-center">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                        <div className="ml-4">
                            <h3 className="text-lg font-semibold text-red-800">Access Restricted</h3>
                            <p className="text-red-700">Only Sponsors and Administrators can access the resume database.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-auto p-6">
            <ResumeDatabaseTabs>
                <ResumeDatabaseContent />
                <SponsorInformation />
            </ResumeDatabaseTabs>
        </div>
    );
}

