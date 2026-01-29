import React, { useState, useEffect } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Textarea,
} from '@heroui/react';
import { Calendar, MapPin, FileText } from 'lucide-react';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from '../../../../../firebase/client';
import { getAuth } from 'firebase/auth';
import { showToast } from '../../../shared/utils/toast';
import type { DraftEventModalProps, DraftEventFormData } from '../types/EventRequestTypes';

const DraftEventModal: React.FC<DraftEventModalProps> = ({
  isOpen,
  onClose,
  preselectedDate,
  onSuccess,
  editingDraft,
}) => {
  const auth = getAuth();
  const isEditMode = !!editingDraft;

  const [formData, setFormData] = useState<DraftEventFormData>({
    name: '',
    startDate: '',
    endDate: '',
    description: '',
    location: '',
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  // Pre-fill form data when editing or when preselected date is provided
  useEffect(() => {
    if (isOpen) {
      if (editingDraft) {
        // Pre-fill form with existing draft data
        const startDate = editingDraft.startDateTime?.toDate?.() || new Date(editingDraft.startDateTime);
        const endDate = editingDraft.endDateTime?.toDate?.() || new Date(editingDraft.endDateTime);

        setFormData({
          name: editingDraft.name || '',
          startDate: startDate.toISOString().split('T')[0],
          endDate: endDate.toISOString().split('T')[0],
          description: editingDraft.eventDescription || '',
          location: editingDraft.location || '',
        });
      } else if (preselectedDate) {
        // Pre-fill start date if provided for new draft
        const dateString = preselectedDate.toISOString().split('T')[0];
        setFormData((prev) => ({
          ...prev,
          startDate: dateString,
          endDate: dateString, // Default end date to same as start date
        }));
      }
    }
  }, [preselectedDate, isOpen, editingDraft]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        name: '',
        startDate: '',
        endDate: '',
        description: '',
        location: '',
      });
      setErrors({});
    }
  }, [isOpen]);

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Event name is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    // Validate end date is not before start date
    if (formData.endDate && formData.startDate) {
      const start = new Date(formData.startDate);
      const end = new Date(formData.endDate);
      if (end < start) {
        newErrors.endDate = 'End date cannot be before start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    if (!auth.currentUser) {
      showToast.error('You must be logged in to save a draft event');
      return;
    }

    setLoading(true);

    try {
      // Create start and end timestamps
      const startDateTime = Timestamp.fromDate(new Date(`${formData.startDate}T00:00:00`));
      const endDateTime = formData.endDate
        ? Timestamp.fromDate(new Date(`${formData.endDate}T23:59:59`))
        : startDateTime;

      if (isEditMode && editingDraft) {
        // Update existing draft
        const updateData = {
          name: formData.name,
          location: formData.location || '',
          startDateTime,
          endDateTime,
          eventDescription: formData.description || '',
          updatedAt: Timestamp.now(),
        };

        await updateDoc(doc(db, 'event_requests', editingDraft.id), updateData);
        showToast.success('Draft event updated successfully!');
      } else {
        // Create new draft event request with minimal fields
        const draftEventData = {
          name: formData.name,
          location: formData.location || '',
          startDateTime,
          endDateTime,
          eventDescription: formData.description || '',
          status: 'draft',
          isDraft: true,
          requestedUser: auth.currentUser.uid,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          // Set default values for required fields (will be filled when converting to full event)
          department: 'General',
          eventCode: '',
          pointsToReward: 0,
          flyersNeeded: false,
          flyerType: [],
          flyersCompleted: false,
          photographyNeeded: false,
          requiredLogos: [],
          willOrHaveRoomBooking: false,
          expectedAttendance: 0,
          roomBookingFiles: [],
          asFundingRequired: false,
          foodDrinksBeingServed: false,
          invoices: [],
          needsGraphics: false,
          needsAsFunding: false,
        };

        await addDoc(collection(db, 'event_requests'), draftEventData);
        showToast.success('Draft event created successfully!');
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error(`Error ${isEditMode ? 'updating' : 'creating'} draft event:`, error);
      showToast.error(`Failed to ${isEditMode ? 'update' : 'create'} draft event. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-white',
        header: 'border-b border-gray-200',
        body: 'py-6',
        footer: 'border-t border-gray-200',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-[#0A2463]">
            {isEditMode ? 'Edit Draft Event' : 'Create Draft Event'}
          </h2>
          <p className="text-sm text-gray-600 font-normal">
            {isEditMode
              ? 'Update the draft event details. You can convert it to a full event request later.'
              : 'Quickly create a draft event for planning. You can add full details later.'
            }
          </p>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-4">
            {/* Event Name */}
            <Input
              label="Event Name"
              placeholder="Enter event name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              isRequired
              isInvalid={!!errors.name}
              errorMessage={errors.name}
              startContent={<FileText className="w-4 h-4 text-gray-400" />}
              classNames={{
                label: 'text-gray-700 font-medium',
                input: 'text-gray-900',
              }}
            />

            {/* Start Date */}
            <Input
              type="date"
              label="Start Date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              isRequired
              isInvalid={!!errors.startDate}
              errorMessage={errors.startDate}
              startContent={<Calendar className="w-4 h-4 text-gray-400" />}
              classNames={{
                label: 'text-gray-700 font-medium',
                input: 'text-gray-900',
              }}
            />

            {/* End Date (Optional) */}
            <Input
              type="date"
              label="End Date (Optional)"
              placeholder="Leave blank if same as start date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              isInvalid={!!errors.endDate}
              errorMessage={errors.endDate}
              startContent={<Calendar className="w-4 h-4 text-gray-400" />}
              classNames={{
                label: 'text-gray-700 font-medium',
                input: 'text-gray-900',
              }}
            />

            {/* Location (Optional) */}
            <Input
              label="Location (Optional)"
              placeholder="Enter event location"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              startContent={<MapPin className="w-4 h-4 text-gray-400" />}
              classNames={{
                label: 'text-gray-700 font-medium',
                input: 'text-gray-900',
              }}
            />

            {/* Description (Optional) */}
            <Textarea
              label="Description (Optional)"
              placeholder="Brief description of the event"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              minRows={3}
              maxRows={6}
              classNames={{
                label: 'text-gray-700 font-medium',
                input: 'text-gray-900',
              }}
            />

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> {isEditMode
                  ? 'This draft event is for planning purposes. You can convert it to a full event request later to add invoices, room bookings, and other details.'
                  : 'This creates a draft event for planning purposes. You can convert it to a full event request later to add invoices, room bookings, and other details.'
                }
              </p>
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            color="default"
            variant="light"
            onPress={onClose}
            isDisabled={loading}
          >
            Cancel
          </Button>
          <Button
            style={{ backgroundColor: '#0A2463' }}
            className="text-white"
            onPress={handleSubmit}
            isLoading={loading}
          >
            {isEditMode ? 'Save Changes' : 'Create Draft'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default DraftEventModal;

