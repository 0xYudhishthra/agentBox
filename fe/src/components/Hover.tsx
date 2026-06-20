"use client";

import React, { useState } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";

type HoverProps = {
  as?: ElementType;
  style?: CSSProperties;
  hover?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>;

/**
 * Ports the design framework's `style-hover` attribute: merges `hover` on top of
 * `style` while the pointer is over the element.
 */
export default function Hover({ as: Tag = "div", style, hover, children, ...rest }: HoverProps) {
  const [over, setOver] = useState(false);
  return (
    <Tag
      {...rest}
      style={{ ...style, ...(over && hover ? hover : undefined) }}
      onMouseEnter={() => setOver(true)}
      onMouseLeave={() => setOver(false)}
    >
      {children}
    </Tag>
  );
}
