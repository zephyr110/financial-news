import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function safeParse(str) {
  try { return JSON.parse(str); } catch { return []; }
}
