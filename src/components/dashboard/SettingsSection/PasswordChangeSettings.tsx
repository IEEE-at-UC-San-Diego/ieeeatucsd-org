import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Authentication } from '../../../scripts/pocketbase/Authentication';
import { SendLog } from '../../../scripts/pocketbase/SendLog';

interface PasswordChangeSettingsProps {
    logtoAppId?: string;
    logtoAppSecret?: string;
    logtoEndpoint?: string;
    logtoTokenEndpoint?: string;
    logtoApiEndpoint?: string;
}

export default function PasswordChangeSettings({
    logtoAppId: propLogtoAppId,
    logtoAppSecret: propLogtoAppSecret,
    logtoEndpoint: propLogtoEndpoint,
    logtoTokenEndpoint: propLogtoTokenEndpoint,
    logtoApiEndpoint: propLogtoApiEndpoint
}: PasswordChangeSettingsProps) {
    const auth = Authentication.getInstance();
    const logger = SendLog.getInstance();
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingEnv, setIsCheckingEnv] = useState(false);
    const [useFormSubmission, setUseFormSubmission] = useState(false); // Default to using JSON
    const [formData, setFormData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [logtoUserId, setLogtoUserId] = useState('');
    const [debugInfo, setDebugInfo] = useState<any>(null);

    // Access environment variables directly
    const envLogtoAppId = import.meta.env.LOGTO_APP_ID;
    const envLogtoAppSecret = import.meta.env.LOGTO_APP_SECRET;
    const envLogtoEndpoint = import.meta.env.LOGTO_ENDPOINT;
    const envLogtoTokenEndpoint = import.meta.env.LOGTO_TOKEN_ENDPOINT;
    const envLogtoApiEndpoint = import.meta.env.LOGTO_API_ENDPOINT;

    // Use environment variables or props (fallback)
    const logtoAppId = envLogtoAppId || propLogtoAppId;
    const logtoAppSecret = envLogtoAppSecret || propLogtoAppSecret;
    const logtoEndpoint = envLogtoEndpoint || propLogtoEndpoint;
    const logtoTokenEndpoint = envLogtoTokenEndpoint || propLogtoTokenEndpoint;
    const logtoApiEndpoint = envLogtoApiEndpoint || propLogtoApiEndpoint;



    // Get the user's Logto ID on component mount
    useEffect(() => {
        const fetchLogtoUserId = async () => {
            try {
                const user = auth.getCurrentUser();
                if (!user) {
                    // Don't show error on dashboard page for unauthenticated users
                    if (!window.location.pathname.includes('/dashboard')) {
                        console.error("User not authenticated");
                        toast.error("You must be logged in to change your password");
                    }
                    return;
                }

                // console.log("Current user:", user);
                const pb = auth.getPocketBase();

                try {
                    const externalAuthRecord = await pb.collection('_externalAuths').getFirstListItem(`recordRef="${user.id}" && provider="oidc"`);
                    // console.log("Found external auth record:", externalAuthRecord);

                    const userId = externalAuthRecord.providerId;
                    if (userId) {
                        setLogtoUserId(userId);
                        // console.log("Set Logto user ID:", userId);
                    } else {
                        console.error("No providerId found in external auth record");
                        toast.error("Could not determine your user ID. Please try again later or contact support.");
                    }
                } catch (error) {
                    console.error("Error fetching external auth record:", error);
                    toast.error("Error retrieving your user information. Please try again later.");

                    // Try to get more information about the error
                    if (error instanceof Error) {
                        console.error("Error details:", error.message);
                        if ('data' in error) {
                            console.error("Error data:", (error as any).data);
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching Logto user ID:", error);
                toast.error("Error retrieving your user information. Please try again later.");
            }
        };

        fetchLogtoUserId();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const validateForm = () => {
        if (!formData.currentPassword) {
            toast.error('Current password is required');
            return false;
        }
        if (!formData.newPassword) {
            toast.error('New password is required');
            return false;
        }
        if (formData.newPassword.length < 8) {
            toast.error('New password must be at least 8 characters long');
            return false;
        }
        if (formData.newPassword !== formData.confirmPassword) {
            toast.error('New passwords do not match');
            return false;
        }
        if (!logtoUserId) {
            toast.error('Could not determine your user ID. Please try again later.');
            return false;
        }
        return true;
    };

    const checkEnvironmentVariables = async () => {
        setIsCheckingEnv(true);
        try {
            const response = await fetch('/api/check-env');
            const data = await response.json();
            // console.log("Environment variables status:", data);

            // Check if all required environment variables are set
            const { envStatus } = data;
            const missingVars = Object.entries(envStatus)
                .filter(([_, isSet]) => !isSet)
                .map(([name]) => name);

            if (missingVars.length > 0) {
                toast.error(`Missing environment variables: ${missingVars.join(', ')}`);
            } else {
                toast.success('All environment variables are set');
            }
        } catch (error) {
            console.error("Error checking environment variables:", error);
            toast.error('Failed to check environment variables');
        } finally {
            setIsCheckingEnv(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setDebugInfo(null);

        try {
            if (useFormSubmission) {
                // Use a traditional form submission approach
                const formElement = document.createElement('form');
                formElement.method = 'POST';
                formElement.action = '/api/change-password';
                formElement.enctype = 'application/x-www-form-urlencoded';

                // Add the userId field
                const userIdField = document.createElement('input');
                userIdField.type = 'hidden';
                userIdField.name = 'userId';
                userIdField.value = logtoUserId;
                formElement.appendChild(userIdField);

                // Add the newPassword field
                const newPasswordField = document.createElement('input');
                newPasswordField.type = 'hidden';
                newPasswordField.name = 'newPassword';
                newPasswordField.value = formData.newPassword;
                formElement.appendChild(newPasswordField);

                // If not using hardcoded endpoint, add the Logto credentials

                const logtoAppIdField = document.createElement('input');
                logtoAppIdField.type = 'hidden';
                logtoAppIdField.name = 'logtoAppId';
                logtoAppIdField.value = logtoAppId;
                formElement.appendChild(logtoAppIdField);

                const logtoAppSecretField = document.createElement('input');
                logtoAppSecretField.type = 'hidden';
                logtoAppSecretField.name = 'logtoAppSecret';
                logtoAppSecretField.value = logtoAppSecret;
                formElement.appendChild(logtoAppSecretField);

                const logtoTokenEndpointField = document.createElement('input');
                logtoTokenEndpointField.type = 'hidden';
                logtoTokenEndpointField.name = 'logtoTokenEndpoint';
                logtoTokenEndpointField.value = logtoTokenEndpoint;
                formElement.appendChild(logtoTokenEndpointField);

                const logtoApiEndpointField = document.createElement('input');
                logtoApiEndpointField.type = 'hidden';
                logtoApiEndpointField.name = 'logtoApiEndpoint';
                logtoApiEndpointField.value = logtoApiEndpoint;
                formElement.appendChild(logtoApiEndpointField);


                // Create an iframe to handle the form submission
                const iframe = document.createElement('iframe');
                iframe.name = 'password-change-frame';
                iframe.style.display = 'none';
                document.body.appendChild(iframe);

                // Set up the iframe load event to handle the response
                iframe.onload = async () => {
                    try {
                        // Try to get the response from the iframe
                        const iframeDocument = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDocument) {
                            const responseText = iframeDocument.body.innerText;
                            // console.log("Response from iframe:", responseText);

                            if (responseText) {
                                try {
                                    const result = JSON.parse(responseText);
                                    if (result.success) {
                                        // Log the password change
                                        await logger.send('update', 'password', 'User changed their password');

                                        toast.success('Password changed successfully');

                                        // Clear form
                                        setFormData({
                                            currentPassword: '',
                                            newPassword: '',
                                            confirmPassword: '',
                                        });
                                    } else {
                                        toast.error(result.message || 'Failed to change password');
                                    }
                                } catch (error) {
                                    console.error("Error parsing response:", error);
                                    toast.error('Failed to parse response from server');
                                }
                            } else {
                                // If no response text, assume success
                                // Log the password change
                                await logger.send('update', 'password', 'User changed their password');

                                toast.success('Password changed successfully');

                                // Clear form
                                setFormData({
                                    currentPassword: '',
                                    newPassword: '',
                                    confirmPassword: '',
                                });
                            }
                        } else {
                            console.error("Could not access iframe document");
                            toast.error('Could not access response from server');
                        }
                    } catch (error) {
                        console.error("Error handling iframe response:", error);
                        toast.error('Error handling response from server');
                    } finally {
                        // Clean up
                        document.body.removeChild(iframe);
                        setIsLoading(false);
                    }
                };

                // Set the target to the iframe
                formElement.target = 'password-change-frame';

                // Append the form to the document, submit it, and then remove it
                document.body.appendChild(formElement);
                formElement.submit();
                document.body.removeChild(formElement);

                // Note: setIsLoading(false) is called in the iframe.onload handler
            } else {
                // Use the fetch API with JSON
                const endpoint = '/api/change-password';
                // console.log(`Calling server-side API endpoint: ${endpoint}`);

                // Ensure we have the Logto user ID
                if (!logtoUserId) {
                    console.error("Logto user ID is missing");
                    throw new Error("User ID is missing. Please try again or contact support.");
                }

                // Log the values we're about to use
                // console.log("Values being used for API call:");
                // console.log("- logtoUserId:", logtoUserId);
                // console.log("- newPassword:", formData.newPassword ? "[PRESENT]" : "[MISSING]");
                // console.log("- logtoAppId:", logtoAppId);
                // console.log("- logtoAppSecret:", logtoAppSecret ? "[PRESENT]" : "[MISSING]");
                // console.log("- logtoTokenEndpoint:", logtoTokenEndpoint);
                // console.log("- logtoApiEndpoint:", logtoApiEndpoint);

                // Prepare request data with explicit values (not relying on variable references that might be undefined)
                const requestData = {
                    userId: logtoUserId,
                    currentPassword: formData.currentPassword,
                    newPassword: formData.newPassword,
                    logtoAppId: logtoAppId || "",
                    logtoAppSecret: logtoAppSecret || "",
                    logtoTokenEndpoint: logtoTokenEndpoint || `${logtoEndpoint}/oidc/token`,
                    logtoApiEndpoint: logtoApiEndpoint || logtoEndpoint
                };

                // console.log("Request data:", {
                //     ...requestData,
                //     currentPassword: "[REDACTED]",
                //     newPassword: "[REDACTED]",
                //     logtoAppSecret: "[REDACTED]"
                // });

                // Validate request data before sending
                if (!requestData.userId) {
                    throw new Error("Missing userId. Please try again or contact support.");
                }

                if (!requestData.newPassword) {
                    throw new Error("Missing newPassword. Please enter a new password.");
                }

                if (!requestData.logtoAppId) {
                    throw new Error("Missing logtoAppId configuration. Please contact support.");
                }
                if (!requestData.logtoAppSecret) {
                    throw new Error("Missing logtoAppSecret configuration. Please contact support.");
                }
                if (!requestData.logtoTokenEndpoint) {
                    throw new Error("Missing logtoTokenEndpoint configuration. Please contact support.");
                }
                if (!requestData.logtoApiEndpoint) {
                    throw new Error("Missing logtoApiEndpoint configuration. Please contact support.");
                }


                // Stringify the request data to ensure it's valid JSON
                const requestBody = JSON.stringify(requestData);
                // console.log("Request body (stringified):", requestBody);

                // Create a debug object to display in the UI
                const debugObj = {
                    endpoint,
                    requestData,
                    requestBody,
                    logtoUserId,
                    hasNewPassword: !!formData.newPassword,
                    hasLogtoAppId: !!logtoAppId,
                    hasLogtoAppSecret: !!logtoAppSecret,
                    hasLogtoTokenEndpoint: !!logtoTokenEndpoint,
                    hasLogtoApiEndpoint: !!logtoApiEndpoint
                };
                setDebugInfo(debugObj);

                // Call our server-side API endpoint to change the password
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: requestBody
                });

                // console.log("Response status:", response.status);

                // Process the response
                let result: any;
                try {
                    const responseText = await response.text();
                    // console.log("Raw response:", responseText);

                    if (responseText) {
                        result = JSON.parse(responseText);
                    } else {
                        result = { success: false, message: 'Empty response from server' };
                    }

                    // console.log("API response:", result);

                    // Add response to debug info
                    setDebugInfo((prev: any) => ({
                        ...prev,
                        responseStatus: response.status,
                        responseText,
                        parsedResponse: result
                    }));
                } catch (error) {
                    console.error("Error parsing API response:", error);
                    setDebugInfo((prev: any) => ({
                        ...prev,
                        responseError: error instanceof Error ? error.message : String(error)
                    }));
                    throw new Error(`Invalid response from server: ${error instanceof Error ? error.message : String(error)}`);
                }

                // Check if the request was successful
                if (response.ok && result.success) {
                    // Log the password change
                    await logger.send('update', 'password', 'User changed their password');

                    toast.success('Password changed successfully');

                    // Clear form
                    setFormData({
                        currentPassword: '',
                        newPassword: '',
                        confirmPassword: '',
                    });
                } else {
                    throw new Error(result.message || `Failed to change password: ${response.status}`);
                }

                setIsLoading(false);
            }
        } catch (error) {
            console.error('Error changing password:', error);
            toast.error(error instanceof Error ? error.message : 'Failed to change password');
            setIsLoading(false);
        }
    };

    return (
        <div>
            {process.env.NODE_ENV === 'development' && (
                <div className="mb-4 p-3 bg-base-200 rounded-lg">
                    <h4 className="text-sm font-semibold mb-2">Debug Tools (Development Only)</h4>
                    <div className="flex flex-wrap gap-2 mb-2">
                        <button
                            type="button"
                            className={`btn btn-sm btn-info ${isCheckingEnv ? 'loading' : ''}`}
                            onClick={checkEnvironmentVariables}
                            disabled={isCheckingEnv}
                        >
                            Check Environment Variables
                        </button>
                        <button
                            type="button"
                            className="btn btn-sm btn-warning"
                            onClick={() => {
                                // console.log("Debug Info:");
                                // console.log("- logtoUserId:", logtoUserId);
                                // console.log("- Environment Variables:");
                                // console.log("  - LOGTO_APP_ID:", import.meta.env.LOGTO_APP_ID);
                                // console.log("  - LOGTO_ENDPOINT:", import.meta.env.LOGTO_ENDPOINT);
                                // console.log("  - LOGTO_TOKEN_ENDPOINT:", import.meta.env.LOGTO_TOKEN_ENDPOINT);
                                // console.log("  - LOGTO_API_ENDPOINT:", import.meta.env.LOGTO_API_ENDPOINT);

                                toast.success("Debug info logged to console");
                            }}
                        >
                            Log Debug Info
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${!useFormSubmission ? 'btn-success' : 'btn-outline'}`}
                            onClick={() => setUseFormSubmission(false)}
                        >
                            Use JSON API
                        </button>
                    </div>
                    <div className="mt-2 text-xs">
                        <p>Using fixed LogTo implementation with {useFormSubmission ? 'form submission' : 'JSON'}</p>
                        <p>Logto User ID: {logtoUserId || 'Not found'}</p>
                    </div>

                    {debugInfo && (
                        <div className="mt-4 border-t pt-2">
                            <p className="font-semibold">Debug Info:</p>
                            <div className="overflow-auto max-h-60 bg-base-300 p-2 rounded-sm text-xs">
                                <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Current Password</span>
                    </label>
                    <input
                        type="password"
                        name="currentPassword"
                        value={formData.currentPassword}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        required
                    />
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="label-text">New Password</span>
                    </label>
                    <input
                        type="password"
                        name="newPassword"
                        value={formData.newPassword}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        required
                        minLength={8}
                    />
                    <label className="label">
                        <span className="label-text-alt">Password must be at least 8 characters long</span>
                    </label>
                </div>

                <div className="form-control">
                    <label className="label">
                        <span className="label-text">Confirm New Password</span>
                    </label>
                    <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        className="input input-bordered w-full"
                        required
                    />
                </div>

                <div className="form-control mt-6">
                    <button
                        type="submit"
                        className={`btn btn-primary ${isLoading ? 'loading' : ''}`}
                        disabled={isLoading}
                    >
                        {isLoading ? 'Changing Password...' : 'Change Password'}
                    </button>
                </div>
            </form>
        </div>
    );
} 