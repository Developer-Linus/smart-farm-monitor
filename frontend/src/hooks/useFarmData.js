import { useState, useEffect, useCallback, useRef } from 'react'

const POLL_STATUS_MS  = 3000
const POLL_HISTORY_MS = 10000

const defaultStatus = {
  temperature:     null,
  humidity:        null,
  soil_moisture:   null,
  irrigation_on:   false,
  irrigation_auto: true,
  last_updated:    null,
  leaf_result:     null,
  leaf_image_b64:  null,
  alerts:          [],
}

export function useFarmData() {
  const [status,  setStatus]  = useState(defaultStatus)
  const [history, setHistory] = useState([])
  const [online,  setOnline]  = useState(false)

  // Hard-reload to / on confirmed session expiry (2 consecutive 401s).
  // Using window.location instead of React Router navigate fully resets all
  // component state, which prevents any navigation loop.
  const authFailsRef = useRef(0)
  function onUnauthorized() {
    authFailsRef.current += 1
    if (authFailsRef.current >= 2) window.location.replace('/')
  }

  const fetchStatus = useCallback(async (signal) => {
    try {
      const res = await fetch('/api/status', { signal })
      if (res.status === 401) { onUnauthorized(); return }
      authFailsRef.current = 0
      if (!res.ok) throw new Error('HTTP ' + res.status)
      setStatus(await res.json())
      setOnline(true)
    } catch (e) {
      if (e.name !== 'AbortError') setOnline(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchHistory = useCallback(async (signal) => {
    try {
      const res = await fetch('/api/history', { signal })
      if (res.status === 401) { onUnauthorized(); return }
      if (!res.ok) return
      const data = await res.json()
      if (data.length) setHistory(data)
    } catch (_) {}
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller

    fetchStatus(signal)
    fetchHistory(signal)

    const sid = setInterval(() => fetchStatus(signal),  POLL_STATUS_MS)
    const hid = setInterval(() => fetchHistory(signal), POLL_HISTORY_MS)

    return () => {
      controller.abort()
      clearInterval(sid)
      clearInterval(hid)
    }
  }, [fetchStatus, fetchHistory])

  const toggleIrrigation = useCallback(async (payload) => {
    await fetch('/api/irrigation/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  }, [])

  return { status, history, online, toggleIrrigation }
}
