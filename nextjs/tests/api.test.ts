import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api, failureMessage } from '@/lib/api'

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => '' })
const fail = (status: number, text = 'Internal Server Error') => ({ ok: false, status, json: async () => ({}), text: async () => text })

let fetchMock: ReturnType<typeof vi.fn>
const lastUrl = () => String(fetchMock.mock.calls.at(-1)![0])

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(ok({}))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

describe('request URLs', () => {
  it('search: defaults to semantic mode and 20 results', async () => {
    await api.search('space western')
    expect(lastUrl()).toBe('/api/backend/api/search?q=space+western&limit=20&mode=semantic')
  })

  it('search: passes mode and limit', async () => {
    await api.search('x', 8, 'hybrid')
    expect(lastUrl()).toBe('/api/backend/api/search?q=x&limit=8&mode=hybrid')
  })

  it('search: encodes special characters in the query', async () => {
    await api.search('a&b=c/d')
    expect(lastUrl()).toContain('q=a%26b%3Dc%2Fd')
  })

  it('searchPersons', async () => {
    await api.searchPersons('cranston')
    expect(lastUrl()).toBe('/api/backend/api/search/persons?q=cranston&limit=10')
  })

  it('series and person detail', async () => {
    await api.series(1396)
    expect(lastUrl()).toBe('/api/backend/api/series/1396')
    await api.person('17419')
    expect(lastUrl()).toBe('/api/backend/api/person/17419')
  })

  it('graphs: depth defaults to 1, person graph path', async () => {
    await api.seriesGraph(1396)
    expect(lastUrl()).toBe('/api/backend/api/graph/series/1396?depth=1')
    await api.seriesGraph(1396, 2)
    expect(lastUrl()).toBe('/api/backend/api/graph/series/1396?depth=2')
    await api.personGraph(17419)
    expect(lastUrl()).toBe('/api/backend/api/person/17419/graph')
  })

  it('similar: hybrid by default, limit always sent', async () => {
    await api.similar(1396)
    expect(lastUrl()).toBe('/api/backend/api/series/1396/similar?mode=hybrid&limit=20')
  })

  it('nodeGraph: url-encodes the key and sends the default limit of 50', async () => {
    await api.nodeGraph('country', 'US')
    expect(lastUrl()).toBe('/api/backend/api/graph/node/country/US?limit=50')
    await api.nodeGraph('keyword', 'a b/c')
    expect(lastUrl()).toContain('/keyword/a%20b%2Fc?')
  })
})

describe('responses and errors', () => {
  it('returns the parsed JSON body', async () => {
    fetchMock.mockResolvedValueOnce(ok({ query: 'q', results: [], total: 0 }))
    await expect(api.search('q')).resolves.toEqual({ query: 'q', results: [], total: 0 })
  })

  it('throws ApiError carrying the HTTP status', async () => {
    fetchMock.mockResolvedValueOnce(fail(500))
    const err = await api.search('q').catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(500)
    expect(err.message).toBe('API 500: Internal Server Error')
  })

  it('still throws when reading the error body fails', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 502, text: () => Promise.reject(new Error('boom')) })
    const err = await api.series(1).catch(e => e)
    expect(err).toBeInstanceOf(ApiError)
    expect(err.status).toBe(502)
  })
})

describe('failureMessage', () => {
  it('includes the HTTP status for API errors', () => {
    expect(failureMessage('Search', new ApiError(500, ''))).toBe('Search failed (HTTP 500), try again')
  })

  it('omits the status for network errors', () => {
    expect(failureMessage('Search', new TypeError('Failed to fetch'))).toBe('Search failed, try again')
  })
})
