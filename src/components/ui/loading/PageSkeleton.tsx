import React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface PageSkeletonProps {
  layout?: 'dashboard' | 'table' | 'form' | 'content';
  showHeader?: boolean;
  showSidebar?: boolean;
  className?: string;
}

export function PageSkeleton({
  layout = 'content',
  showHeader = true,
  showSidebar = false,
  className
}: PageSkeletonProps) {
  const renderDashboardLayout = () => (
    <div className="space-y-6">
      {/* Header section */}
      {showHeader && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <Skeleton className="h-10 w-32 rounded" />
          </div>
          
          {/* Search bar */}
          <Skeleton className="h-10 w-full max-w-md rounded" />
        </div>
      )}
      
      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <Skeleton className="w-8 h-8 rounded" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      
      {/* Main content area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main chart/content */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200 p-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-64 w-full rounded" />
          </div>
        </div>
        
        {/* Sidebar content */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="space-y-4">
              <Skeleton className="h-5 w-24" />
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTableLayout = () => (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-4 w-56" />
            </div>
            <div className="flex space-x-3">
              <Skeleton className="h-10 w-24 rounded" />
              <Skeleton className="h-10 w-32 rounded" />
            </div>
          </div>
          
          {/* Filters and search */}
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-64 rounded" />
            <Skeleton className="h-10 w-32 rounded" />
            <Skeleton className="h-10 w-28 rounded" />
          </div>
        </div>
      )}
      
      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {/* Table header */}
        <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
          <div className="flex space-x-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className={index === 0 ? 'w-1/4' : 'w-1/6'}>
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        </div>
        
        {/* Table rows */}
        <div className="divide-y divide-gray-200">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="px-6 py-4">
              <div className="flex items-center space-x-4">
                {Array.from({ length: 5 }).map((_, colIndex) => (
                  <div key={colIndex} className={colIndex === 0 ? 'w-1/4' : 'w-1/6'}>
                    {colIndex === 4 ? (
                      <div className="flex space-x-2">
                        <Skeleton className="h-8 w-16 rounded" />
                        <Skeleton className="h-8 w-16 rounded" />
                      </div>
                    ) : (
                      <Skeleton className="h-4 w-5/6" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderFormLayout = () => (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      )}
      
      {/* Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          {/* Form sections */}
          {Array.from({ length: 3 }).map((_, sectionIndex) => (
            <div key={sectionIndex} className="space-y-4">
              <Skeleton className="h-5 w-32" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, fieldIndex) => (
                  <div key={fieldIndex} className="space-y-2">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-10 w-full rounded" />
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {/* Form actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <Skeleton className="h-10 w-20 rounded" />
            <Skeleton className="h-10 w-24 rounded" />
          </div>
        </div>
      </div>
    </div>
  );

  const renderContentLayout = () => (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-56" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-full max-w-md rounded" />
        </div>
      )}
      
      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-4/6" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
          
          <div className="space-y-4">
            <Skeleton className="h-6 w-40" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderLayout = () => {
    switch (layout) {
      case 'dashboard':
        return renderDashboardLayout();
      case 'table':
        return renderTableLayout();
      case 'form':
        return renderFormLayout();
      default:
        return renderContentLayout();
    }
  };

  return (
    <div 
      className={cn("flex-1 overflow-auto", className)}
      role="status"
      aria-label="Loading page content"
    >
      <div className="p-4 md:p-6">
        {renderLayout()}
      </div>
    </div>
  );
}
