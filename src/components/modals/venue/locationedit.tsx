// components/modals/LocationEditModal.tsx
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

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, layerIdx: number) => void;
  initialName: string;
  initialLayerIdx: number;
  layers: { name: string }[];
};

export default function LocationEditModal({
  isOpen,
  onClose,
  onSubmit,
  initialName,
  initialLayerIdx,
  layers,
}: Props) {
  const [name, setName] = React.useState(initialName);
  const [layerIdx, setLayerIdx] = React.useState(initialLayerIdx);

  React.useEffect(() => {
    setName(initialName);
    setLayerIdx(initialLayerIdx);
  }, [initialName, initialLayerIdx]);

  const inputClassNames = {
    label: "text-surface-light mb-1",
    inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
    input:
      "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
  } as const;

  const selectClassNames = {
    label: "text-surface-light mb-1",
    trigger: "rounded-2xl px-4 hover:bg-surface-deep bg-surface-deep",
    value: "text-surface-light",
  } as const;

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit(name.trim(), layerIdx);
    onClose();
  };

  const handleClose = () => {
    onClose();
    setName(initialName);
    setLayerIdx(initialLayerIdx);
  };

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={handleClose}
      placement="center"
      backdrop="opaque"
      hideCloseButton
      radius="lg"
      classNames={{
        base: "rounded-2xl bg-surface-deepest text-surface-light",
        header: "pb-0",
        body: "py-4",
        footer: "pt-0",
      }}
    >
      <ModalContent>
        {() => (
          <>
            <ModalHeader className="text-2xl font-bold text-surface">
              Edit Location
            </ModalHeader>

            <ModalBody>
              {/* Location name */}
              <Input
                label="Location name"
                labelPlacement="outside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={name}
                onValueChange={setName}
                aria-label="Location name"
              />

              {/* Layer selection */}
              <Select
                label="Layer"
                labelPlacement="outside"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={selectClassNames}
                selectedKeys={[layerIdx.toString()]}
                onSelectionChange={(keys) => {
                  const selected = Array.from(keys)[0] as string;
                  setLayerIdx(parseInt(selected));
                }}
              >
                {layers.map((layer, idx) => (
                  <SelectItem key={idx.toString()}>
                    {layer.name}
                  </SelectItem>
                ))}
              </Select>
            </ModalBody>

            <ModalFooter>
              <Button
                variant="flat"
                onPress={handleClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onPress={handleSubmit}
                className="flex-1 bg-accent hover:bg-accent/90 text-white"
                isDisabled={!name.trim()}
              >
                Save
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
