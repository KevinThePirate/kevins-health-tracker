import { useState, useEffect } from 'react'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import { supabase } from '../supabase'

const DEFAULT_HABITS = [
  'Nox', 'No check social media', 'Shower', 'Vitamins', 'Walk',
  '10k Steps', 'Exercise', 'Quiet time', 'Brush teeth', 'Something social',
  'Solo evening', 'Positive action', 'Sleep 8 hours', 'Eat well',
  'Comic work', 'Daily spending budget', '3 meals'
]

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

// Register (or retrieve) the dedicated push-only service worker.
// It lives at /push/ scope so it doesn't conflict with the main PWA SW.
async function getPushReg() {
  const swUrl = '/kevins-health-tracker/push-sw.js'
  const scope  = '/kevins-health-tracker/push/'

  // Reuse if already active
  const regs = await navigator.serviceWorker.getRegistrations()
  const existing = regs.find(r => r.scope.endsWith('/push/'))
  if (existing?.active) return existing

  // Register and wait for activation
  const reg = await navigator.serviceWorker.register(swUrl, { scope })
  if (reg.active) return reg

  return new Promise((resolve, reject) => {
    const sw = reg.installing || reg.waiting
    if (!sw) { reject(new Error('Push service worker failed to start')); return }
    sw.addEventListener('statechange', function handler(e) {
      if (e.target.state === 'activated') {
        sw.removeEventListener('statechange', handler)
        resolve(reg)
      }
      if (e.target.state === 'redundant') {
        sw.removeEventListener('statechange', handler)
        reject(new Error('Push service worker became redundant'))
      }
    })
  })
}

