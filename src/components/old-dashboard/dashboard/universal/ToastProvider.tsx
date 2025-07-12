import { Toaster } from 'react-hot-toast';
import { useState, useEffect } from 'react';

// Centralized toast provider to ensure consistent rendering
export default function ToastProvider() {
    const [isMounted, setIsMounted] = useState(false);

    // Only render the Toaster component on the client side
    useEffect(() => {
        setIsMounted(true);
    }, []);

    // Don't render anything during SSR
    if (!isMounted) {
        return null;
    }

    return (
        <Toaster
            position="top-center"
            toastOptions={{
                duration: 4000,
                style: {
                    background: '#333',
                    color: '#fff',
                    borderRadius: '8px',
                    padding: '12px',
                },
                success: {
                    style: {
                        background: 'green',
                    },
                },
                error: {
                    style: {
                        background: 'red',
                    },
                    duration: 2000,
                },
            }}
        />
    );
} 