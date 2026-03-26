// === ADMIN STORE — MADE EVENTS Platform ===
// Singleton per dati admin: chiama dashboard.bootstrap UNA sola volta,
// poi usa la cache per 60s. Dopo una mutazione chiama refresh() per invalidare.
//
// Utilizzo:
//   const data     = adminStore.getData()   // { leads, events, applications, stats } | null
//   const loading  = adminStore.isLoading()
//   const updated  = adminStore.lastUpdate  // timestamp ms | null
//   adminStore.subscribe(callback)          // notifica quando i dati cambiano
//   await adminStore.refresh()              // forza reload

import { dashboardApi } from '../api/client'

const CACHE_TTL_MS = 60_000 // 60s

let _data       = null
let _loading    = false
let _lastUpdate = null
let _promise    = null
const _listeners = new Set()

function _notify() {
  _listeners.forEach(fn => {
    try { fn() } catch (e) { /* noop */ }
  })
}

function _isStale() {
  if (!_lastUpdate) return true
  return (Date.now() - _lastUpdate) > CACHE_TTL_MS
}

function _dedupeById(arr) {
  const seen = new Set()
  return (arr ?? []).filter(item => {
    if (!item?.entity_id || seen.has(item.entity_id)) return false
    seen.add(item.entity_id)
    return true
  })
}

async function _fetch() {
  _loading = true
  _notify()
  try {
    const res = await dashboardApi.bootstrap()
    if (res.success && res.data) {
      const d = res.data
      // Deduplica per entity_id — previene duplicati da reset parziali del DB
      const leads        = _dedupeById(d.leads)
      const events       = _dedupeById(d.events)
      const applications = _dedupeById(d.applications)
      // Ricalcola pendingTalent dal raw array — il backend usa TALENT_PROFILE
      // ma i lead con COMPLETED_PENDING_APPROVAL sono la fonte corretta
      const pendingTalent = leads.filter(l => l.status === 'COMPLETED_PENDING_APPROVAL').length
      _data = {
        leads,
        events,
        applications,
        stats: { ...(d.stats ?? {}), pendingTalent },
      }
      _lastUpdate = Date.now()
    }
  } catch (e) {
    // rete failure — mantieni dati precedenti se presenti
  } finally {
    _loading = false
    _promise = null
    _notify()
  }
}

const adminStore = {
  /** Restituisce i dati in cache, o null se non ancora caricati. */
  getData() {
    return _data
  },

  isLoading() {
    return _loading
  },

  get lastUpdate() {
    return _lastUpdate
  },

  /**
   * Assicura che i dati siano freschi (max 60s).
   * Se in cache, restituisce subito. Se stale o mancanti, chiama il backend.
   * Deduplica chiamate parallele (una sola fetch per volta).
   */
  async ensure() {
    if (!_isStale()) return _data
    if (!_promise) {
      _promise = _fetch()
    }
    await _promise
    return _data
  },

  /** Forza reload, ignorando la cache. */
  async refresh() {
    _lastUpdate = null
    if (!_promise) {
      _promise = _fetch()
    }
    await _promise
    return _data
  },

  /** Iscriviti a cambamenti. Ritorna la funzione di unsubscribe. */
  subscribe(fn) {
    _listeners.add(fn)
    return () => _listeners.delete(fn)
  },
}

export default adminStore