export default function Settings() {
  const [habits, setHabits] = useState([])
  const [newHabit, setNewHabit] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [notifTime, setNotifTime] = useState('09:00')
  const [notifEnabled, setNotifEnabled] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [notifStatus, setNotifStatus] = useState('')

  useEffect(() => {
    loadHabits()
    loadNotifPrefs()
  }, [])

  async function loadNotifPrefs() {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('push_subscriptions').select('notification_time').eq('user_id', user.id).maybeSingle()
      if (data) {
        setNotifTime(data.notification_time)
        setNotifEnabled(true)
      }
    } catch (e) { /* no subscription yet */ }
  }

  async function enableNotifications() {
    setNotifStatus('requesting')
    try {
      // 1. Check browser support
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        setNotifStatus('error: Push notifications not supported in this browser')
        return
      }

      // 2. Request permission
      const permission = await Notification.requestPermission()
      setNotifPermission(permission)
      if (permission !== 'granted') { setNotifStatus(''); return }

      // 3. Check VAPID key is set
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) {
        setNotifStatus('error: VITE_VAPID_PUBLIC_KEY not set — add it to GitHub Secrets and redeploy')
        return
      }

      // 4. Register (or retrieve) the push-only SW
      let reg
      try {
        reg = await getPushReg()
      } catch (swErr) {
        setNotifStatus(`error: ${swErr.message}`)
        return
      }

      // 5. Subscribe to push
      let pushSub = await reg.pushManager.getSubscription()
      if (!pushSub) {
        pushSub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey)
        })
      }

      // 6. Save subscription + time to Supabase
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: user.id,
        subscription: pushSub.toJSON(),
        notification_time: notifTime,
        utc_offset_mins: -new Date().getTimezoneOffset()
      }, { onConflict: 'user_id' })

      if (error) { setNotifStatus(`error: ${error.message}`); return }
      setNotifEnabled(true)
      setNotifStatus('saved')
      setTimeout(() => setNotifStatus(''), 2500)
    } catch (e) {
      setNotifStatus(`error: ${e.message}`)
    }
  }

  async function disableNotifications() {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      const pushReg = regs.find(r => r.scope.endsWith('/push/'))
      if (pushReg) {
        const pushSub = await pushReg.pushManager.getSubscription()
        if (pushSub) await pushSub.unsubscribe()
      }
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    } catch (e) { console.error(e) }
    setNotifEnabled(false)
    setNotifStatus('')
  }

  async function updateNotifTime(time) {
    setNotifTime(time)
    if (!notifEnabled) return
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('push_subscriptions')
      .update({ notification_time: time, utc_offset_mins: -new Date().getTimezoneOffset() })
      .eq('user_id', user.id)
  }

  async function loadHabits() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('habits').select('*').eq('user_id', user.id)
      .eq('is_deleted', false).order('sort_order')

    if (data?.length) {
      setHabits(data)
    } else {
      const toInsert = DEFAULT_HABITS.map((name, i) => ({
        user_id: user.id, name, sort_order: i, is_deleted: false
      }))
      const { data: inserted } = await supabase.from('habits').insert(toInsert).select()
      setHabits(inserted || [])
    }
    setLoading(false)
  }

  async function addHabit() {
    if (!newHabit.trim()) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('habits').insert({
      user_id: user.id,
      name: newHabit.trim(),
      sort_order: habits.length,
      is_deleted: false
    }).select().single()
    if (data) setHabits(prev => [...prev, data])
    setNewHabit('')
  }

  async function deleteHabit(id) {
    await supabase.from('habits').update({ is_deleted: true }).eq('id', id)
    setHabits(prev => prev.filter(h => h.id !== id))
  }

  function startEdit(habit) {
    setEditingId(habit.id)
    setEditingName(habit.name)
  }

  async function commitEdit(id) {
    const name = editingName.trim()
    if (!name) { setEditingId(null); return }
    await supabase.from('habits').update({ name }).eq('id', id)
    setHabits(prev => prev.map(h => h.id === id ? { ...h, name } : h))
    setEditingId(null)
  }

  async function saveOrder() {
    setSaving(true)
    await Promise.all(habits.map((h, i) =>
      supabase.from('habits').update({ sort_order: i }).eq('id', h.id)
    ))
    setSaving(false)
    setMsg('Order saved!')
    setTimeout(() => setMsg(''), 2000)
  }

  async function exportData() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('daily_logs').select('*').eq('user_id', user.id)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `health-tracker-export-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Habit management */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-3">Habits</h2>
        <p className="text-xs text-gray-400 mb-3">Drag to reorder on desktop. Use arrows on mobile.</p>

        <Reorder.Group axis="y" values={habits} onReorder={setHabits} className="space-y-1.5">
          <AnimatePresence>
            {habits.map((habit, idx) => (
              <Reorder.Item
                key={habit.id}
                value={habit}
                className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2.5 cursor-grab active:cursor-grabbing"
              >
                <span className="text-gray-300 text-sm select-none">⠿</span>
                {editingId === habit.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={() => commitEdit(habit.id)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(habit.id); if (e.key === 'Escape') setEditingId(null) }}
                    className="flex-1 px-2 py-1 rounded-lg border border-teal-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
                  />
                ) : (
                  <span
                    className="flex-1 text-sm font-medium text-gray-700 cursor-text"
                    onDoubleClick={() => startEdit(habit)}
                    title="Double-click to rename"
                  >{habit.name}</span>
                )}
                <button
                  onClick={() => startEdit(habit)}
                  className="w-7 h-7 rounded-lg bg-teal-50 text-teal-500 text-xs flex items-center justify-center hover:bg-teal-100"
                  title="Rename"
                >✏️</button>
                <div className="flex gap-1 md:hidden">
                  <button
                    onClick={() => {
                      if (idx === 0) return
                      const next = [...habits]
                      ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
                      setHabits(next)
                    }}
                    className="w-7 h-7 rounded-lg bg-gray-200 text-gray-600 text-xs flex items-center justify-center"
                  >↑</button>
                  <button
                    onClick={() => {
                      if (idx === habits.length - 1) return
                      const next = [...habits]
                      ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
                      setHabits(next)
                    }}
                    className="w-7 h-7 rounded-lg bg-gray-200 text-gray-600 text-xs flex items-center justify-center"
                  >↓</button>
                </div>
                <button
                  onClick={() => deleteHabit(habit.id)}
                  className="w-7 h-7 rounded-lg bg-red-50 text-red-400 text-xs flex items-center justify-center hover:bg-red-100"
                >✕</button>
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>

        <div className="flex gap-2 mt-3">
          <input
            value={newHabit}
            onChange={e => setNewHabit(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addHabit()}
            placeholder="Add new habit…"
            className="flex-1 px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
          />
          <button
            onClick={addHabit}
            className="px-4 py-2.5 bg-teal-500 text-white rounded-xl text-sm font-semibold hover:bg-teal-600"
          >Add</button>
        </div>

        <button
          onClick={saveOrder}
          disabled={saving}
          className="mt-3 w-full py-2.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : msg || 'Save order'}
        </button>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-3">Notifications</h2>

        {notifPermission === 'unsupported' && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-xl px-3 py-2 mb-3">
            Your browser doesn't support push notifications.
          </p>
        )}
        {notifPermission === 'denied' && (
          <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mb-3">
            Notifications are blocked. Open site settings for this page, set Notifications to "Allow", then try again.
          </p>
        )}

        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-700 font-medium">Daily reminder</p>
            <p className="text-xs text-gray-400">Fires even when the app is closed</p>
          </div>
          <button
            disabled={notifPermission === 'unsupported' || notifPermission === 'denied' || notifStatus === 'requesting'}
            onClick={() => notifEnabled ? disableNotifications() : enableNotifications()}
            className={`relative w-12 h-6 rounded-full transition-colors disabled:opacity-40 ${notifEnabled ? 'bg-teal-500' : 'bg-gray-200'}`}
          >
            <motion.div
              animate={{ x: notifEnabled ? 24 : 2 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
            />
          </button>
        </div>

        {notifEnabled && (
          <div className="flex items-center gap-3 mb-3">
            <label className="text-sm text-gray-600">Remind me at</label>
            <input
              type="time"
              value={notifTime}
              onChange={e => updateNotifTime(e.target.value)}
              className="px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>
        )}

        {notifStatus === 'requesting' && (
          <p className="text-xs text-gray-400 mt-2">Setting up notifications…</p>
        )}
        {notifStatus === 'saved' && (
          <p className="text-xs text-teal-600 bg-teal-50 rounded-xl px-3 py-2 mt-2">
            ✓ You'll be reminded at {notifTime} if yesterday isn't logged yet.
          </p>
        )}
        {notifStatus.startsWith('error') && (
          <p className="text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-2">{notifStatus}</p>
        )}
        {notifEnabled && notifStatus === '' && (
          <p className="text-xs text-teal-600 mt-2">✓ Reminders on — daily at {notifTime}</p>
        )}

        <p className="text-xs text-gray-400 mt-2">
          Works on desktop Chrome/Firefox/Edge and Android Chrome. iOS requires adding to home screen first.
        </p>
      </section>

      {/* Data export */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-3">Data</h2>
        <button
          onClick={exportData}
          className="w-full py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          📥 Export all data as JSON
        </button>
      </section>

      {/* Sign out */}
      <section className="bg-white rounded-2xl shadow-sm p-5">
        <button
          onClick={signOut}
          className="w-full py-3 rounded-xl bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors"
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
