import { useEffect, useState } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { supabase } from './supabase'
import Layout from './components/Layout'
import Login from './pages/Login'
import Today from './pages/Today'
import History from './pages/History'
import Analysis from './pages/Analysis'
import Settings from './pages/Settings'

async function checkAndNotify() {
  try {
    const prefs = JSON.parse(localStorage.getItem('notif_prefs') || '{}')
    if (!prefs.enabled) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    // Only fire once per calendar day
    const today = new Date().toISOString().split('T')[0]
    if (localStorage.getItem('last_notif_date') === today) return

    // Check if it's past the scheduled time
    const [h, m] = (prefs.time || '09:00').split(':').map(Number)
    const now = new Date()
    if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) return

    // Check if yesterday is already logged
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yStr = yesterday.toISOString().split('T')[0]

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: log } = await supabase
      .from('daily_logs').select('id').eq('user_id', user.id).eq('log_date', yStr).maybeSingle()
    if (log) return // already logged

    new Notification("Kevin's Health Tracker", {
      body: "Time to log yesterday — it only takes 30 seconds",
      icon: '/kevins-health-tracker/favicon.svg',
      tag: 'daily-reminder',
    })
    localStorage.setItem('last_notif_date', today)
  } catch (e) {
    console.error('notification check failed:', e)
  }
}

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) checkAndNotify()
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) checkAndNotify()
    })
    return () => subscription.unsubscribe()
  }, [])

  // Check every minute while the app is open
  useEffect(() => {
    if (!session) return
    const interval = setInterval(checkAndNotify, 60 * 1000)
    return () => clearInterval(interval)
  }, [session])

  if (session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="w-10 h-10 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <HashRouter>
      <AnimatePresence mode="wait">
        {!session ? (
          <Login key="login" />
        ) : (
          <Layout key="app">
            <Routes>
              <Route path="/" element={<Navigate to="/today" replace />} />
              <Route path="/today" element={<Today />} />
              <Route path="/history" element={<History />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/today" replace />} />
            </Routes>
          </Layout>
        )}
      </AnimatePresence>
    </HashRouter>
  )
}
