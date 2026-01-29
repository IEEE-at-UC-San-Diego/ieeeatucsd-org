import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import {
  collection,
  addDoc,
  doc,
  updateDoc,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { app, db } from "../../../../firebase/client";
import { auth } from "../../../../firebase/client";
import { EventAuditService } from "../../shared/services/eventAuditService";
import { EmailClient } from "../../../../scripts/email/EmailClient";
import { showToast } from "../../shared/utils/toast";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Progress,
  Spacer,
} from "@heroui/react";
import { useModalRegistration } from "../../shared/contexts/ModalContext";
import { useGlobalImagePaste } from "../../shared/hooks/useGlobalImagePaste";

// Import refactored components and utilities
import type {
  EventRequestModalProps,
  EventFormData,
  FieldError,
} from "./types/EventRequestTypes";
import { useInvoiceManagement } from "./hooks/useInvoiceManagement";
import { validateStep, validateCompleteForm } from "./utils/validationUtils";
import {
  safeGetTimeString,
  safeGetDateInputString,
  convertLegacyInvoices,
  createSafeDateTime,
} from "./utils/eventRequestUtils";
import {
  uploadFiles,
  uploadFilesForEvent,
  moveFilesToActualEventId,
} from "./utils/fileUploadUtils";

// Import section components
import DisclaimerSection from "./components/DisclaimerSection";
import BasicInformationSection from "./components/BasicInformationSection";
import MarketingSection from "./components/MarketingSection";
import LogisticsSection from "./components/LogisticsSection";
import FundingSection from "./components/FundingSection";
import EventReviewSection from "./components/EventReviewSection";

