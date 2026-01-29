import React, { useEffect, useState } from 'react';
import DashboardLayout from '../DashboardLayout';
import { Spinner } from '@heroui/react';

interface ClientDashboardLayoutProps {
  currentPath?: string;
  children?: React.ReactNode;
}

/**
 * Client-side wrapper for DashboardLayout that prevents hydration issues.
 *
 * This component ensures that the DashboardLayout only renders on the client side,
 * preventing hydration mismatches between server and client rendering.
 * It handles the authentication state and browser-specific APIs safely.
 */
export default function ClientDashboardLayout({
  currentPath,
  children
}: ClientDashboardLayoutProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // Only render on client side after component mounts
    setIsClient(true);
  }, []);

  // Return a loading state or null during server-side rendering
  if (!isClient) {
    return (
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Spinner size="lg" color="primary" className="mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Only render the actual DashboardLayout on the client side
  return (
    <DashboardLayout currentPath={currentPath}>
      {children}
    </DashboardLayout>
  );
}
