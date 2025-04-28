import React from 'react';
import { Icon } from "@iconify/react";

export type AlertType = 'info' | 'success' | 'warning' | 'error';

interface CustomAlertProps {
    type: AlertType;
    title: string;
    message: string;
    icon?: string;
    actionLabel?: string;
    onAction?: () => void;
    onClose?: () => void;
    className?: string;
}

const CustomAlert: React.FC<CustomAlertProps> = ({
    type,
    title,
    message,
    icon,
    actionLabel,
    onAction,
    onClose,
    className = '',
}) => {
    // Default icons based on alert type
    const defaultIcons = {
        info: 'heroicons:information-circle',
        success: 'heroicons:check-circle',
        warning: 'heroicons:exclamation-triangle',
        error: 'heroicons:document-text',
    };

    // Colors based on alert type
    const colors = {
        info: {
            bg: 'bg-info/10',
            border: 'border-info',
            iconBg: 'bg-info/20',
            iconColor: 'text-info',
            actionBg: 'bg-info',
            actionHover: 'hover:bg-info-focus',
            actionRing: 'focus:ring-info',
        },
        success: {
            bg: 'bg-success/10',
            border: 'border-success',
            iconBg: 'bg-success/20',
            iconColor: 'text-success',
            actionBg: 'bg-success',
            actionHover: 'hover:bg-success-focus',
            actionRing: 'focus:ring-success',
        },
        warning: {
            bg: 'bg-warning/10',
            border: 'border-warning',
            iconBg: 'bg-warning/20',
            iconColor: 'text-warning',
            actionBg: 'bg-warning',
            actionHover: 'hover:bg-warning-focus',
            actionRing: 'focus:ring-warning',
        },
        error: {
            bg: 'bg-error/10',
            border: 'border-error',
            iconBg: 'bg-error/20',
            iconColor: 'text-error',
            actionBg: 'bg-error',
            actionHover: 'hover:bg-error-focus',
            actionRing: 'focus:ring-error',
        },
    };

    const color = colors[type];
    const selectedIcon = icon || defaultIcons[type];

    return (
        <div className={`${color.bg} border-l-4 ${color.border} p-4 rounded-lg shadow-md ${className}`}>
            <div className="flex items-center justify-between">
                <div className="flex items-start space-x-3">
                    <div className="shrink-0 mt-0.5">
                        <div className={`p-1.5 ${color.iconBg} rounded-full`}>
                            <Icon
                                icon={selectedIcon}
                                className={`h-5 w-5 ${color.iconColor}`}
                            />
                        </div>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white mb-1">
                            {title}
                        </h3>
                        <p className="text-sm text-base-content/80">
                            {message}
                        </p>
                    </div>
                </div>
                <div className="flex items-center space-x-2">
                    {actionLabel && onAction && (
                        <button
                            onClick={onAction}
                            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-xs text-white ${color.actionBg} ${color.actionHover} focus:outline-hidden focus:ring-2 focus:ring-offset-2 ${color.actionRing} transition-colors duration-200`}
                        >
                            {actionLabel}
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="p-1 rounded-full hover:bg-base-300/20 transition-colors duration-200"
                            aria-label="Close"
                        >
                            <Icon
                                icon="heroicons:x-mark"
                                className="h-5 w-5 text-base-content/60"
                            />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CustomAlert; 