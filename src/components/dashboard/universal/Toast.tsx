import React from 'react';
import { Toaster } from 'react-hot-toast';

// This is just a wrapper component to make react-hot-toast work with Astro
const Toast: React.FC = () => {
    return (
        <Toaster
            position="top-center"
            toastOptions={{
                duration: 3000,
                className: 'backdrop-blur-sm',
                style: {
                    background: 'hsl(var(--b2, 0 0% 90%))',
                    color: 'hsl(var(--bc, 0 0% 20%))',
                    padding: '16px',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    borderRadius: '0.75rem',
                },
                success: {
                    style: {
                        background: 'hsl(var(--su, 120 100% 90%))',
                        border: '1px solid hsl(var(--su, 120 100% 25%))',
                    },
                    iconTheme: {
                        primary: 'hsl(var(--su, 120 100% 25%))',
                        secondary: 'hsl(var(--b1, 0 0% 100%))',
                    },
                },
                error: {
                    style: {
                        background: 'hsl(var(--er, 0 100% 90%))',
                        border: '1px solid hsl(var(--er, 0 100% 25%))',
                    },
                    iconTheme: {
                        primary: 'hsl(var(--er, 0 100% 25%))',
                        secondary: 'hsl(var(--b1, 0 0% 100%))',
                    },
                },
            }}
        />
    );
};

export default Toast; 