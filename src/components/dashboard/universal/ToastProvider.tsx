import React from 'react';
import { Toaster } from 'react-hot-toast';

// Centralized toast provider to ensure consistent rendering
export default function ToastProvider() {
    return (
        <Toaster
            position="bottom-right"
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
                    duration: 5000,
                },
            }}
        />
    );
} 