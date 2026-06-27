// jsdom doesn't expose a working Web Storage here, so give mockApi.js a
// minimal in-memory localStorage to persist against during tests.
function createMemoryStorage() {
  let store = {}
  return {
    get length() {
      return Object.keys(store).length
    },
    key(i) {
      return Object.keys(store)[i] ?? null
    },
    getItem(k) {
      return k in store ? store[k] : null
    },
    setItem(k, v) {
      store[String(k)] = String(v)
    },
    removeItem(k) {
      delete store[k]
    },
    clear() {
      store = {}
    },
  }
}

if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', {
    value: createMemoryStorage(),
    configurable: true,
  })
}
