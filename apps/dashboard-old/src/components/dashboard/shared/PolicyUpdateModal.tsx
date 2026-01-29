import React, { useState, useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Checkbox } from '@heroui/react';
import { FileText, Shield, ExternalLink } from 'lucide-react';
import { doc, updateDoc, Timestamp } from 'firebase/firestore';
import { db } from '../../../firebase/client';
import { LEGAL_VERSIONS, needsPolicyUpdate } from '../../../config/legalVersions';
import type { User } from './types/firestore';

interface PolicyUpdateModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: any; // Firebase Auth user
    userData: User | null;
    onAccepted: () => void;
}

export default function PolicyUpdateModal({
    isOpen,
    onClose,
    user,
    userData,
    onAccepted,
}: PolicyUpdateModalProps) {
    const [tosAccepted, setTosAccepted] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Determine which policies need updating
    const { needsTos, needsPrivacy } = needsPolicyUpdate(
        userData?.tosVersion,
        userData?.privacyPolicyVersion
    );

    // Reset checkboxes when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setTosAccepted(false);
            setPrivacyAccepted(false);
            setError(null);
        }
    }, [isOpen]);

    const canProceed = (!needsTos || tosAccepted) && (!needsPrivacy || privacyAccepted);

    const handleAccept = async () => {
        if (!user?.uid || !canProceed) return;

        setLoading(true);
        setError(null);

        try {
            const updateData: any = {};
            const now = Timestamp.now();

            if (needsTos) {
                updateData.tosAcceptedAt = now;
                updateData.tosVersion = LEGAL_VERSIONS.TOS_VERSION;
            }

            if (needsPrivacy) {
                updateData.privacyPolicyAcceptedAt = now;
                updateData.privacyPolicyVersion = LEGAL_VERSIONS.PRIVACY_POLICY_VERSION;
            }

            await updateDoc(doc(db, 'users', user.uid), updateData);
            onAccepted();
            onClose();
        } catch (err: any) {
            console.error('Error updating policy acceptance:', err);
            setError('Failed to save your acceptance. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={() => { }} // Prevent closing by clicking outside
            isDismissable={false}
            hideCloseButton={true}
            size="lg"
            classNames={{
                backdrop: "bg-black/80 backdrop-blur-sm",
            }}
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 pb-2">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <FileText className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Policy Updates</h2>
                            <p className="text-sm text-gray-500 font-normal">
                                Please review and accept our updated policies to continue
                            </p>
                        </div>
                    </div>
                </ModalHeader>

                <ModalBody className="py-4">
                    <div className="space-y-4">
                        <p className="text-gray-600 text-sm">
                            We've updated our legal policies. Please review and accept the following to continue using our services:
                        </p>

                        {/* Terms of Service */}
                        {needsTos && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        <Checkbox
                                            isSelected={tosAccepted}
                                            onValueChange={setTosAccepted}
                                            size="lg"
                                            color="primary"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-4 h-4 text-blue-600" />
                                            <span className="font-medium text-gray-900">Terms of Service</span>
                                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                                                v{LEGAL_VERSIONS.TOS_VERSION}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            Our terms governing your use of IEEE at UCSD services.
                                        </p>
                                        <a
                                            href={LEGAL_VERSIONS.TOS_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                            Read Terms of Service
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Privacy Policy */}
                        {needsPrivacy && (
                            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                                <div className="flex items-start gap-3">
                                    <div className="mt-0.5">
                                        <Checkbox
                                            isSelected={privacyAccepted}
                                            onValueChange={setPrivacyAccepted}
                                            size="lg"
                                            color="primary"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Shield className="w-4 h-4 text-green-600" />
                                            <span className="font-medium text-gray-900">Privacy Policy</span>
                                            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                                                v{LEGAL_VERSIONS.PRIVACY_POLICY_VERSION}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-600 mb-2">
                                            How we collect, use, and protect your personal information.
                                        </p>
                                        <a
                                            href={LEGAL_VERSIONS.PRIVACY_POLICY_URL}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 hover:underline"
                                        >
                                            Read Privacy Policy
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        )}

                        <p className="text-xs text-gray-500">
                            By clicking "Accept & Continue", you agree to the updated policies listed above.
                        </p>
                    </div>
                </ModalBody>

                <ModalFooter className="pt-2">
                    <Button
                        color="primary"
                        onPress={handleAccept}
                        isDisabled={!canProceed}
                        isLoading={loading}
                        className="w-full"
                    >
                        Accept & Continue
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
