// components/modals/NewLayerModal.tsx
"use client";

import * as React from "react";
import { Upload, Trash2 } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
} from "@heroui/react";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (name: string, file: File) => void;
};

export default function NewLayerModal({ isOpen, onClose, onSubmit }: Props) {
  const [name, setName] = React.useState('');
  const [file, setFile] = React.useState<File | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const inputClassNames = {
    label: "text-surface-light mb-1",
    inputWrapper: "rounded-2xl px-4 hover:bg-surface-deep",
    input:
      "text-surface-light outline-none focus:outline-none data-[focus=true]:outline-none",
  } as const;

  const handleSubmit = () => {
    if (!name.trim() || !file) return;
    onSubmit(name.trim(), file);
    onClose();
    setName('');
    setFile(null);
  };

  const handleClose = () => {
    onClose();
    setName('');
    setFile(null);
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
              Add New Layer
            </ModalHeader>

            <ModalBody>
              {/* Layer name */}
              <Input
                label="Layer name"
                labelPlacement="outside-top"
                variant="bordered"
                size="lg"
                radius="lg"
                classNames={inputClassNames}
                value={name}
                onValueChange={setName}
                aria-label="Layer name"
              />

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />

              {/* Map Upload Section */}
              <div>
                <label className="mb-2 block text-sm font-medium text-surface-light">
                  Layer Map
                </label>
                {file ? (
                  <div className="flex items-center gap-2 rounded-xl border border-default bg-surface-deep p-2">
                    <Upload className="ml-2 h-6 w-6 text-accent" />
                    <span className="text-sm text-white truncate">{file.name}</span>
                    <Button
                      size="sm"
                      variant="light"
                      color="danger"
                      onPress={() => setFile(null)}
                      className="ml-auto min-w-10 w-10 h-10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-32 w-full flex-col items-center justify-center gap-3 text-surface-light/70 transition hover:border-status-blue/50 hover:text-status-blue border border-default rounded-xl"
                  >
                    <Upload className="h-12 w-12" />
                    <div className="text-center">
                      <p className="text-sm font-medium">Upload Layer Map</p>
                      <p className="mt-1 text-xs text-surface-light/50">
                        Required - Click to select an image
                      </p>
                    </div>
                  </button>
                )}
              </div>
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
                isDisabled={!name.trim() || !file}
              >
                Add Layer
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}