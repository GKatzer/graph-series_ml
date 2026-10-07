import { describe, expect, it } from 'vitest'
import { keyOfNodeId, nodeDisplayName, nodeId } from '@/lib/nodeId'

describe('nodeId / keyOfNodeId', () => {
  it('builds a lower-case label prefix', () => {
    expect(nodeId('Series', 1399)).toBe('series:1399')
    expect(nodeId('Person', 1399)).toBe('person:1399')
    expect(nodeId('Country', 'US')).toBe('country:US')
  })

  it('keeps ids of different labels with the same key apart', () => {
    expect(nodeId('Series', 1399)).not.toBe(nodeId('Person', 1399))
  })

  it('returns the native key', () => {
    expect(keyOfNodeId('series:1399')).toBe('1399')
    expect(keyOfNodeId('country:US')).toBe('US')
  })

  it('splits on the first colon only, so keys may contain colons', () => {
    expect(keyOfNodeId('keyword:a:b')).toBe('a:b')
  })

  it('returns an id without a colon unchanged', () => {
    expect(keyOfNodeId('1399')).toBe('1399')
  })

  it('round-trips', () => {
    expect(keyOfNodeId(nodeId('Network', 49))).toBe('49')
  })
})

describe('nodeDisplayName', () => {
  it('maps ISO codes to English names for Country and Language', () => {
    expect(nodeDisplayName('Country', 'US', 'US')).toBe('United States')
    expect(nodeDisplayName('Language', 'fr', 'fr')).toBe('French')
  })

  it('falls back to the code when the code is not valid', () => {
    expect(nodeDisplayName('Country', 'not a code!', 'x')).toBe('not a code!')
  })

  it('uses the backend name for every other label', () => {
    expect(nodeDisplayName('Series', 1396, 'Breaking Bad')).toBe('Breaking Bad')
    expect(nodeDisplayName('Genre', 18, 'Drama')).toBe('Drama')
  })
})
