import React, { useEffect, useState } from 'react';
import { CheckCircle, Image as ImageIcon } from 'lucide-react';

interface PasteNotificationProps {
  show: boolean;
  message?: string;
  duration?: number;
  onHide?: () => void;
}

/**
 * Toast-style notification for paste events
 * 
 * Displays a brief notification when an image is successfully pasted.
 * Auto-dismisses after the specified duration.
 * 
 * @example
 * ```tsx
 * const [showNotification, setShowNotification] = useState(false);
 * 
 * useGlobalImagePaste({
 *   modalType: 'reimbursement-submission',
 *   enabled: isOpen,
 *   onImagePaste: (file) => {
 *     handleFile(file);
 *     setShowNotification(true);
 *   }
 * });
 * 
 * <PasteNotification 
 *   show={showNotification}
 *   onHide={() => setShowNotification(false)}
 * />
 * ```
 */
export default function PasteNotification({
  show,
  message = 'Image pasted successfully',
  duration = 2000,
  onHide
}: PasteNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (show) {
      setIsVisible(true);
      // Small delay to trigger animation
      setTimeout(() => setIsAnimating(true), 10);

      // Auto-hide after duration
      const timer = setTimeout(() => {
        setIsAnimating(false);
        // Wait for animation to complete before hiding
        setTimeout(() => {
          setIsVisible(false);
          if (onHide) {
            onHide();
          }
        }, 300);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [show, duration, onHide]);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={`fixed top-4 right-4 z-[9999] transition-all duration-300 ease-out ${
        isAnimating
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 -translate-y-2'
      }`}
    >
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-3 flex items-center space-x-3 min-w-[280px]">
        <div className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle className="w-5 h-5 text-green-600" />
          </div>
        </div>
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <ImageIcon className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-medium text-gray-900">{message}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to manage paste notification state
 * 
 * Provides a simple interface to show paste notifications.
 * 
 * @example
 * ```tsx
 * const { showPasteNotification, PasteNotificationComponent } = usePasteNotification();
 * 
 * useGlobalImagePaste({
 *   modalType: 'reimbursement-submission',
 *   enabled: isOpen,
 *   onImagePaste: (file) => {
 *     handleFile(file);
 *     showPasteNotification();
 *   }
 * });
 * 
 * return (
 *   <>
 *     {PasteNotificationComponent}
 *     {/* rest of component *\/}
 *   </>
 * );
 * ```
 */
export function usePasteNotification(message?: string) {
  const [show, setShow] = useState(false);

  const showPasteNotification = () => {
    setShow(true);
  };

  const PasteNotificationComponent = (
    <PasteNotification
      show={show}
      message={message}
      onHide={() => setShow(false)}
    />
  );

  return {
    showPasteNotification,
    PasteNotificationComponent
  };
}

