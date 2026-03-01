import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Remove keys with `undefined` values from objects/arrays recursively.
export function stripUndefined<T>(input: T): T {
  if (input === undefined) return input as unknown as T;
  if (input === null) return input;

  if (Array.isArray(input)) {
    const arr = input
      .map((v) => stripUndefined(v as unknown) as unknown)
      .filter((v) => v !== undefined);
    return arr as unknown as T;
  }

  if (typeof input === 'object') {
    // Preserve non-plain objects (Date, etc.)
    const proto = Object.getPrototypeOf(input as object);
    if (proto && proto !== Object.prototype) return input;

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
      if (v === undefined) continue;
      out[k] = stripUndefined(v as unknown) as unknown;
    }
    return out as unknown as T;
  }

  return input;
}
