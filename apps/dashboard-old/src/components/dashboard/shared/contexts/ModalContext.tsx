import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ModalType } from '../hooks/useGlobalImagePaste';

type ReactNode = React.ReactNode;

interface ModalContextValue {
  /**
   * The currently active modal type
   */
  activeModal: ModalType;

  /**
   * Register a modal as active
   */
  registerModal: (modalType: ModalType) => void;

  /**
   * Unregister the active modal
   */
  unregisterModal: (modalType: ModalType) => void;

  /**
   * Check if a specific modal is active
   */
  isModalActive: (modalType: ModalType) => boolean;
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined);

interface ModalProviderProps {
  children: ReactNode;
}

/**
 * Modal Context Provider
 * 
 * Provides global state management for tracking which modal is currently open.
 * This allows the global paste handler to route pasted images to the correct modal.
 * 
 * @example
 * ```tsx
 * // In your app root or dashboard layout:
 * <ModalProvider>
 *   <YourApp />
 * </ModalProvider>
 * 
 * // In a modal component:
 * const { registerModal, unregisterModal } = useModalContext();
 * 
 * useEffect(() => {
 *   if (isOpen) {
 *     registerModal('reimbursement-submission');
 *   } else {
 *     unregisterModal('reimbursement-submission');
 *   }
 * }, [isOpen]);
 * ```
 */
export function ModalProvider({ children }: ModalProviderProps) {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  const registerModal = useCallback((modalType: ModalType) => {
    setActiveModal(modalType);
  }, []);

  const unregisterModal = useCallback((modalType: ModalType) => {
    setActiveModal(current => {
      // Only unregister if this modal is currently active
      if (current === modalType) {
        return null;
      }
      return current;
    });
  }, []);

  const isModalActive = useCallback((modalType: ModalType) => {
    return activeModal === modalType;
  }, [activeModal]);

  const value: ModalContextValue = {
    activeModal,
    registerModal,
    unregisterModal,
    isModalActive
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
    </ModalContext.Provider>
  );
}

/**
 * Hook to access the modal context
 *
 * Returns undefined if used outside of ModalProvider (graceful degradation)
 */
export function useModalContext(): ModalContextValue | undefined {
  const context = useContext(ModalContext);
  return context;
}

/**
 * Hook to access the modal context (strict version)
 *
 * @throws {Error} If used outside of ModalProvider
 */
export function useModalContextStrict(): ModalContextValue {
  const context = useContext(ModalContext);

  if (context === undefined) {
    throw new Error('useModalContext must be used within a ModalProvider');
  }

  return context;
}

/**
 * Hook to register a modal with the global modal context
 *
 * Automatically registers and unregisters the modal based on the isOpen state.
 * Gracefully handles cases where ModalProvider is not available.
 *
 * @param modalType - The type of modal to register
 * @param isOpen - Whether the modal is currently open
 *
 * @example
 * ```tsx
 * function MyModal({ isOpen, onClose }) {
 *   useModalRegistration('reimbursement-submission', isOpen);
 *
 *   // ... rest of modal component
 * }
 * ```
 */
export function useModalRegistration(modalType: ModalType, isOpen: boolean) {
  const context = useModalContext();
  const [hasWarned, setHasWarned] = React.useState(false);

  React.useEffect(() => {
    // If context is not available, skip registration (graceful degradation)
    if (!context) {
      // Only warn once in development
      if (process.env.NODE_ENV === 'development' && !hasWarned && isOpen) {
        console.warn(
          `[useModalRegistration] ModalProvider not found. Modal "${modalType}" will work but without global paste coordination. ` +
          `Wrap your app with <ModalProvider> to enable full functionality.`
        );
        setHasWarned(true);
      }
      return;
    }

    const { registerModal, unregisterModal } = context;

    if (isOpen && modalType) {
      registerModal(modalType);
    } else if (modalType) {
      unregisterModal(modalType);
    }

    // Cleanup on unmount
    return () => {
      if (modalType) {
        unregisterModal(modalType);
      }
    };
  }, [isOpen, modalType, context, hasWarned]);
}

