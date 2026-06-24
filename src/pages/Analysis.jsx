import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts'
import { supabase } from '../supabase'

const stagger = { animate: { transition: { staggerChildren: 0.08 } } }
const item = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 280, damping: 22 } }
}

export default function Analysis() {
  const [days, setDays] = useState(7)
  const [logs, setLogs] = useState([])
  const [habits, setHabits] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [days])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const from = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const { data: logData } = await supabase
      .from('daily_logs').select('*').eq('user_id', user.id)
      .gte('log_date', from).order('log_date')

    const { data: habitData } = await supabase
      .from('habits').select('*').eq('user_id', user.id).eq('is_deleted', false).order('sort_order')

    setLogs(logData || [])
    setHabits(habitData || [])
    setLoading(false)
  }

  // ---- Habit performance ----
  const habitPerf = habits.map(h => ({
    name: h.name.length > 12 ? h.name.slice(0, 12) + '…' : h.name,
    fullName: h.name,
    pct: logs.length
      ? Math.round((logs.filter(l => l.habit_ids?.includes(h.id)).length / logs.length) * 100)
      : 0
  }))

  // ---- Mood + habit timeline ----
  const moodLine = logs.map(l => ({
    date: l.log_date.slice(5),
    mood: l.mood,
    habits: l.habit_ids?.length && habits.length
      ? Math.round((l.habit_ids.length / habits.length) * 100)
      : 0
  }))

  // ---- Ulcer timeline ----
  const ulcerEpisodes = []
  let inEpisode = false
  logs.forEach((l, i) => {
    if (!l.ulcer_clear) {
      if (!inEpisode) {
        ulcerEpisodes.push({ start: l.log_date, end: l.log_date, maxPain: l.ulcer_pain || 1 })
        inEpisode = true
      } else {
        const ep = ulcerEpisodes[ulcerEpisodes.length - 1]
        ep.end = l.log_date
        ep.maxPain = Math.max(ep.maxPain, l.ulcer_pain || 1)
      }
    } else {
      inEpisode = false
    }
  })

  const lastUlcerLog = [...logs].reverse().find(l => !l.ulcer_clear)
  const daysSinceUlcer = lastUlcerLog
    ? Math.floor((Date.now() - new Date(lastUlcerLog.log_date)) / 86400000)
    : null

  // ---- Food / ulcer correlation ----
  const foodCorrelation = {}
  logs.forEach((log, i) => {
    // Check if an ulcer episode started within 2 days after this log
    const started = logs.slice(i + 1, i + 3).some(l => !l.ulcer_clear)
    if (started && log.food_parsed) {
      log.food_parsed.forEach(f => {
        foodCorrelation[f.name] = (foodCorrelation[f.name] || 0) + 1
      })
    }
  })
  const foodCorrelationList = Object.entries(foodCorrelation)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)

  // ---- Streak heatmap ----
  const heatmapDays = days === 7 ? 90 : 365
  const heatDates = Array.from({ length: heatmapDays }, (_, i) => {
    const d = new Date(Date.now() - (heatmapDays - 1 - i) * 86400000)
    return d.toISOString().split('T')[0]
  })
  const logMap = {}
  logs.forEach(l => { logMap[l.log_date] = l })

  function heatColor(date) {
    const l = logMap[date]
    if (!l) return '#f3f4f6'
    const pct = l.habit_ids?.length && habits.length
      ? (l.habit_ids.length / habits.length) * 100 : 0
    if (pct >= 80) return '#0d9488'
    if (pct >= 60) return '#2dd4bf'
    if (pct >= 40) return '#5eead4'
    if (pct > 0) return '#ccfbf1'
    return '#e5e7eb'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <motion.div variants={stagger} initial="initial" animate="animate"
      className="max-w-2xl mx-auto px-4 py-6 space-y-6">

      <motion.div variants={item} className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Analysis</h1>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          className="text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          <option value={7}>Last 7 days</option>
          <option value={14}>Last 14 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </motion.div>

      {logs.length === 0 && (
        <motion.div variants={item} className="bg-white rounded-2xl shadow-sm p-8 text-center text-gray-400">
          No data yet. Start logging to see analysis!
        </motion.div>
      )}

      {/* Habit performance */}
      {habitPerf.length > 0 && (
        <motion.section variants={item} className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Habit Performance</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={habitPerf} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(v, _, props) => [`${v}%`, props.payload.fullName]}
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
              />
              <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: '70%', position: 'right', fontSize: 10 }} />
              <Bar dataKey="pct" fill="#14b8a6" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={800} />
            </BarChart>
          </ResponsiveContainer>
        </motion.section>
      )}

      {/* Mood timeline */}
      {moodLine.length > 0 && (
        <motion.section variants={item} className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-4">Mood & Habits Timeline</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={moodLine} margin={{ left: -20, right: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis yAxisId="mood" domain={[1, 5]} tick={{ fontSize: 10 }} />
              <YAxis yAxisId="habits" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="mood" type="monotone" dataKey="mood" stroke="#14b8a6" strokeWidth={2}
                dot={{ fill: '#14b8a6', r: 3 }} name="Mood (1-5)" isAnimationActive animationDuration={800} />
              <Line yAxisId="habits" type="monotone" dataKey="habits" stroke="#f59e0b" strokeWidth={2}
                dot={{ fill: '#f59e0b', r: 3 }} name="Habits %" isAnimationActive animationDuration={800} />
            </LineChart>
          </ResponsiveContainer>
        </motion.section>
      )}

      {/* Ulcers */}
      <motion.section variants={item} className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-3">Ulcer Tracker</h2>
        {daysSinceUlcer !== null ? (
          <div className="text-center py-2">
            <div className="text-5xl font-black text-teal-500">{daysSinceUlcer}</div>
            <div className="text-gray-500 text-sm mt-1">days since last ulcer</div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm text-center py-2">No ulcer episodes logged in this period ✅</p>
        )}
        {ulcerEpisodes.length > 0 && (
          <div className="mt-3 space-y-2">
            {ulcerEpisodes.map((ep, i) => (
              <div key={i} className="flex justify-between text-sm bg-red-50 rounded-xl px-4 py-2">
                <span className="text-gray-700">{ep.start} → {ep.end}</span>
                <span className="text-red-500 font-medium">Pain {ep.maxPain}/5</span>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Food/ulcer correlation */}
      {foodCorrelationList.length > 0 && (
        <motion.section variants={item} className="bg-white rounded-2xl shadow-sm p-5">
          <h2 className="font-bold text-gray-800 mb-1">Food Before Ulcer Episodes</h2>
          <p className="text-xs text-gray-400 mb-3">Foods eaten within 48h before an episode started</p>
          <div className="space-y-2">
            {foodCorrelationList.map(([food, count]) => (
              <div key={food} className="flex justify-between text-sm">
                <span className="text-gray-700 capitalize">{food}</span>
                <span className="font-semibold text-coral-600" style={{ color: '#f83f35' }}>{count}×</span>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Streak heatmap */}
      <motion.section variants={item} className="bg-white rounded-2xl shadow-sm p-5">
        <h2 className="font-bold text-gray-800 mb-3">Habit Heatmap</h2>
        <div className="flex flex-wrap gap-1">
          {heatDates.map(d => (
            <div
              key={d}
              title={`${d}: ${logMap[d] ? `${logMap[d].habit_ids?.length || 0} habits` : 'Not logged'}`}
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: heatColor(d) }}
            />
          ))}
        </div>
        <div className="flex gap-3 mt-2 text-xs text-gray-400 items-center">
          <span>Less</span>
          {['#f3f4f6','#ccfbf1','#5eead4','#2dd4bf','#0d9488'].map(c => (
            <div key={c} className="w-3 h-3 rounded-sm" style={{ backgroundColor: c }} />
          ))}
          <span>More</span>
        </div>
      </motion.section>
    </motion.div>
  )
}
