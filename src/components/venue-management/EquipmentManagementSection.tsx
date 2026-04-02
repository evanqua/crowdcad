"use client";

import React from 'react';
import { Button, Card, Input, ScrollShadow } from '@heroui/react';
import { Edit2, Plus, Trash2 } from 'lucide-react';
import type { Equipment } from '@/app/types';

interface EquipmentManagementSectionProps {
  equipmentInput: string;
  setEquipmentInput: (value: string) => void;
  addEquipment: () => void;
  equipment: Equipment[];
  editingEquipmentIndex: number | null;
  equipmentEditInput: string;
  setEquipmentEditInput: (value: string) => void;
  saveEquipmentEdit: () => void;
  cancelEquipmentEdit: () => void;
  startEditEquipment: (idx: number) => void;
  removeEquipment: (idx: number) => void;
}

export default function EquipmentManagementSection({
  equipmentInput,
  setEquipmentInput,
  addEquipment,
  equipment,
  editingEquipmentIndex,
  equipmentEditInput,
  setEquipmentEditInput,
  saveEquipmentEdit,
  cancelEquipmentEdit,
  startEditEquipment,
  removeEquipment,
}: EquipmentManagementSectionProps) {
  return (
    <>
      <label className="mb-2 block text-sm font-medium text-white">
        Equipment <span className="text-surface-light text-xs">(Optional)</span>
      </label>
      <div className="flex gap-2 mb-3">
        <Input
          placeholder="e.g., Gurney 1"
          value={equipmentInput}
          onValueChange={setEquipmentInput}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addEquipment();
            }
          }}
          variant="flat"
          classNames={{
            input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
            inputWrapper: 'rounded-2xl px-4 hover:bg-surface-deep',
          }}
        />
        <Button
          isIconOnly
          onPress={addEquipment}
          className="flex-shrink-0 bg-accent hover:bg-accent/90 text-white"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {equipment.length > 0 && (
        <ScrollShadow className="space-y-2 pr-2 max-h-[calc(100vh-430px)] scrollbar-hide">
          {equipment.map((item, idx) => (
            <Card
              key={item.id}
              isBlurred
              className="border-2 rounded-2xl border-default-200 bg-transparent"
            >
              <div className="flex items-center justify-between px-3 py-2">
                {editingEquipmentIndex === idx ? (
                  <>
                    <Input
                      value={equipmentEditInput}
                      onValueChange={setEquipmentEditInput}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          saveEquipmentEdit();
                        } else if (e.key === 'Escape') {
                          e.preventDefault();
                          cancelEquipmentEdit();
                        }
                      }}
                      variant="flat"
                      size="sm"
                      autoFocus
                      classNames={{
                        input: 'text-white text-sm outline-none focus:outline-none data-[focus=true]:outline-none',
                        inputWrapper: 'rounded-lg px-2 hover:bg-surface-deep',
                      }}
                    />
                    <div className="flex items-center gap-1 ml-2">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="success"
                        onPress={saveEquipmentEdit}
                        className="min-w-6 w-6 h-6 flex-shrink-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={cancelEquipmentEdit}
                        className="min-w-6 w-6 h-6 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <span className="text-sm text-white truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onPress={() => startEditEquipment(idx)}
                        className="min-w-6 w-6 h-6 flex-shrink-0"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        color="danger"
                        onPress={() => removeEquipment(idx)}
                        className="min-w-6 w-6 h-6 flex-shrink-0"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))}
        </ScrollShadow>
      )}
    </>
  );
}
