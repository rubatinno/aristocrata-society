"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import TiptapImage from "@tiptap/extension-image";
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from "@tiptap/react";
import { cn } from "@/lib/utils";

const MIN_WIDTH = 80;
const MAX_WIDTH = 900;

export const ResizableImage = TiptapImage.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.style.width || element.getAttribute("width") || null,
        renderHTML: (attributes: { width?: string | null }) => {
          if (!attributes.width) return {};
          return { style: `width: ${attributes.width}` };
        },
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView);
  },
});

function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const [resizing, setResizing] = useState(false);

  function handlePointerDown(event: ReactPointerEvent<HTMLSpanElement>) {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = wrapperRef.current?.offsetWidth ?? 300;
    setResizing(true);

    function onMove(moveEvent: PointerEvent) {
      const nextWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth + (moveEvent.clientX - startX)));
      updateAttributes({ width: `${nextWidth}px` });
    }

    function onUp() {
      setResizing(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <NodeViewWrapper
      as="span"
      ref={wrapperRef}
      className="relative inline-block max-w-full align-bottom"
      style={{ width: (node.attrs.width as string | null) ?? undefined }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- largura arbitrária controlada por drag, incompatível com next/image */}
      <img
        src={node.attrs.src as string}
        alt={(node.attrs.alt as string | null) ?? ""}
        draggable={false}
        className={cn(
          "block max-w-full rounded-xl",
          (selected || resizing) && "ring-2 ring-primary ring-offset-2 ring-offset-background",
        )}
      />
      {(selected || resizing) && (
        <span
          onPointerDown={handlePointerDown}
          className="absolute right-0 bottom-0 size-3.5 translate-x-1/2 translate-y-1/2 cursor-nwse-resize rounded-full border-2 border-primary bg-background"
        />
      )}
    </NodeViewWrapper>
  );
}