export default function EventRequestModal({
  onClose,
  editingRequest,
  onSuccess,
  preselectedDate,
}: EventRequestModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});

  // Track original data for comparison when editing
  const [originalData, setOriginalData] = useState<any>(null);

  // Form data
  const [formData, setFormData] = useState<EventFormData>({
    name: "",
    location: "",
    startDate: "",
    startTime: "",
    endTime: "",
    eventDescription: "",
    department: "General",
    eventCode: "",
    pointsToReward: 0,
    flyersNeeded: false,
    flyerType: [],
    otherFlyerType: "",
    flyerAdditionalRequests: "",
    flyersCompleted: false,
    photographyNeeded: false,
    requiredLogos: [],
    otherLogos: [],
    otherLogoFiles: [],
    otherFlyerFiles: [],
    advertisingFormat: "",
    additionalSpecifications: "",
    hasRoomBooking: true,
    roomBookingFile: null,
    expectedAttendance: "",
    servingFoodDrinks: false,
    needsAsFunding: false,
    invoices: [],
    needsGraphics: false,
    // Existing files for editing
    existingRoomBookingFiles: [],
    existingOtherLogos: [],
    existingOtherFlyerFiles: [],
    // Legacy fields for backward compatibility
    itemizedInvoice: [],
    invoiceTax: 0,
    invoiceTip: 0,
    invoiceVendor: "",
    invoice: null,
    invoiceFiles: [],
    existingInvoiceFiles: [],
    existingInvoiceFile: "",
  });

  // Use the invoice management hook
  const {
    invoices,
    setInvoices,
    invoiceTabState,
    jsonImportData,
    activeInvoiceTab,
    setActiveInvoiceTab,
    addInvoice,
    removeInvoice,
    updateInvoice,
    addInvoiceItem,
    removeInvoiceItem,
    updateInvoiceItem,
    handleJsonImport,
    updateJsonImportData,
    updateInvoiceTabState,
  } = useInvoiceManagement(formData.invoices);

  // Sync invoices with form data
  useEffect(() => {
    setFormData((prev) => ({ ...prev, invoices }));
  }, [invoices]);

  // Use db from client

  // Populate form data when editing or with preselected date
  useEffect(() => {
    if (editingRequest) {
      const invoicesData = convertLegacyInvoices(editingRequest);

      // Set original data for comparison
      setOriginalData({
        name: editingRequest.name || "",
        location: editingRequest.location || "",
        startDate: safeGetDateInputString(editingRequest.startDateTime),
        startTime: safeGetTimeString(editingRequest.startDateTime),
        endTime: safeGetTimeString(editingRequest.endDateTime),
        eventDescription: editingRequest.eventDescription || "",
        department: editingRequest.department || "General",
        eventCode: editingRequest.eventCode || "",
        pointsToReward: editingRequest.pointsToReward || 0,
        expectedAttendance: editingRequest.expectedAttendance?.toString() || "",
        needsGraphics: editingRequest.needsGraphics || false,
        needsAsFunding:
          editingRequest.needsAsFunding ||
          editingRequest.asFundingRequired ||
          false,
        flyersNeeded:
          editingRequest.needsGraphics || editingRequest.flyersNeeded || false,
        photographyNeeded: editingRequest.photographyNeeded || false,
        servingFoodDrinks:
          editingRequest.servingFoodDrinks ||
          editingRequest.foodDrinksBeingServed ||
          false,
        hasRoomBooking:
          editingRequest.hasRoomBooking ??
          editingRequest.willOrHaveRoomBooking ??
          true,
        // Marketing fields
        flyerType: editingRequest.flyerType || [],
        requiredLogos: editingRequest.requiredLogos || [],
        advertisingFormat: editingRequest.advertisingFormat || "",
        additionalSpecifications: editingRequest.additionalSpecifications || "",
        flyerAdditionalRequests: editingRequest.flyerAdditionalRequests || "",
        // File fields
        existingRoomBookingFiles: editingRequest.roomBookingFiles || [],
        existingOtherLogos: editingRequest.otherLogos || [],
        existingOtherFlyerFiles: editingRequest.otherFlyerFiles || [],
        existingInvoiceFiles: editingRequest.invoiceFiles || [],
        invoices: invoicesData,
        _firestore: editingRequest,
      });

      setFormData({
        name: editingRequest.name || "",
        location: editingRequest.location || "",
        startDate: safeGetDateInputString(editingRequest.startDateTime),
        startTime: safeGetTimeString(editingRequest.startDateTime),
        endTime: safeGetTimeString(editingRequest.endDateTime),
        eventDescription: editingRequest.eventDescription || "",
        department: editingRequest.department || "General",
        eventCode: editingRequest.eventCode || "",
        pointsToReward: editingRequest.pointsToReward || 0,
        flyersNeeded:
          editingRequest.needsGraphics || editingRequest.flyersNeeded || false,
        flyerType: editingRequest.flyerType || [],
        otherFlyerType: editingRequest.otherFlyerType || "",
        flyerAdditionalRequests: editingRequest.flyerAdditionalRequests || "",
        flyersCompleted: editingRequest.flyersCompleted || false,
        photographyNeeded: editingRequest.photographyNeeded || false,
        requiredLogos: editingRequest.requiredLogos || [],
        otherLogos: editingRequest.otherLogos || [],
        otherLogoFiles: [],
        otherFlyerFiles: [],
        advertisingFormat: editingRequest.advertisingFormat || "",
        additionalSpecifications: editingRequest.additionalSpecifications || "",
        hasRoomBooking:
          editingRequest.hasRoomBooking ??
          editingRequest.willOrHaveRoomBooking ??
          true,
        roomBookingFile: null,
        expectedAttendance: editingRequest.expectedAttendance?.toString() || "",
        servingFoodDrinks:
          editingRequest.servingFoodDrinks ||
          editingRequest.foodDrinksBeingServed ||
          false,
        needsAsFunding:
          editingRequest.needsAsFunding ||
          editingRequest.asFundingRequired ||
          false,
        invoices: invoicesData,
        needsGraphics: editingRequest.needsGraphics || false,
        existingRoomBookingFiles: editingRequest.roomBookingFiles || [],
        existingOtherLogos: editingRequest.otherLogos || [],
        existingOtherFlyerFiles: editingRequest.otherFlyerFiles || [],
        // Legacy fields
        itemizedInvoice: editingRequest.itemizedInvoice || [],
        invoiceTax: editingRequest.invoiceTax || 0,
        invoiceTip: editingRequest.invoiceTip || 0,
        invoiceVendor: editingRequest.invoiceVendor || "",
        invoice: null,
        invoiceFiles: [],
        existingInvoiceFiles: editingRequest.invoiceFiles || [],
        existingInvoiceFile: editingRequest.invoiceFile || "",
      });

      // Initialize invoices in hook
      setInvoices(invoicesData);
    } else if (preselectedDate && !editingRequest) {
      // Set the start date from the calendar selection
      const dateString = safeGetDateInputString(preselectedDate);
      setFormData((prev) => ({
        ...prev,
        startDate: dateString,
      }));
    }
  }, [editingRequest, setInvoices, preselectedDate]);

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleArrayChange = (
    field: string,
    value: string,
    checked: boolean,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: checked
        ? [...(prev[field as keyof EventFormData] as string[]), value]
        : (prev[field as keyof EventFormData] as string[]).filter(
          (item) => item !== value,
        ),
    }));
  };

  const handleFileChange = (field: string, files: FileList | null) => {
    if (files) {
      setFormData((prev) => ({ ...prev, [field]: Array.from(files) }));
    }
  };

  const handleRemoveExistingFile = (
    fileUrl: string,
    fileType:
      | "roomBooking"
      | "invoice"
      | "invoiceFiles"
      | "otherLogos"
      | "otherFlyerFiles",
  ) => {
    setFormData((prev) => {
      switch (fileType) {
        case "roomBooking":
          return {
            ...prev,
            existingRoomBookingFiles: prev.existingRoomBookingFiles.filter(
              (url) => url !== fileUrl,
            ),
          };
        case "otherLogos":
          return {
            ...prev,
            existingOtherLogos: prev.existingOtherLogos.filter(
              (url) => url !== fileUrl,
            ),
          };
        case "otherFlyerFiles":
          return {
            ...prev,
            existingOtherFlyerFiles: prev.existingOtherFlyerFiles.filter(
              (url) => url !== fileUrl,
            ),
          };
        default:
          return prev;
      }
    });
  };

  const scrollToTop = () => {
    const modalContent = document.querySelector(".overflow-y-auto");
    if (modalContent) {
      modalContent.scrollTop = 0;
    }
  };

  const validateCurrentStep = () => {
    const validation = validateStep(currentStep, formData);
    if (!validation.isValid) {
      showToast.error(
        validation.errorMessage || "Please fix the errors before continuing",
      );
      setFieldErrors(validation.errors);
      scrollToTop();
      return false;
    }
    setFieldErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setCurrentStep((prev) => prev + 1);
      scrollToTop();
    }
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => prev - 1);
    scrollToTop();
  };

  const handleSubmit = async () => {
    const validation = validateCompleteForm(formData);
    if (!validation.isValid) {
      showToast.error(
        validation.errorMessage || "Please fix all errors before submitting",
      );
      setFieldErrors(validation.errors);
      scrollToTop();
      return;
    }

    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      showToast.error("You must be logged in to submit an event request.");
      return;
    }

    setLoading(true);

    try {
      const requestedUserId = editingRequest?.requestedUser || currentUserId;
      let persistedEventRequestId: string | null = editingRequest?.id ?? null;

      // For new requests, create a temporary ID for file organization
      // For existing requests, use the existing ID
      const eventId = editingRequest
        ? editingRequest.id
        : `temp_${Date.now()}_${currentUserId}`;

      // Upload files using event-based structure
      let roomBookingUrls: string[] = [];
      let otherLogoUrls: string[] = [];
      let otherFlyerUrls: string[] = [];

      if (formData.roomBookingFile) {
        roomBookingUrls = await uploadFilesForEvent(
          [formData.roomBookingFile],
          eventId,
          "room_booking",
        );
      }

      if (formData.otherLogoFiles.length > 0) {
        otherLogoUrls = await uploadFilesForEvent(
          formData.otherLogoFiles,
          eventId,
          "logo",
        );
      }

      if (formData.otherFlyerFiles.length > 0) {
        otherFlyerUrls = await uploadFilesForEvent(
          formData.otherFlyerFiles,
          eventId,
          "flyer",
        );
      }

      // Process invoices with file uploads
      const processedInvoices = await Promise.all(
        invoices.map(async (invoice) => {
          // Handle multiple invoice files
          let invoiceFileUrls: string[] = [
            ...(invoice.existingInvoiceFiles || []),
          ];

          if (invoice.invoiceFiles && invoice.invoiceFiles.length > 0) {
            const uploadedUrls = await uploadFilesForEvent(
              invoice.invoiceFiles,
              eventId,
              "invoice",
            );
            invoiceFileUrls = [...invoiceFileUrls, ...uploadedUrls];
          }

          const subtotal = invoice.items.reduce(
            (sum, item) => sum + item.total,
            0,
          );
          const total = subtotal + invoice.tax + invoice.tip;

          return {
            ...invoice,
            invoiceFiles: invoiceFileUrls,
            // Legacy field for backward compatibility
            invoiceFile: invoiceFileUrls[0] || "",
            subtotal,
            total,
          };
        }),
      );

      // Merge existing files with new uploads
      const finalRoomBookingUrls = editingRequest
        ? [...formData.existingRoomBookingFiles, ...roomBookingUrls]
        : roomBookingUrls;

      const finalOtherLogoUrls = editingRequest
        ? [...formData.existingOtherLogos, ...otherLogoUrls]
        : otherLogoUrls;

      // Create event request data
      // Parse the date from user input (MM/DD/YYYY) to YYYY-MM-DD format for storage
      const { parseDateMMDDYY } = await import('./utils/eventRequestUtils');
      const parsedDate = parseDateMMDDYY(formData.startDate);
      
      if (!parsedDate) {
        showToast.error('Invalid date format. Please use MM/DD/YYYY format.');
        setLoading(false);
        return;
      }
      
      const startDateTime = createSafeDateTime(
        parsedDate,
        formData.startTime,
      );
      const endDateTime = createSafeDateTime(
        parsedDate,
        formData.endTime,
      );

      const eventRequestData = {
        name: formData.name,
        location: formData.location,
        startDateTime,
        endDateTime,
        eventDescription: formData.eventDescription,
        department: formData.department,
        eventCode: formData.eventCode,
        pointsToReward: formData.pointsToReward,
        expectedAttendance: parseInt(formData.expectedAttendance) || 0,
        needsGraphics: formData.needsGraphics,
        flyersNeeded: formData.flyersNeeded,
        flyerType: formData.flyerType,
        otherFlyerType: formData.otherFlyerType,
        flyerAdditionalRequests: formData.flyerAdditionalRequests,
        flyersCompleted: formData.flyersCompleted,
        photographyNeeded: formData.photographyNeeded,
        requiredLogos: formData.requiredLogos,
        otherLogos: finalOtherLogoUrls,
        otherFlyerFiles: [
          ...(formData.existingOtherFlyerFiles || []),
          ...otherFlyerUrls,
        ],
        advertisingFormat: formData.advertisingFormat,
        additionalSpecifications: formData.additionalSpecifications,
        hasRoomBooking: formData.hasRoomBooking,
        roomBookingFiles: finalRoomBookingUrls,
        servingFoodDrinks: formData.servingFoodDrinks,
        needsAsFunding: formData.needsAsFunding,
        invoices: processedInvoices,
        // Legacy fields for backward compatibility
        itemizedInvoice:
          processedInvoices.length > 0 ? processedInvoices[0].items : [],
        invoiceTax: processedInvoices.length > 0 ? processedInvoices[0].tax : 0,
        invoiceTip: processedInvoices.length > 0 ? processedInvoices[0].tip : 0,
        invoiceVendor:
          processedInvoices.length > 0 ? processedInvoices[0].vendor : "",
        invoiceFile:
          processedInvoices.length > 0 ? processedInvoices[0].invoiceFile : "",
        // When converting a draft to full submission, change status to "submitted" and clear isDraft flag
        status: editingRequest?.isDraft ? "submitted" : (editingRequest ? editingRequest.status : "submitted"),
        isDraft: false, // Always set to false when submitting through full event form
        requestedUser: requestedUserId,
        createdAt: editingRequest ? editingRequest.createdAt : new Date(),
        updatedAt: new Date(),
      };

      let eventRequestRef;

      if (editingRequest) {
        // Update existing event request
        eventRequestRef = doc(db, "event_requests", editingRequest.id);
        await updateDoc(eventRequestRef, eventRequestData);

        // Log event update
        try {
          const userName = await EventAuditService.getUserName(
            auth.currentUser?.uid || "",
          );

          // If converting from draft to submitted, log as status change
          if (editingRequest.isDraft && eventRequestData.status === "submitted") {
            await EventAuditService.logStatusChange(
              editingRequest.id,
              auth.currentUser?.uid || "",
              editingRequest.status || "unknown",
              "submitted",
              undefined,
              userName,
              { eventName: formData.name },
            );
          }

          const fieldMappings = {
            name: "Event Name",
            location: "Location",
            startDateTime: "Start Date/Time",
            endDateTime: "End Date/Time",
            eventDescription: "Description",
            department: "Department",
            expectedAttendance: "Expected Attendance",
            needsGraphics: "Graphics Needed",
            needsAsFunding: "AS Funding Needed",
          };
          const changes = EventAuditService.generateFieldChanges(
            originalData?._firestore || originalData,
            eventRequestData,
            fieldMappings,
          );

          if (changes.length > 0) {
            await EventAuditService.logEventUpdate(
              editingRequest.id,
              auth.currentUser?.uid || "",
              changes,
              userName,
              [], // Empty array instead of undefined
              { eventName: formData.name },
            );
          }
        } catch (error) {
          console.error("Error logging event update:", error);
        }

        const successMessage = editingRequest.isDraft
          ? "Draft event converted to full submission successfully!"
          : "Event request updated successfully!";
        showToast.success(successMessage);
      } else {
        // Create new event request
        eventRequestRef = await addDoc(
          collection(db, "event_requests"),
          eventRequestData,
        );
        persistedEventRequestId = (eventRequestRef as any).id;

        if (!persistedEventRequestId) {
          throw new Error("Failed to create event request ID");
        }

        // If we used a temporary ID for file uploads, we need to move the files
        if (eventId.startsWith("temp_")) {
          try {
            // Collect all file URLs that need to be moved
            const allFileUrls = [
              ...roomBookingUrls,
              ...otherLogoUrls,
              ...processedInvoices.flatMap((inv) => inv.invoiceFiles || []),
            ];

            if (allFileUrls.length > 0) {
              const movedUrls = await moveFilesToActualEventId(
                eventId,
                persistedEventRequestId,
                allFileUrls,
              );

              // Update the event request with the new URLs
              const updatedData: any = {};

              if (roomBookingUrls.length > 0) {
                updatedData.roomBookingFiles = movedUrls.slice(
                  0,
                  roomBookingUrls.length,
                );
              }

              if (otherLogoUrls.length > 0) {
                const startIndex = roomBookingUrls.length;
                updatedData.otherLogos = movedUrls.slice(
                  startIndex,
                  startIndex + otherLogoUrls.length,
                );
              }

              // Update invoice files if any
              if (processedInvoices.some((inv) => inv.invoiceFiles?.length)) {
                // If needed, update invoice URLs on newly created doc here
                // Currently invoiceFiles are already in eventRequestData via processedInvoices
              }

              if (Object.keys(updatedData).length > 0) {
                await updateDoc(eventRequestRef, updatedData);
              }
            }
          } catch (error) {
            console.error("Error moving files to actual event ID:", error);
            // Continue anyway - files can be moved later via migration
          }
        }

        // Log event creation
        try {
          const userName = await EventAuditService.getUserName(
            auth.currentUser?.uid || "",
          );
          await EventAuditService.logEventCreation(
            persistedEventRequestId,
            userName,
            userName,
            { eventName: formData.name },
          );
        } catch (error) {
          console.error("Error logging event creation:", error);
        }

        showToast.success("Event request submitted successfully!");
      }

      const eventRequestId = persistedEventRequestId ?? (eventRequestRef as any)?.id;
      if (!eventRequestId) {
        throw new Error("Unable to determine linked event request ID");
      }

      // Handle corresponding event in events collection
      const eventData = {
        eventName: formData.name,
        eventDescription: formData.eventDescription,
        startDate: startDateTime,
        endDate: endDateTime,
        location: formData.location,
        files: [],
        privateFiles: [],
        pointsToReward: formData.pointsToReward,
        eventCode: formData.eventCode,
        createdFrom: eventRequestId,
        status: "draft",
      };

      if (editingRequest) {
        // Find and update corresponding event
        const eventsQuery = query(
          collection(db, "events"),
          where("createdFrom", "==", eventRequestId),
        );
        const eventsSnapshot = await getDocs(eventsQuery);

        if (!eventsSnapshot.empty) {
          const eventDoc = eventsSnapshot.docs[0];
          const existingEventData = eventDoc.data();

          const updatedEventData = {
            ...eventData,
            files: existingEventData.files || [],
            privateFiles: existingEventData.privateFiles || [],
          };

          await updateDoc(eventDoc.ref, updatedEventData);
        } else {
          await addDoc(collection(db, "events"), eventData);
        }
      } else {
        await addDoc(collection(db, "events"), eventData);
      }

      // Send email notification for new submissions or draft conversions
      const wasDraftConversion = editingRequest?.isDraft && eventRequestData.status === "submitted";
      if (!editingRequest || wasDraftConversion) {
        try {
          await EmailClient.notifyFirebaseEventRequestSubmission(
            eventRequestId,
          );
        } catch (error) {
          console.error("Error sending email notification:", error);
        }
      }

      // Note: Event creation in the events collection is skipped for non-officers
      // Officers can create/manage events separately through the dashboard
      // This prevents permission errors for regular users submitting event requests

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Error submitting event request:", error);
      showToast.error("Failed to submit event request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getSteps = () => {
    const baseSteps = [
      {
        title: "Important Information",
        component: () => <DisclaimerSection />,
      },
      {
        title: "Basic Information",
        component: () => (
          <BasicInformationSection
            formData={formData}
            fieldErrors={fieldErrors}
            onInputChange={handleInputChange}
            editingRequestId={editingRequest?.id}
          />
        ),
      },
      {
        title: "Marketing & Graphics",
        component: () => (
          <MarketingSection
            formData={formData}
            onInputChange={handleInputChange}
            onArrayChange={handleArrayChange}
            onFileChange={handleFileChange}
            onRemoveExistingFile={handleRemoveExistingFile}
            eventRequestId={editingRequest?.id}
          />
        ),
      },
      {
        title: "Logistics",
        component: () => (
          <LogisticsSection
            formData={formData}
            onInputChange={handleInputChange}
            onRemoveExistingFile={handleRemoveExistingFile}
            eventRequestId={editingRequest?.id}
          />
        ),
      },
    ];

    // Add funding step if needed
    if (formData.needsAsFunding) {
      baseSteps.push({
        title: "Funding Details",
        component: () => (
          <FundingSection
            needsAsFunding={formData.needsAsFunding}
            invoices={invoices}
            invoiceTabState={invoiceTabState}
            jsonImportData={jsonImportData}
            activeInvoiceTab={activeInvoiceTab}
            onAddInvoice={addInvoice}
            onRemoveInvoice={removeInvoice}
            onUpdateInvoice={updateInvoice}
            onAddInvoiceItem={addInvoiceItem}
            onRemoveInvoiceItem={removeInvoiceItem}
            onUpdateInvoiceItem={(
              invoiceId: string,
              itemIndex: number,
              field: string,
              value: string | number,
            ) =>
              updateInvoiceItem(
                invoiceId,
                itemIndex,
                field as keyof import("./types/EventRequestTypes").ItemizedInvoiceItem,
                value,
              )
            }
            onHandleJsonImport={handleJsonImport}
            onUpdateJsonImportData={updateJsonImportData}
            onUpdateInvoiceTabState={updateInvoiceTabState}
            onSetActiveInvoiceTab={setActiveInvoiceTab}
            onRemoveExistingFile={handleRemoveExistingFile}
            eventRequestId={editingRequest?.id}
          />
        ),
      });
    }

    // Add review step as the final step
    baseSteps.push({
      title: "Review & Submit",
      component: () => (
        <EventReviewSection
          formData={formData}
          isInlineStep={true}
          showRoomBookingWarning={true}
          originalData={originalData}
          isEditMode={!!editingRequest}
          onConfirm={handleSubmit}
          onCancel={onClose}
          onBack={handlePrevious}
          isSubmitting={loading}
        />
      ),
    });

    return baseSteps;
  };

  const steps = getSteps();
  const isLastStep = currentStep === steps.length - 1;
  const isOpen = true; // Modal is open when component is mounted

  // Register modal for global paste functionality
  useModalRegistration("event-request", isOpen);

  // Handle global image paste
  useGlobalImagePaste({
    modalType: "event-request",
    enabled: isOpen && !loading,
    onImagePaste: (file) => {
      // Route pasted image to appropriate field based on current step
      const stepTitle = steps[currentStep]?.title;

      if (stepTitle === "Marketing & Graphics") {
        // Check if we're in the "Other" flyer type section
        if (
          formData.flyerType.includes(
            "Other (please specify in additional requests)",
          )
        ) {
          // Add to other flyer files (accumulate, don't replace)
          const existingFiles = Array.isArray(formData.otherFlyerFiles)
            ? formData.otherFlyerFiles
            : formData.otherFlyerFiles
              ? [formData.otherFlyerFiles]
              : [];
          const newFiles = [...existingFiles, file];
          const fileList = {
            ...newFiles,
            length: newFiles.length,
            item: (index: number) => newFiles[index] || null,
          } as FileList;
          handleFileChange("otherFlyerFiles", fileList);
          showToast.success(
            `Image added to Other Flyer Reference Files: ${file.name}`,
          );
        }
        // Check if we're in the "OTHER" logos section
        else if (
          formData.requiredLogos.includes(
            "OTHER (please upload transparent logo files)",
          )
        ) {
          // Add to other logo files (accumulate, don't replace)
          const existingFiles = Array.isArray(formData.otherLogoFiles)
            ? formData.otherLogoFiles
            : formData.otherLogoFiles
              ? [formData.otherLogoFiles]
              : [];
          const newFiles = [...existingFiles, file];
          const fileList = {
            ...newFiles,
            length: newFiles.length,
            item: (index: number) => newFiles[index] || null,
          } as FileList;
          handleFileChange("otherLogoFiles", fileList);
          showToast.success(`Image added to Other Logo Files: ${file.name}`);
        } else {
          showToast.info(
            `Paste functionality available when "Other" options are selected`,
          );
        }
      } else if (stepTitle === "Logistics") {
        // Add to room booking file if room booking is enabled
        if (formData.hasRoomBooking) {
          const fileList = {
            0: file,
            length: 1,
            item: (index: number) => (index === 0 ? file : null),
            [Symbol.iterator]: function* () {
              yield file;
            },
          } as unknown as FileList;
          handleFileChange("roomBookingFile", fileList);
          showToast.success(
            `Image added to Room Booking Confirmation: ${file.name}`,
          );
        } else {
          showToast.info(`Enable room booking to paste files`);
        }
      } else if (stepTitle === "Funding Details") {
        // Add to active invoice's files
        if (invoices.length > 0) {
          const activeInvoice = invoices.find(
            (inv) => inv.id === activeInvoiceTab,
          );
          if (activeInvoice) {
            const existingFiles = Array.isArray(activeInvoice.invoiceFiles)
              ? activeInvoice.invoiceFiles
              : activeInvoice.invoiceFiles
                ? [activeInvoice.invoiceFiles]
                : [];
            const newFiles = [...existingFiles, file];
            updateInvoice(activeInvoice.id, {
              invoiceFiles: newFiles,
              invoiceFile: newFiles[0] || file,
            });
            showToast.success(`Image added to invoice: ${file.name}`);
          } else {
            showToast.info(`Select an invoice to paste files`);
          }
        } else {
          showToast.info(`Add an invoice first to paste files`);
        }
      } else {
        showToast.info(
          `Image paste is available in Marketing, Logistics, and Funding steps`,
        );
      }
    },
    onPasteSuccess: () => {
      // Optional: Show additional feedback
    },
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="4xl"
      scrollBehavior="inside"
      isDismissable={!loading}
      isKeyboardDismissDisabled={loading}
      classNames={{
        base: "max-h-[90vh]",
        wrapper: "items-center justify-center",
      }}
    >
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex flex-col gap-1 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingRequest ? "Edit Event Request" : "New Event Request"}
              </h2>
            </ModalHeader>

            <ModalBody className="p-0">
              {/* Progress Bar */}
              <div className="px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Step {currentStep + 1} of {steps.length}
                  </span>
                  <span className="text-sm text-gray-500">
                    {steps[currentStep]?.title}
                  </span>
                </div>
                <Progress
                  value={((currentStep + 1) / steps.length) * 100}
                  color="primary"
                  size="sm"
                  className="w-full"
                />
              </div>

              {/* Content */}
              <div className="p-6">
                {steps[currentStep]?.component()}
              </div>
            </ModalBody>

            <ModalFooter className="border-t border-gray-200">
              {/* Cancel Button - Leftmost */}
              <Button
                variant="bordered"
                onPress={onModalClose}
                isDisabled={loading}
              >
                Cancel
              </Button>

              {/* Spacer */}
              <Spacer />

              {/* Right side buttons */}
              <div className="flex gap-3">
                <Button
                  variant="light"
                  onPress={handlePrevious}
                  isDisabled={currentStep === 0 || loading}
                >
                  Previous
                </Button>

                {isLastStep ? (
                  <Button
                    color="primary"
                    onPress={handleSubmit}
                    isLoading={loading}
                    isDisabled={loading}
                  >
                    {editingRequest ? "Update Request" : "Submit Request"}
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    onPress={handleNext}
                    isDisabled={loading}
                  >
                    Next
                  </Button>
                )}
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
