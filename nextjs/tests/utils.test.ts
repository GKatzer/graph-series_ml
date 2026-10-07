import { describe, expect, it } from 'vitest'
import { cn, formatScore } from '@/lib/utils'

describe('formatScore', () => {
  it('shows semantic scores (cosine similarity) as a percentage', () => {
    expect(formatScore(0.7173728942871094, 'semantic')).toBe('72%')
    expect(formatScore(1, 'semantic')).toBe('100%')
  })

  it('shows hybrid scores as a number that may exceed 1', () => {
    expect(formatScore(1.0207588, 'hybrid')).toBe('1.02')
    expect(formatScore(0.8991, 'hybrid')).toBe('0.90')
  })

  it('shows structural (full-text) scores with one decimal', () => {
    expect(formatScore(2, 'structural')).toBe('2.0')
  })
})

describe('cn', () => {
  it('merges conflicting Tailwind classes, last one wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy values', () => {
    expect(cn('a', false && 'b', undefined, 'c')).toBe('a c')
  })
})
