import React from 'react';
import { Card, CardBody, Button } from '@heroui/react';

interface EventsPaginationProps {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    startIndex: number;
    endIndex: number;
    onPageChange: (page: number) => void;
}

export function EventsPagination({
    currentPage,
    totalPages,
    totalItems,
    startIndex,
    endIndex,
    onPageChange
}: EventsPaginationProps) {
    if (totalPages <= 1) {
        return null;
    }

    return (
        <Card shadow="sm" className="border border-gray-200">
            <CardBody className="px-6 py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="text-sm text-gray-700">
                        Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} events
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            variant="bordered"
                            onPress={() => onPageChange(currentPage - 1)}
                            isDisabled={currentPage === 1}
                        >
                            Previous
                        </Button>

                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                <Button
                                    key={page}
                                    size="sm"
                                    variant={currentPage === page ? "solid" : "bordered"}
                                    color={currentPage === page ? "primary" : "default"}
                                    onPress={() => onPageChange(page)}
                                    className="min-w-[40px]"
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>

                        <Button
                            size="sm"
                            variant="bordered"
                            onPress={() => onPageChange(currentPage + 1)}
                            isDisabled={currentPage === totalPages}
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </CardBody>
        </Card>
    );
}

