import React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface ListSkeletonProps {
  items?: number;
  showIcon?: boolean;
  showAvatar?: boolean;
  showMetadata?: boolean;
  showActions?: boolean;
  variant?: 'default' | 'compact' | 'detailed' | 'audit' | 'notification';
  className?: string;
}

export function ListSkeleton({
  items = 5,
  showIcon = false,
  showAvatar = false,
  showMetadata = false,
  showActions = false,
  variant = 'default',
  className
}: ListSkeletonProps) {
  const renderDefaultItem = () => (
    <div className="flex items-center space-x-3 p-4">
      {/* Icon or Avatar */}
      {showIcon && <Skeleton className="w-5 h-5" />}
      {showAvatar && <Skeleton className="w-10 h-10 rounded-full" />}
      
      {/* Content */}
      <div className="flex-1 space-y-1">
        <Skeleton className="h-4 w-3/4" />
        {showMetadata && <Skeleton className="h-3 w-1/2" />}
      </div>
      
      {/* Actions */}
      {showActions && (
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-16 rounded" />
          <Skeleton className="h-8 w-8 rounded" />
        </div>
      )}
    </div>
  );

  const renderCompactItem = () => (
    <div className="flex items-center space-x-3 p-2">
      {showIcon && <Skeleton className="w-4 h-4" />}
      {showAvatar && <Skeleton className="w-8 h-8 rounded-full" />}
      <div className="flex-1">
        <Skeleton className="h-4 w-2/3" />
      </div>
      {showActions && <Skeleton className="h-6 w-6 rounded" />}
    </div>
  );

  const renderDetailedItem = () => (
    <div className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-3">
          {showAvatar && <Skeleton className="w-12 h-12 rounded-full" />}
          <div className="space-y-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        {showActions && (
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-8 rounded" />
            <Skeleton className="h-8 w-8 rounded" />
          </div>
        )}
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      
      {/* Metadata */}
      {showMetadata && (
        <div className="flex items-center space-x-4 text-sm">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-24" />
        </div>
      )}
    </div>
  );

  const renderAuditItem = () => (
    <div className="p-4 space-y-3">
      {/* Header with timestamp */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Skeleton className="w-8 h-8 rounded-full" />
          <div className="space-y-1">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-3 w-20" />
      </div>
      
      {/* Action description */}
      <div className="ml-11 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      
      {/* Changes or details */}
      <div className="ml-11 bg-gray-50 rounded p-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );

  const renderNotificationItem = () => (
    <div className="p-4">
      <div className="flex space-x-3">
        {/* Notification icon */}
        <div className="flex-shrink-0">
          <Skeleton className="w-8 h-8 rounded-full" />
        </div>
        
        {/* Content */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        
        {/* Unread indicator */}
        <div className="flex-shrink-0">
          <Skeleton className="w-2 h-2 rounded-full" />
        </div>
      </div>
    </div>
  );

  const renderItem = () => {
    switch (variant) {
      case 'compact':
        return renderCompactItem();
      case 'detailed':
        return renderDetailedItem();
      case 'audit':
        return renderAuditItem();
      case 'notification':
        return renderNotificationItem();
      default:
        return renderDefaultItem();
    }
  };

  return (
    <div 
      className={cn("space-y-0", className)}
      role="status"
      aria-label="Loading list items"
    >
      {Array.from({ length: items }).map((_, index) => (
        <div 
          key={index} 
          className={cn(
            "border-b border-gray-100 last:border-b-0",
            variant === 'compact' && "border-b-0"
          )}
        >
          {renderItem()}
        </div>
      ))}
    </div>
  );
}

// Specialized list skeletons for common use cases
export function AuditLogSkeleton({ items = 5 }: { items?: number }) {
  return (
    <ListSkeleton
      items={items}
      variant="audit"
      showAvatar={true}
      showMetadata={true}
      className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100"
    />
  );
}

export function NotificationListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <ListSkeleton
      items={items}
      variant="notification"
      className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100"
    />
  );
}

export function ReimbursementListSkeleton({ items = 4 }: { items?: number }) {
  return (
    <ListSkeleton
      items={items}
      variant="detailed"
      showAvatar={true}
      showMetadata={true}
      showActions={true}
      className="space-y-4"
    />
  );
}

export function EventListSkeleton({ items = 3 }: { items?: number }) {
  return (
    <ListSkeleton
      items={items}
      variant="detailed"
      showIcon={true}
      showMetadata={true}
      showActions={true}
      className="space-y-4"
    />
  );
}

export function UserListSkeleton({ items = 6 }: { items?: number }) {
  return (
    <ListSkeleton
      items={items}
      variant="default"
      showAvatar={true}
      showMetadata={true}
      showActions={true}
      className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100"
    />
  );
}
