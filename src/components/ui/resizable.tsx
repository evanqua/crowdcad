// components/ui/resizable.tsx
"use client"

import * as React from "react"
import {
  PanelGroup,
  type PanelGroupProps,
  Panel,
  type PanelProps,
  PanelResizeHandle,
  type PanelResizeHandleProps,
} from "react-resizable-panels"
import { cn } from "@/lib/utils" // If you don't have this, replace cn(...) with a string join.

export function ResizablePanelGroup({
  className,
  ...props
}: PanelGroupProps & { className?: string }) {
  return (
    <PanelGroup
      className={cn(
        "data-[panel-group-direction=vertical]:flex-col",
        className
      )}
      {...props}
    />
  )
}

export function ResizablePanel({ className, ...props }: PanelProps & { className?: string }) {
  return <Panel className={cn(className)} {...props} />
}

export function ResizableHandle({
  className,
  withHandle,
  ...props
}: PanelResizeHandleProps & { className?: string; withHandle?: boolean }) {
  return (
    <PanelResizeHandle
      className={cn(
        // base track
        "relative flex items-center justify-center",
        "data-[panel-group-direction=horizontal]:h-full data-[panel-group-direction=horizontal]:w-[1px]",
        "data-[panel-group-direction=vertical]:h-[1px] data-[panel-group-direction=vertical]:w-full",
        // color/hover (tailwind variables from your theme)
        "bg-border hover:bg-muted transition-colors",
        className
      )}
      {...props}
    >
      {withHandle ? (
        <span
          className={cn(
            "z-10 block rounded-sm opacity-70",
            "data-[panel-group-direction=horizontal]:h-8 data-[panel-group-direction=horizontal]:w-1",
            "data-[panel-group-direction=vertical]:h-1 data-[panel-group-direction=vertical]:w-8",
            "bg-foreground/40"
          )}
        />
      ) : null}
    </PanelResizeHandle>
  )
}
