import React from 'react';
import { Filter } from 'lucide-react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from '@heroui/react';

interface StatusFilterProps {
  selectedStatus: string;
  onStatusChange: (status: string) => void;
}

export function StatusFilter({ selectedStatus, onStatusChange }: StatusFilterProps) {
  const statusOptions = [
    { key: 'all', label: 'All Statuses' },
    { key: 'draft', label: 'Draft' },
    { key: 'submitted', label: 'Submitted' },
    { key: 'pending', label: 'Pending' },
    { key: 'needs_review', label: 'Needs Review' },
    { key: 'approved', label: 'Approved' },
    { key: 'declined', label: 'Declined' },
    { key: 'rejected', label: 'Rejected' },
  ];

  const getSelectedLabel = () => {
    const status = statusOptions.find(s => s.key === selectedStatus);
    return status ? status.label : 'All Statuses';
  };

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="bordered"
          size="sm"
          startContent={<Filter className="w-4 h-4" />}
          className="h-9"
        >
          {getSelectedLabel()}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Status filter"
        selectionMode="single"
        selectedKeys={[selectedStatus]}
        onSelectionChange={(keys) => {
          const selectedKey = Array.from(keys)[0] as string;
          onStatusChange(selectedKey);
        }}
      >
        {statusOptions.map((status) => (
          <DropdownItem key={status.key}>
            {status.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}