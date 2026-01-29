/**
 * EXAMPLE: How to add global paste support to your modal
 * 
 * This file demonstrates the complete integration of the global image paste handler
 * into a modal component. Copy and adapt this pattern for your own modals.
 */

import React, { useState, useRef } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { Upload, X } from 'lucide-react';
import { useGlobalImagePaste } from './useGlobalImagePaste';
import { useModalRegistration } from '../contexts/ModalContext';
import { usePasteNotification } from '../components/PasteNotification';

interface ExampleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ExampleModal({ isOpen, onClose }: ExampleModalProps) {
  // State for file management
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Setup paste notification
  const { showPasteNotification, PasteNotificationComponent } = usePasteNotification(
    'Image pasted successfully!'
  );

  // Register this modal with the global modal context
  // This tells the system that this modal is active when isOpen is true
  useModalRegistration('example-modal', isOpen);

  // Setup global image paste handler
  useGlobalImagePaste({
    modalType: 'example-modal',
    enabled: isOpen, // Only capture paste events when modal is open
    onImagePaste: (file) => {
      // This function is called when user pastes an image
      handleFileSelect(file);
    },
    onPasteSuccess: () => {
      // Show notification when paste is successful
      showPasteNotification();
    },
    onNonImagePaste: () => {
      // Optional: Handle when user pastes non-image content
      console.log('Non-image content pasted');
    }
  });

  // File handling functions
  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      setUploadedFile(file);
      
      // Create preview URL
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select an image file');
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!uploadedFile) {
      alert('Please upload an image');
      return;
    }

    // TODO: Implement your upload logic here
    console.log('Uploading file:', uploadedFile);
    
    // Close modal after successful upload
    onClose();
  };

  return (
    <>
      {/* Render the paste notification component */}
      {PasteNotificationComponent}
      
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-semibold">Upload Image</h2>
          </ModalHeader>

          <ModalBody>
            <div className="space-y-4">
              {/* Instructions */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Tip:</strong> You can paste an image directly using Cmd+V (Mac) or Ctrl+V (Windows)
                </p>
              </div>

              {/* File Upload Area */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image File
                </label>
                
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all ${
                    isDragging
                      ? 'border-primary bg-primary-50 scale-[1.02]'
                      : 'border-gray-300 hover:border-primary hover:bg-gray-50'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileInputChange}
                  />
                  
                  {previewUrl ? (
                    <div className="space-y-3">
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg"
                      />
                      <div className="flex items-center justify-center gap-2">
                        <p className="text-sm text-gray-600">{uploadedFile?.name}</p>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile();
                          }}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-12 h-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">
                          Click to upload, drag and drop, or paste
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          PNG, JPG, GIF up to 10MB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </ModalBody>

          <ModalFooter>
            <Button
              variant="light"
              onPress={onClose}
            >
              Cancel
            </Button>
            <Button
              color="primary"
              onPress={handleSubmit}
              isDisabled={!uploadedFile}
            >
              Upload
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

/**
 * INTEGRATION CHECKLIST:
 * 
 * ✅ 1. Import required hooks and components
 * ✅ 2. Add modal type to ModalType union in useGlobalImagePaste.ts
 * ✅ 3. Setup usePasteNotification hook
 * ✅ 4. Call useModalRegistration with modal type and isOpen state
 * ✅ 5. Call useGlobalImagePaste with configuration
 * ✅ 6. Render PasteNotificationComponent in return statement
 * ✅ 7. Implement handleFileSelect to process pasted images
 * ✅ 8. Test paste functionality
 * 
 * NOTES:
 * - The paste handler automatically ignores paste events in text inputs
 * - Only one modal should be registered at a time
 * - The modal type must be unique across all modals
 * - Paste events only work when the modal is open (enabled: true)
 */

