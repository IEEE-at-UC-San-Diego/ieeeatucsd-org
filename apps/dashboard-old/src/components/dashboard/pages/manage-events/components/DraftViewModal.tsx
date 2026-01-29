import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Chip,
  Spacer,
} from '@heroui/react';
import { Calendar, MapPin, FileText, Trash2, FileUp, Clock, Edit } from 'lucide-react';
import { formatDateTime, formatDate } from '../event-view-modal/utils';

interface DraftViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  draftEvent: {
    id: string;
    name: string;
    location?: string;
    startDateTime: any;
    endDateTime: any;
    eventDescription?: string;
    createdAt: any;
    requestedUser: string;
    [key: string]: any;
  } | null;
  onConvertToFull: () => void;
  onDelete: () => void;
  onEdit: () => void;
  userName: string;
}

export function DraftViewModal({
  isOpen,
  onClose,
  draftEvent,
  onConvertToFull,
  onDelete,
  onEdit,
  userName,
}: DraftViewModalProps) {
  if (!draftEvent) return null;

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
        <ModalHeader className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-[#0A2463]">Draft Event</h2>
            <Chip
              color="default"
              variant="bordered"
              size="sm"
              className="border-dashed"
            >
              DRAFT
            </Chip>
          </div>
          <p className="text-sm text-gray-600 font-normal">
            This is a draft event for planning purposes. Convert it to a full event request to add details and submit for approval.
          </p>
        </ModalHeader>

        <ModalBody>
          <div className="space-y-6">
            {/* Event Name */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Event Name
                </h3>
              </div>
              <p className="text-lg font-medium text-gray-900 ml-6">
                {draftEvent.name}
              </p>
            </div>

            {/* Location */}
            {draftEvent.location && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Location
                  </h3>
                </div>
                <p className="text-gray-900 ml-6">{draftEvent.location}</p>
              </div>
            )}

            {/* Date & Time */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Date & Time
                </h3>
              </div>
              <div className="ml-6 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">Start:</span>
                  <span className="text-gray-900">{formatDateTime(draftEvent.startDateTime)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">End:</span>
                  <span className="text-gray-900">{formatDateTime(draftEvent.endDateTime)}</span>
                </div>
              </div>
            </div>

            {/* Description */}
            {draftEvent.eventDescription && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-gray-500" />
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Description
                  </h3>
                </div>
                <p className="text-gray-900 ml-6 whitespace-pre-wrap">
                  {draftEvent.eventDescription}
                </p>
              </div>
            )}

            {/* Metadata */}
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                  Draft Information
                </h3>
              </div>
              <div className="ml-6 space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">Created by:</span>
                  <span className="text-gray-900">{userName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 font-medium">Created on:</span>
                  <span className="text-gray-900">{formatDate(draftEvent.createdAt)}</span>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Next Steps</h4>
              <p className="text-sm text-blue-800">
                To submit this event for approval, click "Convert to Full Event Request" below.
                You'll be able to add all required details including room bookings, graphics requirements,
                funding information, and more.
              </p>
            </div>
          </div>
        </ModalBody>

        <ModalFooter className="flex justify-between">
          <div className="flex gap-2">
            <Button
              color="default"
              variant="light"
              onPress={onClose}
            >
              Close
            </Button>
            <Button
              color="danger"
              variant="light"
              startContent={<Trash2 className="w-4 h-4" />}
              onPress={onDelete}
            >
              Delete Draft
            </Button>
          </div>
          <Spacer />
          <div className="flex gap-2">
            <Button
              color="primary"
              variant="flat"
              startContent={<Edit className="w-4 h-4" />}
              onPress={onEdit}
            >
              Edit Draft
            </Button>
            <Button
              style={{ backgroundColor: '#0A2463' }}
              className="text-white"
              startContent={<FileUp className="w-4 h-4" />}
              onPress={onConvertToFull}
            >
              Convert to Full Event Request
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

