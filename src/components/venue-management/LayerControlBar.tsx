import React from 'react';
import { Button, Card } from '@heroui/react';
import { ChevronLeft, ChevronRight, MapPinned, Plus, Trash2, Upload } from 'lucide-react';

interface LayerControlBarProps {
  mapFileName: string;
  onReplaceMap: () => void;
  currentLayer: number;
  totalLayers: number;
  currentLayerName: string;
  onPreviousLayer: () => void;
  onNextLayer: () => void;
  onDeleteLayer: () => void;
  onAddLayer: () => void;
}

export default function LayerControlBar({
  mapFileName,
  onReplaceMap,
  currentLayer,
  totalLayers,
  currentLayerName,
  onPreviousLayer,
  onNextLayer,
  onDeleteLayer,
  onAddLayer,
}: LayerControlBarProps) {
  return (
    <Card
      isBlurred
      className="border-2 border-default-200 bg-transparent w-full px-3 py-2"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <MapPinned className="h-4 w-4 text-accent" />
          <span className="text-xs text-surface-light truncate max-w-[120px]">{mapFileName}</span>
          <Button
            size="sm"
            variant="flat"
            onPress={onReplaceMap}
            startContent={<Upload className="h-3 w-3" />}
            className="ml-2"
          >
            Replace
          </Button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            isDisabled={currentLayer <= 0}
            onPress={onPreviousLayer}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-surface-light min-w-[100px] text-center">{currentLayerName || 'Layer'}</span>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            isDisabled={totalLayers <= 1 || currentLayer >= totalLayers - 1}
            onPress={onNextLayer}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            color="danger"
            onPress={onDeleteLayer}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            isIconOnly
            size="sm"
            variant="flat"
            onPress={onAddLayer}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
