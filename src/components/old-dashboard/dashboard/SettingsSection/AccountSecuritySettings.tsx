import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { SendLog } from '../../../scripts/pocketbase/SendLog';
import { toast } from 'react-hot-toast';
import PasswordChangeSettings from './PasswordChangeSettings';

interface AccountSecuritySettingsProps {
    logtoAppId: string;
    logtoAppSecret: string;
    logtoEndpoint: string;
    logtoTokenEndpoint: string;
    logtoApiEndpoint: string;
}

export default function AccountSecuritySettings({
    logtoAppId,
    logtoAppSecret,
    logtoEndpoint,
    logtoTokenEndpoint,
    logtoApiEndpoint
}: AccountSecuritySettingsProps) {
    const auth = Authentication.getInstance();
    const logger = SendLog.getInstance();
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [sessionInfo, setSessionInfo] = useState({
        lastLogin: '',
        browser: '',
        device: '',
    });

    useEffect(() => {
        const checkAuth = () => {
            const authenticated = auth.isAuthenticated();
            setIsAuthenticated(authenticated);

            if (authenticated) {
                const user = auth.getCurrentUser();
                if (user) {
                    // Get last login time
                    const lastLogin = user.last_login || user.updated;

                    // Get browser and device info
                    const userAgent = navigator.userAgent;
                    const browser = detectBrowser(userAgent);
                    const device = detectDevice(userAgent);

                    setSessionInfo({
                        lastLogin: formatDate(lastLogin),
                        browser,
                        device,
                    });
                }
            }

            setLoading(false);
        };

        checkAuth();
    }, []);

    // No logout functions needed here as logout is handled in the dashboard menu

    const detectBrowser = (userAgent: string): string => {
        if (userAgent.indexOf('Chrome') > -1) return 'Chrome';
        if (userAgent.indexOf('Safari') > -1) return 'Safari';
        if (userAgent.indexOf('Firefox') > -1) return 'Firefox';
        if (userAgent.indexOf('MSIE') > -1 || userAgent.indexOf('Trident') > -1) return 'Internet Explorer';
        if (userAgent.indexOf('Edge') > -1) return 'Edge';
        return 'Unknown Browser';
    };

    const detectDevice = (userAgent: string): string => {
        if (/Android/i.test(userAgent)) return 'Android Device';
        if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS Device';
        if (/Windows/i.test(userAgent)) return 'Windows Device';
        if (/Mac/i.test(userAgent)) return 'Mac Device';
        if (/Linux/i.test(userAgent)) return 'Linux Device';
        return 'Unknown Device';
    };

    const formatDate = (dateString: string): string => {
        if (!dateString) return 'Unknown';

        const date = new Date(dateString);
        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
        }).format(date);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-8">
                <div className="loading loading-spinner loading-lg"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return (
            <div className="p-4 text-error bg-error bg-opacity-10 rounded-lg">
                <span>You must be logged in to access this page.</span>
            </div>
        );
    }

    return (
        <div>
            <div className="space-y-6">
                {/* Current Session Information */}
                <div className="bg-base-200 p-4 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">Current Session</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm opacity-70">Last Login</p>
                            <p className="font-medium">{sessionInfo.lastLogin}</p>
                        </div>
                        <div>
                            <p className="text-sm opacity-70">Browser</p>
                            <p className="font-medium">{sessionInfo.browser}</p>
                        </div>
                        <div>
                            <p className="text-sm opacity-70">Device</p>
                            <p className="font-medium">{sessionInfo.device}</p>
                        </div>
                    </div>
                </div>

                {/* Password Change Section */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Change Password</h4>
                    <p className="text-sm opacity-70 mb-4">
                        Update your account password. For security reasons, you'll need to provide your current password.
                    </p>
                    <div className="rounded-md bg-yellow-600 p-4 mb-4">
                        <div className="flex">
                            <div className="ml-3">
                                <p className="text-sm text-white">
                                    Please note: This will only update your password for the IEEE UCSD SSO. This will not update the password for your @ieeeucsd.org mail account.
                                </p>
                            </div>
                        </div>
                    </div>
                    <PasswordChangeSettings
                        logtoAppId={logtoAppId}
                        logtoAppSecret={logtoAppSecret}
                        logtoEndpoint={logtoEndpoint}
                        logtoTokenEndpoint={logtoTokenEndpoint}
                        logtoApiEndpoint={logtoApiEndpoint}
                    />
                </div>

                {/* Authentication Options */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Authentication Options</h4>
                    <p className="text-sm opacity-70 mb-4">
                        IEEE UCSD uses Single Sign-On (SSO) for authentication.
                        Password management is handled through your IEEEUCSD account.
                    </p>
                </div>

                {/* Account Actions */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Account Actions</h4>

                    <div className="space-y-4">
                        <p className="text-sm text-warning p-3 bg-warning bg-opacity-10 rounded-lg">
                            If you need to delete your account or have other account-related issues,
                            please contact an IEEE UCSD administrator.
                        </p>
                        <p className="text-sm text-info p-3 bg-info bg-opacity-10 rounded-lg">
                            To log out of your account, use the Logout option in the dashboard menu.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
} 