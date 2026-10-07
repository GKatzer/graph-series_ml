// lib/utils.ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
/**
 * Human-readable relevance of a search result. The backend's `score` means different things per mode:
 *   semantic   — cosine similarity (0..1), shown as a percentage;
 *   hybrid     — cosine similarity plus graph bonuses, so it can exceed 1; shown as a plain number;
 *   structural — Neo4j full-text relevance (unbounded); shown as a plain number.
 */
export function formatScore(score: number, mode: 'semantic' | 'structural' | 'hybrid'): string {
  if (mode === 'semantic') return `${(score * 100).toFixed(0)}%`
  return score.toFixed(mode === 'hybrid' ? 2 : 1)
}
