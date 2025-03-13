import { useState, useEffect } from "react";
import { Authentication } from "../../../scripts/pocketbase/Authentication";
import type { User } from "../../../schemas/pocketbase/schema";
import FirstTimeLoginPopup from "./FirstTimeLoginPopup";

interface FirstTimeLoginManagerProps {
    logtoApiEndpoint?: string;
}

const FirstTimeLoginManager = ({ logtoApiEndpoint }: FirstTimeLoginManagerProps) => {
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

                // Using the new method to check if user has signed up
                const isSignedUp = auth.isUserSignedUp();
                console.log("User signed up status:", isSignedUp);

                // If not signed up, show onboarding
                setShowOnboarding(!isSignedUp);
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

    if (isLoading || !showOnboarding) {
        return null;
    }

    return (
        <FirstTimeLoginPopup
            logtoApiEndpoint={logtoApiEndpoint}
            onComplete={handleOnboardingComplete}
        />
    );
};

export default FirstTimeLoginManager; 