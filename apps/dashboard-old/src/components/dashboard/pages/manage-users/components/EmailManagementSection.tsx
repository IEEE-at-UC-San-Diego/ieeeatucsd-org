import { useState } from 'react';
import { Mail, AlertTriangle, Trash2, Power, PowerOff, Edit3, Save, XCircle } from 'lucide-react';
import { Card, CardBody, Button, Input, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Spacer } from '@heroui/react';
import type { UserModalData } from '../types/UserManagementTypes';
import { showToast } from '../../../shared/utils/toast';

interface EmailManagementSectionProps {
    editingUser: UserModalData;
    onEmailAction: (action: 'disable' | 'enable' | 'delete', userId: string, email?: string) => Promise<void>;
    currentUserId?: string;
}

export default function EmailManagementSection({
    editingUser,
    onEmailAction,
    currentUserId
}: EmailManagementSectionProps) {
    const [emailOperationLoading, setEmailOperationLoading] = useState(false);
    const [showEmailConfirmDialog, setShowEmailConfirmDialog] = useState<{
        action: 'disable' | 'enable' | 'delete';
        email: string;
    } | null>(null);
    const [isEditingAlias, setIsEditingAlias] = useState(false);
    const [newAlias, setNewAlias] = useState('');
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [generatedPassword, setGeneratedPassword] = useState('');
    const [generatedEmail, setGeneratedEmail] = useState('');
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [confirmationData, setConfirmationData] = useState<{
        message: string;
        existingEmail: string;
        currentOwner: { id: string; name: string; email: string } | null;
    } | null>(null);

    const handleEmailAction = async (action: 'disable' | 'enable' | 'delete') => {
        if (!editingUser?.ieeeEmail) return;
        setShowEmailConfirmDialog({ action, email: editingUser.ieeeEmail });
    };

    const confirmEmailAction = async () => {
        if (!showEmailConfirmDialog || !editingUser?.id) return;

        setEmailOperationLoading(true);
        try {
            await onEmailAction(
                showEmailConfirmDialog.action,
                editingUser.id,
                showEmailConfirmDialog.email
            );
            setShowEmailConfirmDialog(null);
        } catch (error) {
            console.error('Email operation failed:', error);
        } finally {
            setEmailOperationLoading(false);
        }
    };

    const handleStartEditAlias = () => {
        if (editingUser?.ieeeEmail) {
            const currentAlias = editingUser.ieeeEmail.split('@')[0];
            setNewAlias(currentAlias);
            setIsEditingAlias(true);
        }
    };

    const handleCancelEditAlias = () => {
        setIsEditingAlias(false);
        setNewAlias('');
    };

    const handleSaveAlias = async (confirmed = false) => {
        if (!newAlias.trim()) return;

        // Validate alias format
        const aliasRegex = /^[a-zA-Z0-9._-]+$/;
        if (!aliasRegex.test(newAlias)) {
            showToast.error('Invalid alias format. Only letters, numbers, dots, hyphens, and underscores are allowed.');
            return;
        }

        // If user has existing email, check if alias changed
        if (editingUser?.ieeeEmail) {
            const currentAlias = editingUser.ieeeEmail.split('@')[0];
            if (newAlias === currentAlias) {
                setIsEditingAlias(false);
                return;
            }
        }

        setEmailOperationLoading(true);
        try {
            const response = await fetch('/api/update-ieee-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: editingUser.id,
                    newAlias: newAlias.trim(),
                    adminUserId: currentUserId || editingUser.id,
                    confirmed: confirmed,
                }),
            });

            const result = await response.json();

            // Check if confirmation is required BEFORE checking response.ok
            // This is important because 409 responses are not "ok" but are expected
            if (result.requiresConfirmation) {
                setConfirmationData({
                    message: result.message,
                    existingEmail: result.data?.existingEmail,
                    currentOwner: result.data?.currentOwner || null,
                });
                setShowConfirmationModal(true);
                setEmailOperationLoading(false);
                return;
            }

            // Now check for other errors
            if (!response.ok || !result.success) {
                throw new Error(result.message || 'Failed to update email alias');
            }

            // Show success message with password if this was a new email creation
            if (result.data?.password) {
                setGeneratedEmail(result.data.ieeeEmail);
                setGeneratedPassword(result.data.password);
                setShowPasswordModal(true);
            } else {
                showToast.success(result.data?.message || 'Email alias updated successfully!');
            }

            setIsEditingAlias(false);
            setNewAlias('');

            // Refresh the page to show updated email
            window.location.reload();
        } catch (error) {
            console.error('Alias update failed:', error);
            showToast.error(error instanceof Error ? error.message : 'Failed to update email alias');
        } finally {
            setEmailOperationLoading(false);
        }
    };

    const handleConfirmClaim = async () => {
        setShowConfirmationModal(false);
        await handleSaveAlias(true);
    };

    return (
        <>
            <div className="space-y-5 pt-8 mt-8 border-t border-gray-100">
                <div className="flex items-center gap-3 mb-6">
                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50">
                        <Mail className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-gray-900">IEEE Email Management</h3>
                        <p className="text-xs text-gray-500 mt-1">Manage user's IEEE email account (Executive Officers and Administrators)</p>
                    </div>
                </div>

                {editingUser.hasIEEEEmail && editingUser.ieeeEmail ? (
                    <div className="space-y-5">
                        <Card shadow="sm" className="rounded-xl border border-gray-100 bg-gradient-to-br from-white to-gray-50/30">
                            <CardBody className="p-6 space-y-5">
                                {/* Email Address with Edit Functionality */}
                                <div className="max-w-full overflow-hidden">
                                    <label className="block text-sm font-medium text-gray-700 mb-3">
                                        Email Address
                                    </label>
                                    {isEditingAlias ? (
                                        <div className="flex items-center gap-2 max-w-full">
                                            <div className="flex-1 min-w-0">
                                                <Input
                                                    type="text"
                                                    value={newAlias}
                                                    onChange={(e) => setNewAlias(e.target.value)}
                                                    placeholder="Enter alias"
                                                    size="md"
                                                    classNames={{
                                                        base: "max-w-full",
                                                        inputWrapper: "rounded-lg max-w-full h-11 shadow-sm border border-gray-200"
                                                    }}
                                                    endContent={
                                                        <span className="text-sm text-gray-500 font-medium whitespace-nowrap">@ieeeucsd.org</span>
                                                    }
                                                />
                                            </div>
                                            <Button
                                                isIconOnly
                                                color="success"
                                                variant="flat"
                                                size="md"
                                                onPress={() => handleSaveAlias(false)}
                                                isDisabled={emailOperationLoading || !newAlias.trim()}
                                                className="rounded-lg flex-shrink-0 h-11 w-11 shadow-sm"
                                            >
                                                <Save className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                isIconOnly
                                                variant="flat"
                                                size="md"
                                                onPress={handleCancelEditAlias}
                                                isDisabled={emailOperationLoading}
                                                className="rounded-lg flex-shrink-0 h-11 w-11 shadow-sm"
                                            >
                                                <XCircle className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between gap-3 max-w-full bg-gray-50 rounded-lg px-4 py-3 border border-gray-100">
                                            <p className="text-base font-semibold text-gray-900 truncate flex-1 min-w-0">{editingUser.ieeeEmail}</p>
                                            <Button
                                                isIconOnly
                                                size="sm"
                                                variant="light"
                                                onPress={handleStartEditAlias}
                                                className="rounded-lg flex-shrink-0 hover:bg-white transition-colors"
                                            >
                                                <Edit3 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* Email Metadata */}
                                <div className="pt-5 border-t border-gray-100">
                                    <div className="grid grid-cols-2 gap-5 max-w-full">
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Created</p>
                                            <p className="text-sm font-semibold text-gray-900 truncate">
                                                {editingUser.ieeeEmailCreatedAt ?
                                                    new Date(editingUser.ieeeEmailCreatedAt.toDate()).toLocaleDateString('en-US', {
                                                        month: 'short',
                                                        day: 'numeric',
                                                        year: 'numeric'
                                                    }) :
                                                    'Unknown'
                                                }
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Status</p>
                                            <div className="flex items-center gap-2">
                                                <div className={`w-2 h-2 rounded-full ${editingUser.ieeeEmailStatus === 'disabled' ? 'bg-danger' : 'bg-success'
                                                    }`} />
                                                <span className={`text-sm font-semibold ${editingUser.ieeeEmailStatus === 'disabled' ? 'text-danger' : 'text-success'
                                                    }`}>
                                                    {editingUser.ieeeEmailStatus === 'disabled' ? 'Disabled' : 'Active'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardBody>
                        </Card>

                        <div className="flex flex-wrap gap-3 max-w-full pt-2">
                            {editingUser.ieeeEmailStatus !== 'disabled' ? (
                                <Button
                                    color="warning"
                                    variant="flat"
                                    size="lg"
                                    onPress={() => handleEmailAction('disable')}
                                    startContent={<PowerOff className="w-4 h-4" />}
                                    isDisabled={emailOperationLoading}
                                    className="rounded-2xl shadow-sm font-medium px-6"
                                >
                                    Disable Email
                                </Button>
                            ) : (
                                <Button
                                    color="success"
                                    variant="flat"
                                    size="lg"
                                    onPress={() => handleEmailAction('enable')}
                                    startContent={<Power className="w-4 h-4" />}
                                    isDisabled={emailOperationLoading}
                                    className="rounded-2xl shadow-sm font-medium px-6"
                                >
                                    Enable Email
                                </Button>
                            )}

                            <Button
                                color="danger"
                                variant="flat"
                                size="lg"
                                onPress={() => handleEmailAction('delete')}
                                startContent={<Trash2 className="w-4 h-4" />}
                                isDisabled={emailOperationLoading}
                                className="rounded-2xl shadow-sm font-medium px-6"
                            >
                                Delete Email
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Card shadow="sm" className="rounded-xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                        <CardBody className="p-6">
                            <div className="flex flex-col items-center gap-4 mb-6">
                                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                                    <Mail className="w-6 h-6 text-gray-400" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-medium text-gray-900 mb-1">No IEEE Email</p>
                                    <p className="text-xs text-gray-500">Create an IEEE email account for this user</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Alias
                                    </label>
                                    <Input
                                        type="text"
                                        value={newAlias}
                                        onChange={(e) => setNewAlias(e.target.value)}
                                        placeholder="Enter desired alias"
                                        size="lg"
                                        classNames={{
                                            inputWrapper: "rounded-lg shadow-sm border border-gray-200"
                                        }}
                                        endContent={
                                            <span className="text-sm text-gray-500 font-medium whitespace-nowrap">@ieeeucsd.org</span>
                                        }
                                    />
                                    <p className="text-xs text-gray-500 mt-2">
                                        Only letters, numbers, dots, hyphens, and underscores are allowed
                                    </p>
                                </div>

                                <Button
                                    color="primary"
                                    size="lg"
                                    onPress={() => handleSaveAlias(false)}
                                    isLoading={emailOperationLoading}
                                    isDisabled={!newAlias.trim() || emailOperationLoading}
                                    className="w-full rounded-lg font-medium"
                                    startContent={!emailOperationLoading && <Mail className="w-4 h-4" />}
                                >
                                    Create IEEE Email
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                )}
            </div>

            {/* Email Action Confirmation Dialog */}
            {showEmailConfirmDialog && (
                <Modal
                    isOpen={true}
                    onClose={() => setShowEmailConfirmDialog(null)}
                    size="md"
                    classNames={{
                        base: "rounded-xl",
                        header: "border-b border-gray-200 py-5 px-6",
                        body: "py-6 px-6",
                        footer: "border-t border-gray-200 py-5 px-6"
                    }}
                >
                    <ModalContent>
                        <ModalHeader className="flex-col items-start gap-1">
                            <div className="flex items-center gap-3">
                                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${showEmailConfirmDialog.action === 'delete' ? 'bg-danger-50' :
                                    showEmailConfirmDialog.action === 'disable' ? 'bg-warning-50' : 'bg-success-50'
                                    }`}>
                                    <AlertTriangle className={`w-5 h-5 ${showEmailConfirmDialog.action === 'delete' ? 'text-danger' :
                                        showEmailConfirmDialog.action === 'disable' ? 'text-warning' : 'text-success'
                                        }`} />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Confirm Email {showEmailConfirmDialog.action === 'delete' ? 'Deletion' :
                                        showEmailConfirmDialog.action === 'disable' ? 'Disable' : 'Enable'}
                                </h3>
                            </div>
                        </ModalHeader>

                        <ModalBody>
                            <p className="text-sm text-gray-600 leading-relaxed py-2">
                                {showEmailConfirmDialog.action === 'delete' &&
                                    `Are you sure you want to permanently delete the email address "${showEmailConfirmDialog.email}"? This action cannot be undone.`
                                }
                                {showEmailConfirmDialog.action === 'disable' &&
                                    `Are you sure you want to disable the email address "${showEmailConfirmDialog.email}"? The user will not be able to receive new emails.`
                                }
                                {showEmailConfirmDialog.action === 'enable' &&
                                    `Are you sure you want to enable the email address "${showEmailConfirmDialog.email}"?`
                                }
                            </p>
                        </ModalBody>

                        <ModalFooter>
                            <Button
                                variant="flat"
                                onPress={() => setShowEmailConfirmDialog(null)}
                                isDisabled={emailOperationLoading}
                                size="lg"
                                className="rounded-lg font-medium px-6"
                            >
                                Cancel
                            </Button>
                            <Spacer />
                            <Button
                                color={showEmailConfirmDialog.action === 'delete' ? 'danger' :
                                    showEmailConfirmDialog.action === 'disable' ? 'warning' : 'success'}
                                onPress={confirmEmailAction}
                                isLoading={emailOperationLoading}
                                size="lg"
                                className="rounded-lg font-medium px-6"
                            >
                                {showEmailConfirmDialog.action === 'delete' ? 'Delete Email' :
                                    showEmailConfirmDialog.action === 'disable' ? 'Disable Email' : 'Enable Email'}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}

            {/* Email Claim Confirmation Modal */}
            {showConfirmationModal && confirmationData && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        setShowConfirmationModal(false);
                        setConfirmationData(null);
                    }}
                    size="lg"
                    classNames={{
                        base: "rounded-xl",
                        header: "border-b border-gray-200 py-5 px-6",
                        body: "py-6 px-6",
                        footer: "border-t border-gray-200 py-5 px-6"
                    }}
                >
                    <ModalContent>
                        <ModalHeader className="flex-col items-start gap-1">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-warning-50">
                                    <AlertTriangle className="w-5 h-5 text-warning" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Email Already Exists
                                </h3>
                            </div>
                        </ModalHeader>

                        <ModalBody>
                            <div className="space-y-4">
                                <p className="text-sm text-gray-600 leading-relaxed">
                                    {confirmationData.message}
                                </p>

                                {confirmationData.currentOwner && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm font-semibold text-gray-900 mb-2">
                                            ℹ️ Shared Email Account
                                        </p>
                                        <p className="text-sm text-gray-700">
                                            This email is currently assigned to <strong>{confirmationData.currentOwner.name}</strong> ({confirmationData.currentOwner.email}).
                                            This email will be shared between multiple users - it will NOT be removed from other users.
                                        </p>
                                    </div>
                                )}

                                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                                    <p className="text-sm font-semibold text-gray-900 mb-2">
                                        What will happen:
                                    </p>
                                    <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                                        <li>The email <strong>{confirmationData.existingEmail}</strong> will be assigned to this user in Firebase</li>
                                        <li>No changes will be made to the MXRoute email account</li>
                                        {confirmationData.currentOwner && (
                                            <li>Other users will keep access to this shared email</li>
                                        )}
                                        <li>No password will be generated (shared account)</li>
                                    </ul>
                                </div>
                            </div>
                        </ModalBody>

                        <ModalFooter>
                            <Button
                                variant="flat"
                                onPress={() => {
                                    setShowConfirmationModal(false);
                                    setConfirmationData(null);
                                }}
                                size="lg"
                                className="rounded-lg font-medium px-6"
                            >
                                Cancel
                            </Button>
                            <Spacer />
                            <Button
                                color="primary"
                                onPress={handleConfirmClaim}
                                isLoading={emailOperationLoading}
                                size="lg"
                                className="rounded-lg font-medium px-6"
                            >
                                {confirmationData.currentOwner ? 'Share Email' : 'Assign Email'}
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}

            {/* Password Display Modal */}
            {showPasswordModal && (
                <Modal
                    isOpen={true}
                    onClose={() => {
                        setShowPasswordModal(false);
                        setGeneratedPassword('');
                        setGeneratedEmail('');
                    }}
                    size="md"
                    classNames={{
                        base: "rounded-xl",
                        header: "border-b border-gray-200 py-5 px-6",
                        body: "py-6 px-6",
                        footer: "border-t border-gray-200 py-5 px-6"
                    }}
                >
                    <ModalContent>
                        <ModalHeader className="flex-col items-start gap-1">
                            <div className="flex items-center gap-3">
                                <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success-50">
                                    <Mail className="w-5 h-5 text-success" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900">
                                    IEEE Email Created Successfully
                                </h3>
                            </div>
                        </ModalHeader>

                        <ModalBody>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Email Address
                                    </label>
                                    <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
                                        <p className="text-base font-semibold text-gray-900 font-mono">{generatedEmail}</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Temporary Password
                                    </label>
                                    <div className="bg-yellow-50 rounded-lg px-4 py-3 border border-yellow-200">
                                        <p className="text-base font-semibold text-gray-900 font-mono break-all">{generatedPassword}</p>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-2">
                                        ⚠️ Save this password securely. It will not be shown again.
                                    </p>
                                </div>
                            </div>
                        </ModalBody>

                        <ModalFooter>
                            <Button
                                color="primary"
                                onPress={() => {
                                    navigator.clipboard.writeText(`Email: ${generatedEmail}\nPassword: ${generatedPassword}`);
                                    showToast.success('Email and password copied to clipboard!');
                                }}
                                size="lg"
                                className="rounded-lg font-medium px-6"
                            >
                                Copy to Clipboard
                            </Button>
                            <Spacer />
                            <Button
                                variant="flat"
                                onPress={() => {
                                    setShowPasswordModal(false);
                                    setGeneratedPassword('');
                                    setGeneratedEmail('');
                                }}
                                size="lg"
                                className="rounded-lg font-medium px-6"
                            >
                                Close
                            </Button>
                        </ModalFooter>
                    </ModalContent>
                </Modal>
            )}
        </>
    );
}

