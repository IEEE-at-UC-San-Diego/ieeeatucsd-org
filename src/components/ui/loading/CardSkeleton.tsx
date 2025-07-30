import React from 'react';
import { Skeleton } from '../skeleton';
import { cn } from '@/lib/utils';

interface CardSkeletonProps {
  variant?: 'default' | 'metric' | 'content' | 'event' | 'profile';
  showImage?: boolean;
  showActions?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function CardSkeleton({
  variant = 'default',
  showImage = false,
  showActions = false,
  className,
  size = 'md'
}: CardSkeletonProps) {
  const sizeClasses = {
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8'
  };

  const renderMetricCard = () => (
    <div className="space-y-3">
      {/* Icon and title */}
      <div className="flex items-center space-x-3">
        <Skeleton className="w-8 h-8 rounded" />
        <Skeleton className="h-4 w-24" />
      </div>
      
      {/* Main metric */}
      <Skeleton className="h-8 w-20" />
      
      {/* Subtitle/change indicator */}
      <Skeleton className="h-3 w-32" />
    </div>
  );

  const renderContentCard = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
      
      {/* Image if requested */}
      {showImage && (
        <Skeleton className="h-48 w-full rounded" />
      )}
      
      {/* Content lines */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
      
      {/* Actions if requested */}
      {showActions && (
        <div className="flex space-x-2 pt-2">
          <Skeleton className="h-9 w-20 rounded" />
          <Skeleton className="h-9 w-16 rounded" />
        </div>
      )}
    </div>
  );

  const renderEventCard = () => (
    <div className="space-y-4">
      {/* Event image */}
      <Skeleton className="h-32 w-full rounded" />
      
      {/* Event details */}
      <div className="space-y-3">
        {/* Title */}
        <Skeleton className="h-5 w-4/5" />
        
        {/* Date and time */}
        <div className="flex items-center space-x-2">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 w-32" />
        </div>
        
        {/* Location */}
        <div className="flex items-center space-x-2">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-4 w-24" />
        </div>
        
        {/* Description */}
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-3/4" />
        </div>
        
        {/* Action button */}
        <Skeleton className="h-10 w-full rounded" />
      </div>
    </div>
  );

  const renderProfileCard = () => (
    <div className="space-y-4">
      {/* Profile header */}
      <div className="flex items-center space-x-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-100">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="text-center space-y-1">
            <Skeleton className="h-6 w-8 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
        ))}
      </div>
    </div>
  );

  const renderDefaultCard = () => (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-1/2" />
        {showActions && <Skeleton className="w-6 h-6" />}
      </div>
      
      {/* Content */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </div>
      
      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );

  const renderCardContent = () => {
    switch (variant) {
      case 'metric':
        return renderMetricCard();
      case 'content':
        return renderContentCard();
      case 'event':
        return renderEventCard();
      case 'profile':
        return renderProfileCard();
      default:
        return renderDefaultCard();
    }
  };

  return (
    <div 
      className={cn(
        "bg-white rounded-lg border border-gray-200 shadow-sm",
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label="Loading card content"
    >
      {renderCardContent()}
    </div>
  );
}

// Specialized card skeletons for common use cases
export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <CardSkeleton
      variant="metric"
      size="md"
      className={className}
    />
  );
}

export function EventCardSkeleton({ className }: { className?: string }) {
  return (
    <CardSkeleton
      variant="event"
      size="md"
      className={className}
    />
  );
}

export function ProfileCardSkeleton({ className }: { className?: string }) {
  return (
    <CardSkeleton
      variant="profile"
      size="md"
      className={className}
    />
  );
}

export function ContentCardSkeleton({ 
  showImage = false, 
  showActions = false, 
  className 
}: { 
  showImage?: boolean; 
  showActions?: boolean; 
  className?: string; 
}) {
  return (
    <CardSkeleton
      variant="content"
      showImage={showImage}
      showActions={showActions}
      size="md"
      className={className}
    />
  );
}
