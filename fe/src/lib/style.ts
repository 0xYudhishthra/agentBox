import type { CSSProperties } from "react";

/**
 * Parse a CSS declaration string ("color:#fff;font-size:13px") into a React
 * style object. Lets us port the design's inline `style="..."` strings (and the
 * dynamic CSS fragments the original DCLogic builders emit) verbatim.
 */
export function st(css: string): CSSProperties {
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i === -1) continue;
    const prop = decl.slice(0, i).trim();
    if (!prop) continue;
    const val = decl.slice(i + 1).trim();
    const key = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    out[key] = val;
  }
  return out as CSSProperties;
}
