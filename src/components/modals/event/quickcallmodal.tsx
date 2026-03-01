// components/modals/QuickCallModal.tsx
"use client";

import * as React from "react";
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
} from "@heroui/react";
import type { Event, Staff, Call, TeamLogEntry } from "@/app/types";

type QuickCallState = {
  location: string;
  source: string;
  age: string;
  gender: string;
  chiefComplaint: string;
  assignedTeam: string; // single select
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  event?: Event | null;
  updateEvent: (data: Partial<Event>) => Promise<void>;

  quickCall: QuickCallState;
  setQuickCall: React.Dispatch<React.SetStateAction<QuickCallState>>;

  formatAgeSex: (age?: string, gender?: string) => string;
  parseAgeSex: (raw: string) => { age: string; gender: string };

  quickCallRef?: React.RefObject<HTMLFormElement | null>;
};

export default function QuickCallModal({
  isOpen,
  onClose,
  event,
  updateEvent,
  quickCall,
  setQuickCall,
  formatAgeSex,
  parseAgeSex,
  quickCallRef,
}: Props) {
  const [submitting, setSubmitting] = React.useState(false);

  // Replace the postedTeams useMemo
  const { availableTeams, inactiveTeams } = React.useMemo(() => {
    const allTeams = event?.staff ?? [];
    
    const available = allTeams.filter((staff: Staff) => {
      const isAssignedToActiveCall = event?.calls?.some((c: Call) => 
        c.assignedTeam?.includes(staff.team) && 
        !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
      );
      return !isAssignedToActiveCall && staff.status === 'Available';
    }).sort((a: Staff, b: Staff) =>
      a.team.localeCompare(b.team, undefined, { numeric: true })
    );
    
    const inactive = allTeams.filter((staff: Staff) => {
      const isAssignedToActiveCall = event?.calls?.some((c: Call) => 
        c.assignedTeam?.includes(staff.team) && 
        !['Resolved', 'Delivered', 'Refusal', 'NMM', 'Rolled'].includes(c.status)
      );
      return !isAssignedToActiveCall && ['In Clinic', 'On Break'].includes(staff.status || '');
    }).sort((a: Staff, b: Staff) =>
      a.team.localeCompare(b.team, undefined, { numeric: true })
    );
    
    return { availableTeams: available, inactiveTeams: inactive };
  }, [event?.staff, event?.calls]);


  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      const now = new Date();
      const hhmm =
        now.getHours().toString().padStart(2, "0") +
        now.getMinutes().toString().padStart(2, "0");

      const nextOrder =
        event?.calls?.length
          ? Math.max(
              ...event.calls.map((c) => (typeof c.order === "number" ? c.order : 0))
            ) + 1
          : 1;

      const cleanCall: Call = {
        id: Date.now().toString(),
        order: nextOrder,
        status: quickCall.assignedTeam ? "Assigned" : "Pending",
        location: quickCall.location.trim() || "Unknown",
        assignedTeam: quickCall.assignedTeam ? [quickCall.assignedTeam] : [],
        chiefComplaint: quickCall.chiefComplaint?.trim() || "",
        ...(quickCall.source?.trim() && { source: quickCall.source.trim() }),
        ...(quickCall.age?.trim() && { age: quickCall.age.trim() }),
        ...(quickCall.gender?.trim() && { gender: quickCall.gender.trim() }),
        priority: false,
        log: [
          {
            timestamp: now.getTime(),
            message: `${hhmm} - Call created${
              quickCall.source ? ` from ${quickCall.source}` : ""
            }${quickCall.chiefComplaint ? `, complaint: ${quickCall.chiefComplaint}` : ""}, location: ${
              quickCall.location.trim() || "Unknown"
            }${
              quickCall.assignedTeam ? `, assigned to ${quickCall.assignedTeam}` : ""
            }`,
          },
        ],
      };

      // Update staff if a team was assigned
      let updatedStaff: Staff[] | undefined = event?.staff;
      
      if (quickCall.assignedTeam && event?.staff) {
        const teamLogEntry: TeamLogEntry = {
          timestamp: now.getTime(),
          message: `${hhmm} - responding to call #${nextOrder}`,
        };

        updatedStaff = event.staff.map((staff: Staff) =>
          staff.team === quickCall.assignedTeam
            ? {
                ...staff,
                status: "En Route",
                location: quickCall.location,
                originalPost: staff.location || "Unknown",
                // Now teamLogEntry matches the type expected inside the log array
                log: [...(staff.log || []), teamLogEntry],
              }
            : staff
        );
      }

      await updateEvent({
        calls: [...(event?.calls || []), cleanCall],
        ...(updatedStaff && { staff: updatedStaff }),
      });

      // Reset & close
      setQuickCall({
        location: "",
        source: "",
        age: "",
        gender: "",
        chiefComplaint: "",
        assignedTeam: "",
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  // Inputs
  const inputClassNames = {
    label: "text-surface-light mb-1",
    inputWrapper: [
      "rounded-2xl px-4",
      "hover:bg-surface-deep",
    ].join(" "),
    input:
      "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
  } as const;

  // Select
  const selectClassNames = {
    label: "text-surface-light mb-1",
    trigger: [
      "rounded-2xl px-4",
      "text-surface-light",
    ].join(" "),
    value: "text-surface-light",
  } as const;


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
          <form ref={quickCallRef} onSubmit={handleSubmit}>
            <ModalHeader className="text-2xl font-bold text-surface">
              Add Call
            </ModalHeader>

            <ModalBody className="">
              <Input
                autoFocus
                label="Location"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={quickCall.location}
                onValueChange={(v) => setQuickCall((p) => ({ ...p, location: v }))}
              />
              <Input
                label="Source"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={quickCall.source}
                onValueChange={(v) => setQuickCall((p) => ({ ...p, source: v }))}
                aria-label="Source"
              />
              <Input
                label="Age/Sex"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={formatAgeSex(quickCall.age, quickCall.gender)}
                onValueChange={(v) => {
                  const { age, gender } = parseAgeSex(v);
                  setQuickCall((prev) => ({ ...prev, age, gender }));
                }}
                aria-label="Age/Sex"
              />

              <Input
                label="Chief Complaint"
                labelPlacement="inside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={quickCall.chiefComplaint}
                onValueChange={(v) => setQuickCall((p) => ({ ...p, chiefComplaint: v }))}
                aria-label="Chief Complaint"
              />
              <Select
              label="Assign Team"
              placeholder="Select a team"
              selectedKeys={quickCall.assignedTeam ? new Set([quickCall.assignedTeam]) : new Set()}
              onSelectionChange={(keys) => {
                if (keys === "all") return;
                const key = Array.from(keys as Set<string>)[0] ?? "";
                setQuickCall((p) => ({ ...p, assignedTeam: key }));
              }}
              aria-label="Assign Team"
              disallowEmptySelection={false}
              classNames={selectClassNames}
            >
              {[
                ...availableTeams.map((team) => (
                  <SelectItem 
                    key={team.team}
                    textValue={`${team.team} - ${team.location || 'Unknown'}`}
                  >
                    {team.team} - {team.location || 'Unknown'}
                  </SelectItem>
                )),
                ...inactiveTeams.map((team) => (
                  <SelectItem 
                    key={team.team}
                    textValue={`${team.team} - ${team.location || 'Unknown'}`}
                    classNames={{
                      base: "bg-status-blue/20"
                    }}
                  >
                    {team.team} - {team.location || 'Unknown'}
                  </SelectItem>
                ))
              ]}
            </Select>
            </ModalBody>

            <ModalFooter className="flex justify-end gap-2">
              <Button
                onPress={() => {
                  // Only reset fields when Cancel is clicked (not when clicking off)
                  setQuickCall({
                    location: "",
                    source: "",
                    age: "",
                    gender: "",
                    chiefComplaint: "",
                    assignedTeam: "",
                  });
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
                type="submit"
                radius="lg"
                className="px-4 py-2 bg-accent hover:bg-accent/90 text-surface-light"
                isDisabled={submitting}
              >
                Submit
              </Button>
            </ModalFooter>
          </form>
        )}
      </ModalContent>
    </Modal>
  );
}
