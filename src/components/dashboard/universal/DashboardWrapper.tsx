import { useState, useEffect } from "react";
import type { ReactNode } from "react";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import type { User } from "../../../schemas/pocketbase/schema";
import FirstTimeLoginPopup from "./FirstTimeLoginPopup";

interface DashboardWrapperProps {
    children: ReactNode;
    logtoApiEndpoint?: string;
}

const DashboardWrapper = ({ children, logtoApiEndpoint }: DashboardWrapperProps) => {
    const [showOnboarding, setShowOnboarding] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkUserStatus = async () => {
            try {
                const auth = Authentication.getInstance();
                if (!auth.isAuthenticated()) {
                    // Not logged in, so don't show onboarding
                    setIsLoading(false);
                    return;
                }

                const userData = auth.getCurrentUser() as User | null;

                if (userData) {
                    // If signed_up is explicitly false, show onboarding
                    setShowOnboarding(userData.signed_up === false);
                }
            } catch (error) {
                console.error("Error checking user status:", error);
            } finally {
                setIsLoading(false);
            }
        };

        checkUserStatus();
    }, []);

    const handleOnboardingComplete = () => {
        setShowOnboarding(false);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <span className="loading loading-spinner loading-lg text-primary"></span>
            </div>
        );
    }

    return (
        <>
            {showOnboarding && (
                <FirstTimeLoginPopup
                    logtoApiEndpoint={logtoApiEndpoint}
                    onComplete={handleOnboardingComplete}
                />
            )}
            {children}
        </>
    );
};

export default DashboardWrapper; 