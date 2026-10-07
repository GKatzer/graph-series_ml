// Node 25+ ships its own experimental `localStorage` global that shadows jsdom's and is unusable without
// `--localstorage-file`. Install a small in-memory Storage when the global is missing or broken.
class MemoryStorage implements Storage {
  private data = new Map<string, string>()
  get length() { return this.data.size }
  clear() { this.data.clear() }
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null }
  key(i: number) { return [...this.data.keys()][i] ?? null }
  removeItem(k: string) { this.data.delete(k) }
  setItem(k: string, v: string) { this.data.set(k, String(v)) }
}

let usable = false
try {
  usable = typeof localStorage !== 'undefined' && typeof localStorage.clear === 'function'
} catch {
  usable = false
}
if (!usable) {
  const store = new MemoryStorage()
  Object.defineProperty(globalThis, 'localStorage', { value: store, configurable: true })
  Object.defineProperty(window, 'localStorage', { value: store, configurable: true })
}
