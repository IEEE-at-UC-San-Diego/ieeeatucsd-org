import React from 'react';
import { Skeleton } from '@heroui/react';
import { Card, CardBody } from '@heroui/react';

export function AttendanceMetricsSkeleton() {
  return (
    <Card shadow="sm" className="border border-gray-200 transition-opacity duration-300 ease-in-out">
      <CardBody className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            {/* Title skeleton */}
            <Skeleton className="h-4 w-32 mb-3" />
            
            {/* Main metric skeleton */}
            <Skeleton className="h-8 w-24 mb-2" />
            
            {/* Subtitle skeleton */}
            <Skeleton className="h-3 w-36" />
          </div>
          
          {/* Icon skeleton */}
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0 ml-4">
            <Skeleton className="w-6 h-6 rounded" />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}