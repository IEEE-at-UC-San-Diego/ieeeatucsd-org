import React from 'react';
import { Icon } from '@iconify/react';

export const showLoadingToast = () => (
    <div className="alert alert-info">
        <Icon icon="mdi:loading" className="h-6 w-6 animate-spin" />
        <span>Submitting event request...</span>
    </div>
);

export const showSuccessToast = (message: string) => (
    <div className="alert alert-success">
        <Icon icon="mdi:check-circle" className="h-6 w-6" />
        <span>{message}</span>
    </div>
);

export const showErrorToast = (message: string) => (
    <div className="alert alert-error">
        <Icon icon="mdi:error" className="h-6 w-6" />
        <span>{message}</span>
    </div>
);

export const showWarningToast = (message: string) => (
    <div className="alert alert-warning">
        <Icon icon="mdi:warning" className="h-6 w-6" />
        <span>{message}</span>
    </div>
);

export const showInfoToast = (message: string) => (
    <div className="alert alert-info">
        <Icon icon="mdi:information" className="h-6 w-6" />
        <span>{message}</span>
    </div>
); 