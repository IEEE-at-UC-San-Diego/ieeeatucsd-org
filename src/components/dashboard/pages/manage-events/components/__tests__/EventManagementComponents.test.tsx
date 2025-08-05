import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { truncateFilename, formatFileSize, isFileTypeAllowed, isFileSizeValid } from '../utils/filenameUtils';
import DragDropFileUpload from '../DragDropFileUpload';
import EventReviewSection from '../EventReviewSection';
import EventEditComparison from '../EventEditComparison';
import EnhancedFileViewer from '../EnhancedFileViewer';

// Mock Firebase auth
jest.mock('../../../../../../firebase/client', () => ({
  auth: {
    currentUser: { uid: 'test-user-id' }
  }
}));

// Mock EventAuditService
jest.mock('../../../../shared/services/eventAuditService', () => ({
  EventAuditService: {
    getUserName: jest.fn().mockResolvedValue('Test User'),
    logFileView: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Filename Utils', () => {
  describe('truncateFilename', () => {
    test('should not truncate short filenames', () => {
      expect(truncateFilename('short.pdf')).toBe('short.pdf');
    });

    test('should truncate long filenames correctly', () => {
      const longFilename = 'this_is_a_very_long_filename_that_should_be_truncated.pdf';
      const result = truncateFilename(longFilename);
      expect(result).toBe('this_is_a_very_long_...pdf');
      expect(result.length).toBeLessThanOrEqual(30);
    });

    test('should handle filenames without extensions', () => {
      const longFilename = 'this_is_a_very_long_filename_without_extension';
      const result = truncateFilename(longFilename);
      expect(result).toBe('this_is_a_very_long_...');
    });

    test('should handle custom max length', () => {
      const filename = 'medium_length_filename.txt';
      const result = truncateFilename(filename, 15, 10);
      expect(result.length).toBeLessThanOrEqual(15);
    });
  });

  describe('formatFileSize', () => {
    test('should format bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1048576)).toBe('1 MB');
      expect(formatFileSize(1073741824)).toBe('1 GB');
    });

    test('should handle decimal values', () => {
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(2621440)).toBe('2.5 MB');
    });
  });

  describe('isFileTypeAllowed', () => {
    test('should validate allowed file types', () => {
      const allowedTypes = ['pdf', 'jpg', 'png'];
      expect(isFileTypeAllowed('document.pdf', allowedTypes)).toBe(true);
      expect(isFileTypeAllowed('image.jpg', allowedTypes)).toBe(true);
      expect(isFileTypeAllowed('document.docx', allowedTypes)).toBe(false);
    });

    test('should handle extensions with dots', () => {
      const allowedTypes = ['.pdf', '.jpg'];
      expect(isFileTypeAllowed('document.pdf', allowedTypes)).toBe(true);
    });

    test('should be case insensitive', () => {
      const allowedTypes = ['pdf'];
      expect(isFileTypeAllowed('document.PDF', allowedTypes)).toBe(true);
    });
  });

  describe('isFileSizeValid', () => {
    test('should validate file sizes correctly', () => {
      expect(isFileSizeValid(1024 * 1024, 2)).toBe(true); // 1MB file, 2MB limit
      expect(isFileSizeValid(3 * 1024 * 1024, 2)).toBe(false); // 3MB file, 2MB limit
    });
  });
});

describe('DragDropFileUpload', () => {
  const mockOnFilesSelected = jest.fn();
  const mockOnFileUploaded = jest.fn();
  const mockUploadFunction = jest.fn().mockResolvedValue('http://example.com/file.pdf');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render upload zone', () => {
    render(
      <DragDropFileUpload
        onFilesSelected={mockOnFilesSelected}
        onFileUploaded={mockOnFileUploaded}
        uploadFunction={mockUploadFunction}
      />
    );

    expect(screen.getByText('Click to upload or drag and drop')).toBeInTheDocument();
    expect(screen.getByText(/PDF, JPG, JPEG, PNG, GIF, WEBP up to 10MB each/)).toBeInTheDocument();
  });

  test('should handle file selection', async () => {
    render(
      <DragDropFileUpload
        onFilesSelected={mockOnFilesSelected}
        uploadFunction={mockUploadFunction}
      />
    );

    const file = new File(['test content'], 'test.pdf', { type: 'application/pdf' });
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file],
      writable: false,
    });

    fireEvent.change(input);

    await waitFor(() => {
      expect(mockOnFilesSelected).toHaveBeenCalledWith([file]);
    });
  });

  test('should validate file types', () => {
    render(
      <DragDropFileUpload
        onFilesSelected={mockOnFilesSelected}
        allowedTypes={['pdf']}
      />
    );

    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const input = screen.getByRole('button').querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [invalidFile],
      writable: false,
    });

    fireEvent.change(input);

    expect(mockOnFilesSelected).not.toHaveBeenCalled();
  });

  test('should be disabled when disabled prop is true', () => {
    render(
      <DragDropFileUpload
        onFilesSelected={mockOnFilesSelected}
        disabled={true}
      />
    );

    const uploadZone = screen.getByRole('button');
    expect(uploadZone).toHaveClass('opacity-50', 'cursor-not-allowed');
  });
});

