import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function safeParse(str) {
  if (!str || typeof str !== 'string') return [];
  try { return JSON.parse(str); } catch { return []; }
}
