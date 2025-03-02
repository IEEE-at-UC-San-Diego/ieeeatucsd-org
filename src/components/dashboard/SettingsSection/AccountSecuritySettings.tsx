import { useState, useEffect } from 'react';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { SendLog } from '../../../scripts/pocketbase/SendLog';
import { toast } from 'react-hot-toast';

export default function AccountSecuritySettings() {
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

    const handleLogout = async () => {
        try {
            await logger.send('logout', 'auth', 'User manually logged out from settings page');
            await auth.logout();
            window.location.href = '/';
        } catch (error) {
            console.error('Error during logout:', error);
            toast.error('Failed to log out. Please try again.');
        }
    };

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

                {/* Authentication Options */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Authentication Options</h4>
                    <p className="text-sm opacity-70 mb-4">
                        IEEE UCSD uses Single Sign-On (SSO) for authentication.
                        Password management is handled through your IEEEUCSD account.
                    </p>

                    <p className="text-sm text-info p-3 bg-info bg-opacity-10 rounded-lg">
                        To change your password, please use the "Forgot Password" option on the login page.
                    </p>
                </div>

                {/* Account Actions */}
                <div>
                    <h4 className="font-semibold text-lg mb-2">Account Actions</h4>

                    <div className="space-y-4">
                        <button
                            onClick={handleLogout}
                            className="btn btn-error btn-outline w-full md:w-auto"
                        >
                            Sign Out
                        </button>

                        <p className="text-sm text-warning p-3 bg-warning bg-opacity-10 rounded-lg">
                            If you need to delete your account or have other account-related issues,
                            please contact an IEEE UCSD administrator.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
} 