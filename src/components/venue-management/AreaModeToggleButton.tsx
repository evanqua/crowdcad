import React from 'react';
import { Button } from '@heroui/react';
import { Shapes, MousePointer2 } from 'lucide-react';

interface AreaModeToggleButtonProps {
  isAddAreaMode: boolean;
  onToggle: () => void;
}

export default function AreaModeToggleButton({
  isAddAreaMode,
  onToggle,
}: AreaModeToggleButtonProps) {
  return (
    <Button
      size="md"
      variant={isAddAreaMode ? 'solid' : 'bordered'}
      color={isAddAreaMode ? 'primary' : 'default'}
      onPress={onToggle}
      startContent={
        isAddAreaMode ? (
          <MousePointer2 className="h-3.5 w-3.5" />
        ) : (
          <Shapes className="h-3.5 w-3.5" />
        )
      }
      className={isAddAreaMode ? 'bg-accent hover:bg-accent/90' : ''}
    >
      {isAddAreaMode ? 'Click to Draw' : 'Add Area'}
    </Button>
  );
}
