"use client";

import { useRef, useState } from "react";
import type { CSSProperties } from "react";

/**
 * Lightweight stand-in for the design's <image-slot> web component. The original
 * persists drops through the claude.ai canvas host (window.omelette), which does
 * not exist here — so this keeps the same look and a click-to-pick interaction,
 * session-only.
 */
export default function ImageSlot({
  style,
  placeholder = "photo",
}: {
  style?: CSSProperties;
  placeholder?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  return (
    <div
      onClick={() => input.current?.click()}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "rgba(0,0,0,0.2)",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      ) : (
        <span style={{ fontSize: "9px", letterSpacing: "0.05em", color: "#56565E", textTransform: "uppercase" }}>
          {placeholder}
        </span>
      )}
      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) setUrl(URL.createObjectURL(f));
        }}
      />
    </div>
  );
}
