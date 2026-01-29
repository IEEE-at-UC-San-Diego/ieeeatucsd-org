import React, { useState } from "react";
import { Send } from "lucide-react";
import {
  Card,
  CardBody,
  Input,
  Select,
  SelectItem,
  Textarea,
  Button,
  Spacer,
} from "@heroui/react";
import type { UserRole, OfficerTeam } from "../../../shared/types/firestore";
import type { InvitationFormData } from "../types/OnboardingTypes";

interface InvitationFlowTabProps {
  onSendInvitation: (data: InvitationFormData) => Promise<void>;
  loading: boolean;
}

const OFFICER_ROLES: UserRole[] = ["General Officer", "Executive Officer"];

export default function InvitationFlowTab({
  onSendInvitation,
  loading,
}: InvitationFlowTabProps) {
  const [formData, setFormData] = useState<InvitationFormData>({
    name: "",
    email: "",
    role: "General Officer",
    position: "",
    team: undefined,
    acceptanceDeadline: "",
    message: "",
    leaderName: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSendInvitation(formData);

    // Reset form on success
    setFormData({
      name: "",
      email: "",
      role: "General Officer",
      position: "",
      team: undefined,
      acceptanceDeadline: "",
      message: "",
      leaderName: "",
    });
  };

  return (
    <div className="max-w-4xl">
      <Card>
        <CardBody className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Send Officer Invitation
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Send an invitation email asking the prospective officer to accept
              their position. Upon acceptance, they will be automatically
              onboarded.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                type="text"
                label="Full Name"
                placeholder="John Doe"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                isRequired
                classNames={{
                  inputWrapper: "rounded-lg",
                }}
              />

              <Input
                type="email"
                label="Email Address"
                placeholder="john.doe@ucsd.edu"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                isRequired
                classNames={{
                  inputWrapper: "rounded-lg",
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Officer Role"
                placeholder="Select role"
                selectedKeys={[formData.role]}
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value as UserRole })
                }
                isRequired
                classNames={{
                  trigger: "rounded-lg",
                }}
              >
                {OFFICER_ROLES.map((role) => (
                  <SelectItem key={role}>
                    {role}
                  </SelectItem>
                ))}
              </Select>

              <Input
                type="text"
                label="Position"
                placeholder="e.g., Webmaster, President"
                value={formData.position}
                onChange={(e) =>
                  setFormData({ ...formData, position: e.target.value })
                }
                isRequired
                classNames={{
                  inputWrapper: "rounded-lg",
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Team Assignment (Optional)"
                placeholder="Select a team"
                selectedKeys={formData.team ? [formData.team] : ["none"]}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    team: value === "none" ? undefined : (value as OfficerTeam),
                  });
                }}
                classNames={{
                  trigger: "rounded-lg",
                }}
              >
                <SelectItem key="none">No Team</SelectItem>
                <SelectItem key="Internal">Internal</SelectItem>
                <SelectItem key="Events">Events</SelectItem>
                <SelectItem key="Projects">Projects</SelectItem>
              </Select>

              <Input
                type="datetime-local"
                label="Acceptance Deadline"
                labelPlacement="inside"
                value={formData.acceptanceDeadline}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    acceptanceDeadline: e.target.value,
                  })
                }
                isRequired
                description="Date and time by which the officer must accept"
                classNames={{
                  inputWrapper: "rounded-lg",
                  label:
                    "!transform-none !text-xs !top-2 !left-3 !text-default-600",
                }}
              />

              <Input
                type="text"
                label="Team Lead Name (Optional)"
                labelPlacement="inside"
                placeholder="e.g., Jane Smith"
                value={formData.leaderName}
                onChange={(e) =>
                  setFormData({ ...formData, leaderName: e.target.value })
                }
                classNames={{
                  inputWrapper: "rounded-lg",
                  label:
                    "!transform-none !text-xs !top-2 !left-3 !text-default-600",
                }}
              />
            </div>

            <Textarea
              label="Custom Message (Optional)"
              placeholder="Add any additional information for the invitation..."
              value={formData.message}
              onChange={(e) =>
                setFormData({ ...formData, message: e.target.value })
              }
              minRows={4}
              classNames={{
                inputWrapper: "rounded-lg",
              }}
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-medium text-blue-900 mb-2">
                What happens next?
              </h4>
              <ul className="text-sm text-blue-700 space-y-1 list-disc list-inside">
                <li>
                  An invitation email will be sent to the prospective officer
                </li>
                <li>
                  They will have until the acceptance deadline to accept or
                  decline the position
                </li>
                <li>
                  Upon acceptance, they will automatically receive onboarding
                  instructions
                </li>
                <li>They will be added to the appropriate Google Group</li>
                <li>Officer permissions will be granted in the system</li>
              </ul>
            </div>

            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                color="primary"
                isLoading={loading}
                startContent={!loading && <Send className="w-4 h-4" />}
                className="rounded-lg"
              >
                {loading ? "Sending Invitation..." : "Send Invitation"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
