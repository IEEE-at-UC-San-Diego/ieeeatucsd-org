import React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  showHeader?: boolean;
  className?: string;
  variant?: 'default' | 'compact' | 'detailed';
}

export function TableSkeleton({
  rows = 5,
  columns = 4,
  showHeader = true,
  className,
  variant = 'default'
}: TableSkeletonProps) {
  const getColumnWidths = () => {
    // Generate varied column widths for more realistic appearance
    const widths = [];
    for (let i = 0; i < columns; i++) {
      if (i === 0) {
        widths.push('w-1/4'); // First column typically wider
      } else if (i === columns - 1) {
        widths.push('w-20'); // Last column typically actions
      } else {
        widths.push('w-1/6');
      }
    }
    return widths;
  };

  const columnWidths = getColumnWidths();
  const rowHeight = variant === 'compact' ? 'h-10' : variant === 'detailed' ? 'h-16' : 'h-12';

  return (
    <div 
      className={cn("w-full", className)}
      role="status"
      aria-label="Loading table data"
    >
      {/* Desktop Table View */}
      <div className="hidden md:block">
        <div className="overflow-hidden rounded-lg border border-gray-200">
          {/* Table Header */}
          {showHeader && (
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
              <div className="flex space-x-4">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div key={colIndex} className={columnWidths[colIndex]}>
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Table Rows */}
          <div className="bg-white divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className={cn("px-6 py-4", rowHeight)}>
                <div className="flex items-center space-x-4">
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <div key={colIndex} className={columnWidths[colIndex]}>
                      {colIndex === columns - 1 ? (
                        // Actions column - show button-like skeletons
                        <div className="flex space-x-2">
                          <Skeleton className="h-8 w-16 rounded" />
                          <Skeleton className="h-8 w-16 rounded" />
                        </div>
                      ) : colIndex === 0 ? (
                        // First column - often has more content
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-full" />
                          {variant === 'detailed' && (
                            <Skeleton className="h-3 w-2/3" />
                          )}
                        </div>
                      ) : (
                        // Regular data columns
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

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-3">
              {/* Main content */}
              <div className="space-y-2">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                {variant === 'detailed' && (
                  <Skeleton className="h-3 w-2/3" />
                )}
              </div>
              
              {/* Metadata */}
              <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                <Skeleton className="h-3 w-20" />
                <div className="flex space-x-2">
                  <Skeleton className="h-7 w-12 rounded" />
                  <Skeleton className="h-7 w-12 rounded" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Specialized table skeletons for common use cases
export function LeaderboardTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <TableSkeleton
      rows={rows}
      columns={4}
      showHeader={true}
      variant="default"
      className="w-full"
    />
  );
}

export function UserManagementTableSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <TableSkeleton
      rows={rows}
      columns={5}
      showHeader={true}
      variant="detailed"
      className="w-full"
    />
  );
}

export function ReimbursementTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <TableSkeleton
      rows={rows}
      columns={4}
      showHeader={true}
      variant="default"
      className="w-full"
    />
  );
}
