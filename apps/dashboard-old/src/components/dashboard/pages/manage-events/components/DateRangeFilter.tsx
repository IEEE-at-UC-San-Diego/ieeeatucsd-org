import React from 'react';
import { CalendarDays } from 'lucide-react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Button } from '@heroui/react';

interface DateRangeFilterProps {
  selectedRange: string;
  onRangeChange: (range: string) => void;
}

export function DateRangeFilter({ selectedRange, onRangeChange }: DateRangeFilterProps) {
  const dateRanges = [
    { key: 'all', label: 'All Events' },
    { key: 'last7days', label: 'Last 7 Days' },
    { key: 'last30days', label: 'Last 30 Days' },
    { key: 'last3months', label: 'Last 3 Months' },
  ];

  const getSelectedLabel = () => {
    const range = dateRanges.find(r => r.key === selectedRange);
    return range ? range.label : 'All Events';
  };

  return (
    <Dropdown>
      <DropdownTrigger>
        <Button
          variant="bordered"
          size="sm"
          startContent={<CalendarDays className="w-4 h-4" />}
          className="h-9"
        >
          {getSelectedLabel()}
        </Button>
      </DropdownTrigger>
      <DropdownMenu
        aria-label="Date range filter"
        selectionMode="single"
        selectedKeys={[selectedRange]}
        onSelectionChange={(keys) => {
          const selectedKey = Array.from(keys)[0] as string;
          onRangeChange(selectedKey);
        }}
      >
        {dateRanges.map((range) => (
          <DropdownItem key={range.key}>
            {range.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}