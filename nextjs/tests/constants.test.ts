import { describe, expect, it } from 'vitest'
import {
  EXPANDABLE_LABELS, L1_LABELS, LEGACY_STORAGE_KEYS, LINK_COLORS, NODE_COLORS, NODE_TYPE_MAP, STORAGE_KEYS,
} from '@/lib/constants'

describe('constants stay consistent', () => {
  it('has a colour for every expandable label', () => {
    for (const l of EXPANDABLE_LABELS) expect(NODE_COLORS[l], l).toBeTruthy()
  })

  it('has an API path segment for every L1 label', () => {
    for (const l of L1_LABELS) expect(NODE_TYPE_MAP[l], l).toBeTruthy()
  })

  it('has a colour for each of the eight relationship types', () => {
    expect(Object.keys(LINK_COLORS).sort()).toEqual(
      ['ACTED_IN', 'AIRED_ON', 'CREATED', 'DIRECTED', 'HAS_GENRE', 'HAS_KEYWORD', 'HAS_LANGUAGE', 'PRODUCED_IN'],
    )
  })

  it('uses unique localStorage keys, and none of them is a legacy key', () => {
    const values = Object.values(STORAGE_KEYS)
    expect(new Set(values).size).toBe(values.length)
    for (const k of LEGACY_STORAGE_KEYS) expect(values).not.toContain(k)
  })
})