describe('EventReviewSection', () => {
  const mockEventData = {
    name: 'Test Event',
    location: 'Test Location',
    eventDescription: 'Test Description',
    department: 'Engineering',
    expectedAttendance: 50,
    startDateTime: new Date('2024-01-01T10:00:00'),
    endDateTime: new Date('2024-01-01T12:00:00'),
    needsGraphics: true,
    needsAsFunding: false,
    flyersNeeded: true,
    photographyNeeded: false,
    hasRoomBooking: true,
    servingFoodDrinks: false,
    invoices: [
      {
        id: '1',
        vendor: 'Test Vendor',
        items: [{ description: 'Test Item', quantity: 1, unitPrice: 10, total: 10 }],
        tax: 1,
        tip: 0,
        subtotal: 10,
        total: 11
      }
    ],
    roomBookingFiles: ['file1.pdf'],
    invoiceFiles: ['invoice1.pdf']
  };

  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render review section with event data', () => {
    render(
      <EventReviewSection
        eventData={mockEventData}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Review Event Submission')).toBeInTheDocument();
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('Test Location')).toBeInTheDocument();
    expect(screen.getByText('Test Description')).toBeInTheDocument();
  });

  test('should show room booking warning when no room booking', () => {
    const eventDataWithoutBooking = { ...mockEventData, hasRoomBooking: false, roomBookingFiles: [] };
    
    render(
      <EventReviewSection
        eventData={eventDataWithoutBooking}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
        showRoomBookingWarning={true}
      />
    );

    expect(screen.getByText('⚠️ Room Booking Warning')).toBeInTheDocument();
    expect(screen.getByText(/Events without room bookings have a high probability of cancellation/)).toBeInTheDocument();
  });

  test('should require confirmation before enabling submit', () => {
    render(
      <EventReviewSection
        eventData={mockEventData}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const submitButton = screen.getByText('Confirm & Submit Event');
    expect(submitButton).toBeDisabled();

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(submitButton).not.toBeDisabled();
  });

  test('should call onConfirm when submit button is clicked', () => {
    render(
      <EventReviewSection
        eventData={mockEventData}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const submitButton = screen.getByText('Confirm & Submit Event');
    fireEvent.click(submitButton);

    expect(mockOnConfirm).toHaveBeenCalled();
  });
});

describe('EventEditComparison', () => {
  const originalData = {
    name: 'Original Event',
    location: 'Original Location',
    expectedAttendance: 50
  };

  const newData = {
    name: 'Updated Event',
    location: 'Original Location',
    expectedAttendance: 75
  };

  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render comparison view with changes', () => {
    render(
      <EventEditComparison
        originalData={originalData}
        newData={newData}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('Review Event Changes')).toBeInTheDocument();
    expect(screen.getByText(/2 changes detected/)).toBeInTheDocument();
  });

  test('should show no changes when data is identical', () => {
    render(
      <EventEditComparison
        originalData={originalData}
        newData={originalData}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('No Changes Detected')).toBeInTheDocument();
  });

  test('should call onConfirm when changes are confirmed', () => {
    render(
      <EventEditComparison
        originalData={originalData}
        newData={newData}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByText(/Confirm \d+ Change/);
    fireEvent.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalled();
  });
});

describe('EnhancedFileViewer', () => {
  const mockOnPreview = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should render file viewer with filename', () => {
    render(
      <EnhancedFileViewer
        url="http://example.com/test.pdf"
        filename="test.pdf"
        onPreview={mockOnPreview}
      />
    );

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  test('should call onPreview when preview button is clicked', () => {
    render(
      <EnhancedFileViewer
        url="http://example.com/test.pdf"
        filename="test.pdf"
        onPreview={mockOnPreview}
      />
    );

    const previewButton = screen.getByTitle('Preview file');
    fireEvent.click(previewButton);

    expect(mockOnPreview).toHaveBeenCalledWith('http://example.com/test.pdf');
  });

  test('should show image preview for image files', () => {
    render(
      <EnhancedFileViewer
        url="http://example.com/test.jpg"
        filename="test.jpg"
        onPreview={mockOnPreview}
      />
    );

    const image = screen.getByRole('img');
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute('src', 'http://example.com/test.jpg');
  });

  test('should truncate long filenames', () => {
    const longFilename = 'this_is_a_very_long_filename_that_should_be_truncated.pdf';
    render(
      <EnhancedFileViewer
        url="http://example.com/file.pdf"
        filename={longFilename}
        onPreview={mockOnPreview}
      />
    );

    const displayedName = screen.getByText(/this_is_a_very_long_.*\.pdf/);
    expect(displayedName).toBeInTheDocument();
  });
});
