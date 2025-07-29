import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface MobileModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
    showCloseButton?: boolean;
    closeOnBackdrop?: boolean;
}

export default function MobileModal({
    isOpen,
    onClose,
    title,
    children,
    size = 'md',
    showCloseButton = true,
    closeOnBackdrop = true
}: MobileModalProps) {
    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-lg',
        xl: 'max-w-xl',
        full: 'max-w-full'
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />
            
            {/* Modal */}
            <div className={`
                relative bg-white rounded-lg shadow-xl 
                w-full mx-4 my-4 
                max-h-[calc(100vh-2rem)] 
                ${sizeClasses[size]}
                md:mx-auto md:my-8
                flex flex-col
                transform transition-all duration-300 ease-out
            `}>
                {/* Header */}
                <div className="flex items-center justify-between p-4 md:p-6 border-b border-gray-200 flex-shrink-0">
                    <h2 className="text-lg md:text-xl font-semibold text-gray-900 truncate pr-4">
                        {title}
                    </h2>
                    {showCloseButton && (
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center flex-shrink-0"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 md:p-6">
                    {children}
                </div>
            </div>
        </div>
    );
}

// Mobile-optimized form modal
interface MobileFormModalProps extends Omit<MobileModalProps, 'children'> {
    children: React.ReactNode;
    onSubmit?: (e: React.FormEvent) => void;
    submitLabel?: string;
    cancelLabel?: string;
    isSubmitting?: boolean;
    submitDisabled?: boolean;
    showFooter?: boolean;
}

export function MobileFormModal({
    isOpen,
    onClose,
    title,
    children,
    onSubmit,
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
    isSubmitting = false,
    submitDisabled = false,
    showFooter = true,
    size = 'md',
    showCloseButton = true,
    closeOnBackdrop = true
}: MobileFormModalProps) {
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (onSubmit && !isSubmitting && !submitDisabled) {
            onSubmit(e);
        }
    };

    return (
        <MobileModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size={size}
            showCloseButton={showCloseButton}
            closeOnBackdrop={closeOnBackdrop && !isSubmitting}
        >
            <form onSubmit={handleSubmit} className="flex flex-col h-full">
                <div className="flex-1 space-y-4 md:space-y-6">
                    {children}
                </div>
                
                {showFooter && (
                    <div className="flex flex-col sm:flex-row gap-3 pt-4 md:pt-6 border-t border-gray-200 mt-4 md:mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-base"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || submitDisabled}
                            className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-base"
                        >
                            {isSubmitting ? 'Saving...' : submitLabel}
                        </button>
                    </div>
                )}
            </form>
        </MobileModal>
    );
}

// Mobile-optimized confirmation modal
interface MobileConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    isLoading?: boolean;
}

export function MobileConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'info',
    isLoading = false
}: MobileConfirmModalProps) {
    const variantStyles = {
        danger: 'bg-red-600 hover:bg-red-700',
        warning: 'bg-yellow-600 hover:bg-yellow-700',
        info: 'bg-blue-600 hover:bg-blue-700'
    };

    return (
        <MobileModal
            isOpen={isOpen}
            onClose={onClose}
            title={title}
            size="sm"
            closeOnBackdrop={!isLoading}
        >
            <div className="space-y-4 md:space-y-6">
                <p className="text-sm md:text-base text-gray-600">
                    {message}
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-base"
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`w-full sm:w-auto px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] text-base ${variantStyles[variant]}`}
                    >
                        {isLoading ? 'Processing...' : confirmLabel}
                    </button>
                </div>
            </div>
        </MobileModal>
    );
}
