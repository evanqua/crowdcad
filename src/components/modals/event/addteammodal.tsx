// components/modals/AddTeamModal.tsx
"use client";

import * as React from "react";
import { Plus } from "lucide-react";
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
  Checkbox,
  Chip,
} from "@heroui/react";

type Member = { name: string; cert: string; lead: boolean };

type Props = {
  isOpen: boolean;
  onClose: () => void;

  // NEW: unify create/edit
  mode?: "create" | "edit";
  onSubmit: () => void;
  titleOverride?: string;
  submitLabelOverride?: string;

  // Inputs/state the page already owns (unchanged)
  teamName: string;
  setTeamName: (v: string) => void;

  memberName: string;
  setMemberName: (v: string) => void;

  memberCert: string;
  setMemberCert: (v: string) => void;

  isTeamLead: boolean;
  setIsTeamLead: (v: boolean) => void;

  addMember: () => void;
  currentMembers: Member[];
  removeMember: (idx: number) => void;

  LICENSES: string[]; // e.g., ["EMT", "AEMT", "Paramedic", ...]
};

export default function AddTeamModal({
  isOpen,
  onClose,
  mode = "create",
  onSubmit,
  titleOverride,
  submitLabelOverride,
  teamName,
  setTeamName,
  memberName,
  setMemberName,
  memberCert,
  setMemberCert,
  isTeamLead,
  setIsTeamLead,
  addMember,
  currentMembers,
  removeMember,
  LICENSES,
}: Props) {
  const [submitting, setSubmitting] = React.useState(false);

  const inputClassNames = {
    label: "text-surface-light mb-1",
    inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
    input:
      "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
  } as const;

  const selectClassNames = {
    label: "text-surface-light mb-1",
    trigger:
      "bg-transparent hover:bg-surface-deep data-[focus=true]:outline-none",
    value: "text-surface-light",
    popover: "bg-surface-deepest border border-surface-liner rounded-2xl",
    listbox:
      "p-1 [&_[data-hover=true]]:bg-surface-deep [&_[data-selected=true]]:bg-surface-deep",
  } as const;

  const title =
    titleOverride ?? (mode === "edit" ? "Edit Team" : "Add New Team");
  const submitLabel =
    submitLabelOverride ?? (mode === "edit" ? "Save Changes" : "Create Team");

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      placement="top-center"
      backdrop="opaque"
      hideCloseButton
      radius="lg"
      classNames={{
        base: "rounded-2xl bg-surface-deepest text-surface-light mt-20",
        header: "pb-0",
        body: "py-4",
        footer: "pt-0",
      }}
    >
      <ModalContent>
        {(close) => (
          <>
            <ModalHeader className="text-2xl font-bold text-surface">
              {title}
            </ModalHeader>

            <ModalBody>
              {/* Team name */}
              <Input
                label="Team name"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={teamName}
                onValueChange={setTeamName}
                aria-label="Team name"
              />

              {/* Member add row */}
              <div className="flex gap-2 items-center">
                <Input
                  label="Member name"
                  labelPlacement="inside"
                  variant="bordered"
                  size="lg"
                  radius="lg"
                  classNames={inputClassNames}
                  value={memberName}
                  onValueChange={setMemberName}
                  aria-label="Member name"
                  className="flex-1"
                />
                <Checkbox
                  isSelected={isTeamLead}
                  onValueChange={setIsTeamLead}
                  classNames={{
                    base: "h-[52px] px-4 rounded-2xl flex items-center",
                    label: "text-surface-light",
                    wrapper:
                      "outline-none focus:outline-none data-[focus=true]:outline-none",
                  }}
                  aria-label="Lead"
                >
                  Lead
                </Checkbox>
              </div>

              {/* Cert dropdown (left) + Add button (right) */}
              <div className="flex gap-2 items-center">
                <Select
                  label="Certification"
                  labelPlacement="inside"
                  variant="bordered"
                  size="lg"
                  radius="lg"
                  classNames={selectClassNames}
                  selectedKeys={memberCert ? new Set([memberCert]) : new Set()}
                  onSelectionChange={(keys) => {
                    const val = Array.from(keys)[0] as string | undefined;
                    setMemberCert(val ?? "");
                  }}
                  aria-label="Certification"
                  className="flex-1"
                >
                  {LICENSES.map((cert) => (
                    <SelectItem key={cert} aria-label={cert} textValue={cert}>
                      {cert}
                    </SelectItem>
                  ))}
                </Select>

                <Button
                  onPress={addMember}
                  isIconOnly
                  size="lg"
                  variant="flat"
                  radius="full"
                  aria-label="Add member"
                >
                  <Plus className="h-6 w-6" />
                </Button>
              </div>

              {/* Current members chips */}
              {currentMembers?.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {currentMembers.map((m, idx) => (
                    <Chip
                      key={`${m.name}-${idx}`}
                      onClose={() => removeMember(idx)}
                      radius="full"
                      variant="solid"
                      classNames={{
                        base: `px-2 py-2 rounded-full text-surface-light ${
                          m.lead ? "bg-status-blue" : "bg-status-orange"
                        } outline-none focus:outline-none data-[focus=true]:outline-none`,
                        content: "text-surface-light text-md",
                        closeButton:
                          "text-surface-light hover:text-status-red focus:outline-none data-[focus-visible=true]:outline-none",
                      }}
                    >
                      {`${m.name} [${m.cert}]${m.lead ? " (Lead)" : ""}`}
                    </Chip>
                  ))}
                </div>
              )}
            </ModalBody>

            <ModalFooter className="flex justify-end gap-2">
              <Button
                onPress={() => {
                  close();
                  onClose();
                }}
                className="px-4 py-2 hover:bg-status-red/10 border border-status-red text-status-red"
                variant="bordered"
                radius="lg"
              >
                Cancel
              </Button>
              <Button
                onPress={async () => {
                  if (submitting) return;
                  try {
                    setSubmitting(true);
                    await Promise.resolve(onSubmit());
                  } finally {
                    setSubmitting(false);
                  }
                }}
                radius="lg"
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-surface-light"
                isDisabled={submitting}
              >
                {submitLabel}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
