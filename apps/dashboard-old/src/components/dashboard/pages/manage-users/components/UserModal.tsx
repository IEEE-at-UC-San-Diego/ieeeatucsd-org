import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Spacer,
} from "@heroui/react";
import type { UserRole, OfficerTeam } from "../../../shared/types/firestore";
import type { UserModalData } from "../types/UserManagementTypes";
import EmailManagementSection from "./EmailManagementSection";

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (userData: UserModalData) => void;
  editingUser: UserModalData | null;
  availableRoles: UserRole[];
  canEditRole: boolean;
  canEditPosition: boolean;
  canEditPoints: boolean;
  canManageEmails?: boolean;
  onEmailAction?: (
    action: "disable" | "enable" | "delete",
    userId: string,
    email?: string,
  ) => Promise<void>;
  loading?: boolean;
  currentUserId?: string;
}

export default function UserModal({
  isOpen,
  onClose,
  onSave,
  editingUser,
  availableRoles,
  canEditRole,
  canEditPosition,
  canEditPoints,
  canManageEmails = false,
  onEmailAction,
  loading = false,
  currentUserId,
}: UserModalProps) {
  const [formData, setFormData] = useState<UserModalData>({
    name: "",
    email: "",
    role: "Member",
    position: "",
    status: "active",
    pid: "",
    memberId: "",
    major: "",
    graduationYear: undefined,
    points: 0,
    team: undefined,
  });

  useEffect(() => {
    if (editingUser) {
      setFormData(editingUser);
    } else {
      setFormData({
        name: "",
        email: "",
        role: "Member",
        position: "",
        status: "active",
        pid: "",
        memberId: "",
        major: "",
        graduationYear: undefined,
        points: 0,
        team: undefined,
      });
    }
  }, [editingUser, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleInputChange = (field: keyof UserModalData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      backdrop="opaque"
      classNames={{
        base: "rounded-lg",
        header: "border-b border-gray-200 py-5 px-6",
        body: "py-8 px-6",
        footer: "border-t border-gray-200 py-5 px-6",
        backdrop: "bg-black/50",
      }}
    >
      <ModalContent>
        {(onModalClose) => (
          <>
            <ModalHeader className="flex-col items-start gap-1">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingUser ? "Edit User" : "Add New User"}
              </h2>
              <p className="text-sm font-normal text-gray-500">
                {editingUser
                  ? "Update user information and permissions"
                  : "Add a new user to the system"}
              </p>
            </ModalHeader>

            <ModalBody className="overflow-x-hidden">
              <form
                onSubmit={handleSubmit}
                className="space-y-8 max-w-full"
                id="user-form"
              >
                {/* Basic Information Section */}
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Basic Information
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-full">
                      <Input
                        type="text"
                        label="Name"
                        labelPlacement="outside"
                        placeholder="Enter name"
                        value={formData.name}
                        onChange={(e) =>
                          handleInputChange("name", e.target.value)
                        }
                        isRequired
                        size="md"
                        classNames={{
                          base: "max-w-full",
                          inputWrapper: "rounded-lg max-w-full h-11",
                          label: "text-sm font-medium text-gray-700 mb-2",
                        }}
                      />

                      <Input
                        type="email"
                        label="Email"
                        labelPlacement="outside"
                        placeholder="Enter email"
                        value={formData.email}
                        onChange={(e) =>
                          handleInputChange("email", e.target.value)
                        }
                        isRequired
                        isDisabled={!!editingUser}
                        description={editingUser ? "Cannot be changed" : ""}
                        size="md"
                        classNames={{
                          base: "max-w-full",
                          inputWrapper: "rounded-lg max-w-full h-11",
                          label: "text-sm font-medium text-gray-700 mb-2",
                          description: "text-xs mt-1.5",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Role and Permissions Section */}
                <div className="space-y-5 pt-6 border-t border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Role & Permissions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-full">
                      <Select
                        label="Role"
                        labelPlacement="outside"
                        selectedKeys={[formData.role]}
                        onChange={(e) =>
                          handleInputChange("role", e.target.value as UserRole)
                        }
                        isRequired
                        isDisabled={!canEditRole}
                        description={!canEditRole ? "No permission" : ""}
                        size="md"
                        classNames={{
                          base: "max-w-full",
                          trigger: "rounded-lg max-w-full h-11",
                          label: "text-sm font-medium text-gray-700 mb-2",
                          description: "text-xs mt-1.5",
                        }}
                      >
                        {availableRoles.map((role) => (
                          <SelectItem key={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </Select>

                      <Input
                        type="text"
                        label="Position"
                        labelPlacement="outside"
                        placeholder="e.g., President"
                        value={formData.position || ""}
                        onChange={(e) =>
                          handleInputChange("position", e.target.value)
                        }
                        isDisabled={!canEditPosition}
                        description={!canEditPosition ? "No permission" : ""}
                        size="md"
                        classNames={{
                          base: "max-w-full",
                          inputWrapper: "rounded-lg max-w-full h-11",
                          label: "text-sm font-medium text-gray-700 mb-2",
                          description: "text-xs mt-1.5",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Team Assignment Section - Only for officers */}
                {(formData.role === "General Officer" ||
                  formData.role === "Executive Officer" ||
                  formData.role === "Administrator") && (
                    <div className="space-y-5 pt-6 border-t border-gray-100">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-4">
                          Team Assignment
                        </h3>
                        <Select
                          label="Team"
                          labelPlacement="outside"
                          placeholder="Select a team"
                          selectedKeys={
                            formData.team ? [formData.team] : ["none"]
                          }
                          onChange={(e) => {
                            const value = e.target.value;
                            handleInputChange(
                              "team",
                              value === "none"
                                ? undefined
                                : (value as OfficerTeam),
                            );
                          }}
                          size="md"
                          classNames={{
                            base: "max-w-full",
                            trigger: "rounded-lg max-w-full h-11",
                            label: "text-sm font-medium text-gray-700 mb-2",
                          }}
                        >
                          <SelectItem key="none">No Team</SelectItem>
                          <SelectItem key="Internal">Internal</SelectItem>
                          <SelectItem key="Events">Events</SelectItem>
                          <SelectItem key="Projects">Projects</SelectItem>
                        </Select>
                        <p className="text-xs text-gray-500 mt-2">
                          Assign officers to teams for the officer leaderboard.
                          Select "No Team" to remove team assignment.
                        </p>
                      </div>
                    </div>
                  )}

                {/* Account Status Section */}
                <div className="space-y-5">
                  <Select
                    label="Account Status"
                    labelPlacement="outside"
                    selectedKeys={[formData.status]}
                    onChange={(e) =>
                      handleInputChange(
                        "status",
                        e.target.value as "active" | "inactive" | "suspended",
                      )
                    }
                    isRequired
                    size="md"
                    classNames={{
                      base: "max-w-full",
                      trigger: "rounded-lg max-w-full h-11",
                      label: "text-sm font-medium text-gray-700 mb-2",
                    }}
                  >
                    <SelectItem key="active">
                      Active
                    </SelectItem>
                    <SelectItem key="inactive">
                      Inactive
                    </SelectItem>
                    <SelectItem key="suspended">
                      Suspended
                    </SelectItem>
                  </Select>
                </div>

                {/* Additional Information Section */}
                <div className="space-y-5 pt-6 border-t border-gray-100">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-4">
                      Additional Information
                    </h3>
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-full">
                        <Input
                          type="text"
                          label="PID"
                          labelPlacement="outside"
                          placeholder="Student ID"
                          value={formData.pid || ""}
                          onChange={(e) =>
                            handleInputChange("pid", e.target.value)
                          }
                          size="md"
                          classNames={{
                            base: "max-w-full",
                            inputWrapper: "rounded-lg max-w-full h-11",
                            label: "text-sm font-medium text-gray-700 mb-2",
                          }}
                        />

                        <Input
                          type="text"
                          label="Member ID"
                          labelPlacement="outside"
                          placeholder="IEEE Member ID"
                          value={formData.memberId || ""}
                          onChange={(e) =>
                            handleInputChange("memberId", e.target.value)
                          }
                          size="md"
                          classNames={{
                            base: "max-w-full",
                            inputWrapper: "rounded-lg max-w-full h-11",
                            label: "text-sm font-medium text-gray-700 mb-2",
                          }}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-full">
                        <Input
                          type="text"
                          label="Major"
                          labelPlacement="outside"
                          placeholder="e.g., Computer Science"
                          value={formData.major || ""}
                          onChange={(e) =>
                            handleInputChange("major", e.target.value)
                          }
                          size="md"
                          classNames={{
                            base: "max-w-full",
                            inputWrapper: "rounded-lg max-w-full h-11",
                            label: "text-sm font-medium text-gray-700 mb-2",
                          }}
                        />

                        <Input
                          type="number"
                          label="Graduation Year"
                          labelPlacement="outside"
                          placeholder="e.g., 2025"
                          value={formData.graduationYear?.toString() || ""}
                          onChange={(e) =>
                            handleInputChange(
                              "graduationYear",
                              e.target.value
                                ? parseInt(e.target.value)
                                : undefined,
                            )
                          }
                          size="md"
                          classNames={{
                            base: "max-w-full",
                            inputWrapper: "rounded-lg max-w-full h-11",
                            label: "text-sm font-medium text-gray-700 mb-2",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Points Section (Admin only) */}
                {canEditPoints && (
                  <div className="space-y-5 pt-6 border-t border-gray-100">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-4">
                        Points Management
                      </h3>
                      <Input
                        type="number"
                        label="Points"
                        labelPlacement="outside"
                        placeholder="0"
                        value={formData.points?.toString() || "0"}
                        onChange={(e) =>
                          handleInputChange(
                            "points",
                            parseInt(e.target.value) || 0,
                          )
                        }
                        description="Administrator privilege required"
                        size="md"
                        classNames={{
                          base: "max-w-full",
                          inputWrapper: "rounded-lg max-w-full h-11",
                          label: "text-sm font-medium text-gray-700 mb-2",
                          description: "text-xs mt-1.5",
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* IEEE Email Management (Admin only) */}
                {canManageEmails && editingUser && onEmailAction && (
                  <EmailManagementSection
                    editingUser={editingUser}
                    onEmailAction={onEmailAction}
                    currentUserId={currentUserId}
                  />
                )}
              </form>
            </ModalBody>

            <ModalFooter>
              <Button
                variant="flat"
                onPress={onClose}
                isDisabled={loading}
                size="lg"
                className="rounded-lg font-medium px-6"
              >
                Cancel
              </Button>
              <Spacer />
              <Button
                type="submit"
                form="user-form"
                color="primary"
                isLoading={loading}
                size="lg"
                className="rounded-lg font-medium px-6"
              >
                {editingUser ? "Update User" : "Add User"}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
