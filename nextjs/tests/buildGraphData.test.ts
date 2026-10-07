import { describe, expect, it } from 'vitest'
import { buildGraphData } from '@/components/SeriesGraph'
import { FG2D_NODE, NODE_COLORS, NODE_COLOR_FALLBACK, LINK_COLORS, LINK_COLOR_FALLBACK } from '@/lib/constants'
import type { GraphData } from '@/lib/types'

const node = (label: any, key: number | string, name: string) => ({
  id: `${String(label).toLowerCase()}:${key}`, key, label, name, properties: {},
})

const data: GraphData = {
  nodes: [
    node('Series', 1, 'Show'),
    node('Person', 10, 'Actor A'),
    node('Person', 11, 'Actor B'),
    node('Country', 'US', 'US'),
    node('Weird' as any, 5, 'Unknown label'),
  ],
  edges: [
    { source: 'person:10', target: 'series:1', type: 'ACTED_IN' },
    { source: 'person:11', target: 'series:1', type: 'DIRECTED' },
    { source: 'series:1', target: 'country:US', type: 'PRODUCED_IN' },
    { source: 'series:1', target: 'weird:5', type: 'NOT_A_REAL_TYPE' },
  ],
}

describe('buildGraphData', () => {
  const { nodes, links } = buildGraphData(data, 'series:1')
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]))

  it('keeps every node and link', () => {
    expect(nodes).toHaveLength(5)
    expect(links).toHaveLength(4)
  })

  it('counts degree per node', () => {
    expect(byId['series:1'].degree).toBe(4)
    expect(byId['person:10'].degree).toBe(1)
  })

  it('gives the centre node the fixed size', () => {
    expect(byId['series:1'].val).toBe(FG2D_NODE.centerVal)
  })

  it('sizes other nodes by degree, within the limits', () => {
    expect(byId['person:10'].val).toBe(Math.max(FG2D_NODE.minVal, FG2D_NODE.valPerDegree))
    expect(byId['person:10'].val).toBeLessThanOrEqual(FG2D_NODE.maxVal)
  })

  it('colours nodes by label, with a fallback for unknown labels', () => {
    expect(byId['person:10'].color).toBe(NODE_COLORS.Person)
    expect(byId['weird:5'].color).toBe(NODE_COLOR_FALLBACK)
  })

  it('colours links by type, with a fallback', () => {
    expect(links[0].color).toBe(LINK_COLORS.ACTED_IN)
    expect(links[3].color).toBe(LINK_COLOR_FALLBACK)
  })

  it('shows country names instead of ISO codes', () => {
    expect(byId['country:US'].name).toBe('United States')
  })
})
