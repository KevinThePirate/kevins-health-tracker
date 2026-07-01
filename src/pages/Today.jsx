import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { parseFood, totalCalories } from '../utils/foodParser'

function yesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}
function todayStr() {
  return new Date().toISOString().split('T')[0]
}

const DEFAULT_HABITS = [
  'Nox', 'No check social media', 'Shower', 'Vitamins', 'Walk',
  '10k Steps', 'Exercise', 'Quiet time', 'Brush teeth', 'Something social',
  'Solo evening', 'Positive action', 'Sleep 8 hours', 'Eat well',
  'Comic work', 'Daily spending budget', '3 meals'
]

const MOODS = [
  { emoji: '😄', label: 'Happy', value: 5 },
  { emoji: '😐', label: 'Neutral', value: 3 },
  { emoji: '😔', label: 'Sad', value: 2 },
  { emoji: '😰', label: 'Anxious', value: 4 },
  { emoji: '😞', label: 'Depressed', value: 1 },
]

const staggerContainer = { animate: { transition: { staggerChildren: 0.06 } } }
const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

// Kevin's calorie targets — 5'11", 78kg, goal 70kg, lightly active
// Maintenance ~2400 kcal/day (Mifflin-St Jeor × 1.375 activity factor)
// Weight-loss goal ~2000 kcal/day (≈400 kcal deficit → ~0.5 kg/week)
const CAL_GOAL  = 2000
const CAL_MAINT = 2400
const CAL_MAX   = 3200  // bar full-width ceiling

function CalorieBar({ calories }) {
  if (!calories) return null
  const fillPct  = Math.min((calories / CAL_MAX) * 100, 100)
  const goalPct  = (CAL_GOAL  / CAL_MAX) * 100   // 62.5 %
  const maintPct = (CAL_MAINT / CAL_MAX) * 100   // 75 %
  const color    = calories > CAL_MAINT ? 'bg-red-500'
                 : calories > CAL_GOAL  ? 'bg-amber-400'
                 : 'bg-teal-500'
  const hitGoal  = calories >= CAL_GOAL
  const hitMaint = calories >= CAL_MAINT

  return (
    <div className="mt-4 pt-3 border-t border-gray-100">
      {/* Track */}
      <div className="relative h-3 rounded-full overflow-hidden bg-gray-100">
        {/* Zone tints */}
        <div className="absolute inset-y-0 bg-amber-50"
          style={{ left: `${goalPct}%`, width: `${maintPct - goalPct}%` }} />
        <div className="absolute inset-y-0 right-0 bg-red-50"
          style={{ left: `${maintPct}%` }} />
        {/* Animated fill */}
        <motion.div
          className={`absolute inset-y-0 left-0 rounded-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
        {/* Marker lines */}
        <div className="absolute inset-y-0 w-px z-10"
          style={{ left: `${goalPct}%`, background: 'rgba(13,148,136,0.7)' }} />
        <div className="absolute inset-y-0 w-px z-10"
          style={{ left: `${maintPct}%`, background: 'rgba(234,88,12,0.7)' }} />
      </div>

      {/* Tick labels */}
      <div className="relative mt-1 h-4">
        <span
          className={`absolute text-[10px] font-semibold -translate-x-1/2 whitespace-nowrap ${hitGoal ? 'text-teal-600' : 'text-gray-400'}`}
          style={{ left: `${goalPct}%` }}
        >
          {hitGoal ? '✓' : '◦'} {CAL_GOAL} goal
        </span>
        <span
          className={`absolute text-[10px] font-semibold -translate-x-1/2 whitespace-nowrap ${hitMaint ? 'text-orange-500' : 'text-gray-400'}`}
          style={{ left: `${maintPct}%` }}
        >
          {hitMaint ? '✓' : '◦'} {CAL_MAINT} maint.
        </span>
      </div>

      {/* Status line */}
      <p className="text-[10px] text-gray-400 mt-0.5">
        {calories < CAL_GOAL
          ? `${CAL_GOAL - calories} kcal under weight-loss goal`
          : calories < CAL_MAINT
          ? `In the zone — ${CAL_MAINT - calories} kcal below maintenance`
          : `${calories - CAL_MAINT} kcal over maintenance`}
      </p>
    </div>
  )
}

export default function Today() {
  const [searchParams] = useSearchParams()
  const [logDate, setLogDate] = useState(() => searchParams.get('date') || yesterday())
  const [habits, setHabits] = useState([])
  const [checked, setChecked] = useState([])
  const [mood, setMood] = useState(null)
  const [ulcerClear, setUlcerClear] = useState(true)
  const [ulcerCount, setUlcerCount] = useState(1)
  const [ulcerPain, setUlcerPain] = useState(null)
  const [foodRaw, setFoodRaw] = useState('')
  const [foodParsed, setFoodParsed] = useState([])
  const [notes, setNotes] = useState('')
  const [logId, setLogId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState('idle') // 'idle' | 'saving' | 'saved' | 'error'
  const [saveError, setSaveError] = useState('')

  // isDirty ref — set true when user changes something, false after load/save
  const isDirty = useRef(false)
  // Store logId in a ref too so the auto-save effect always has the latest value
  const logIdRef = useRef(null)
  const userIdRef = useRef(null)

  const pct = habits.length ? Math.round((checked.length / habits.length) * 100) : 0

  function changeDate(delta) {
    const d = new Date(logDate + 'T12:00:00')
    d.setDate(d.getDate() + delta)
    const next = d.toISOString().split('T')[0]
    if (next <= todayStr()) setLogDate(next)
  }

  // ── Load data when date changes ──────────────────────────────
  useEffect(() => { loadData() }, [logDate])

  async function loadData() {
    isDirty.current = false
    setLoading(true)
    setChecked([]); setMood(null); setUlcerClear(true); setUlcerCount(1)
    setUlcerPain(null); setFoodRaw(''); setFoodParsed([]); setNotes('')
    setLogId(null); logIdRef.current = null
    setSaveStatus('idle'); setSaveError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      userIdRef.current = user.id

      // Load habits
      const { data: habitData } = await supabase
        .from('habits').select('*').eq('user_id', user.id)
        .eq('is_deleted', false).order('sort_order')

      let habitList = habitData || []
      if (!habitList.length) {
        const toInsert = DEFAULT_HABITS.map((name, i) => ({
          user_id: user.id, name, sort_order: i, is_deleted: false
        }))
        const { data: inserted } = await supabase.from('habits').insert(toInsert).select()
        habitList = inserted || []
      }
      setHabits(habitList)

      // Load log for the selected date
      const { data: log } = await supabase
        .from('daily_logs').select('*').eq('user_id', user.id)
        .eq('log_date', logDate).maybeSingle()

      if (log) {
        logIdRef.current = log.id
        setLogId(log.id)
        setChecked(log.habit_ids || [])
        setMood(log.mood)
        setUlcerClear(log.ulcer_clear ?? true)
        setUlcerCount(log.ulcer_count ?? 1)
        setUlcerPain(log.ulcer_pain ?? null)
        setFoodRaw(log.food_raw || '')
        setFoodParsed(log.food_parsed || [])
        setNotes(log.notes || '')
      } else {
        // Pre-populate ulcer from previous day
        const prev = new Date(logDate + 'T12:00:00')
        prev.setDate(prev.getDate() - 1)
        const { data: prevLog } = await supabase
          .from('daily_logs').select('ulcer_clear,ulcer_count,ulcer_pain')
          .eq('user_id', user.id).eq('log_date', prev.toISOString().split('T')[0]).maybeSingle()
        if (prevLog && !prevLog.ulcer_clear) {
          setUlcerClear(false)
          setUlcerCount(prevLog.ulcer_count ?? 1)
          setUlcerPain(prevLog.ulcer_pain ?? null)
        }
      }
    } catch (e) {
      console.error('loadData error:', e)
    }
    setLoading(false)
  }

  // ── Auto-save: debounce 1.5s after any field change ──────────
  useEffect(() => {
    if (!isDirty.current) return
    if (!userIdRef.current) return

    setSaveStatus('saving')
    const timer = setTimeout(async () => {
      const parsed = parseFood(foodRaw)
      const cal = totalCalories(parsed)

      const payload = {
        user_id: userIdRef.current,
        log_date: logDate,
        mood,
        habit_ids: checked,
        food_raw: foodRaw,
        food_parsed: parsed,
        total_calories: cal || null,
        ulcer_clear: ulcerClear,
        ulcer_count: ulcerClear ? null : ulcerCount,
        ulcer_pain: ulcerClear ? null : ulcerPain,
        notes,
        updated_at: new Date().toISOString(),
      }

      let err, newId
      if (logIdRef.current) {
        const res = await supabase.from('daily_logs').update(payload).eq('id', logIdRef.current)
        err = res.error
      } else {
        const res = await supabase.from('daily_logs').insert(payload).select().maybeSingle()
        err = res.error
        if (res.data) { newId = res.data.id; logIdRef.current = newId; setLogId(newId) }
      }

      if (err) {
        console.error('save error:', err)
        setSaveStatus('error')
        setSaveError(err.message)
      } else {
        setFoodParsed(parsed)
        isDirty.current = false
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2000)
      }
    }, 1500)

    return () => clearTimeout(timer)
  }, [checked, mood, ulcerClear, ulcerCount, ulcerPain, foodRaw, notes])

  // Helpers that mark the form dirty
  function mark(setter) {
    return (...args) => {
      isDirty.current = true
      setter(...args)
    }
  }

  function toggleHabit(id) {
    isDirty.current = true
    setChecked(prev => prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id])
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

      {/* Header with date nav + save status */}
      <motion.div variants={staggerItem} initial="initial" animate="animate">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-gray-900">
            {logDate === todayStr() ? 'Today' : logDate === yesterday() ? 'Yesterday' : 'Log Entry'}
          </h1>
          {/* Save status indicator */}
          <AnimatePresence mode="wait">
            {saveStatus === 'saving' && (
              <motion.span key="saving"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-gray-400 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse inline-block" />
                Saving…
              </motion.span>
            )}
            {saveStatus === 'saved' && (
              <motion.span key="saved"
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="text-xs text-teal-600 flex items-center gap-1 font-medium"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500 inline-block" />
                Saved
              </motion.span>
            )}
            {saveStatus === 'error' && (
              <motion.span key="error"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-xs text-red-500 flex items-center gap-1"
                title={saveError}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                Error saving
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)}
            className="w-9 h-9 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold"
          >‹</button>
          <div className="flex-1 text-center bg-white rounded-xl shadow-sm border border-gray-100 py-2 px-3">
            <p className="text-sm font-semibold text-gray-700">
              {new Date(logDate + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
          <button onClick={() => changeDate(1)} disabled={logDate >= todayStr()}
            className="w-9 h-9 rounded-xl bg-white shadow-sm border border-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-50 font-bold disabled:opacity-30"
          >›</button>
        </div>
      </motion.div>

      {/* Habits */}
      <motion.section variants={staggerContainer} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <motion.div variants={staggerItem} className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-800">Habits</h2>
            <span className="text-sm font-semibold text-teal-600">{checked.length} / {habits.length} · {pct}%</span>
          </div>
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${pct >= 70 ? 'bg-teal-500' : 'bg-amber-400'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50" style={{ left: '70%' }} />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">Goal: 70%</div>
        </motion.div>

        {habits.map(habit => {
          const isChecked = checked.includes(habit.id)
          return (
            <motion.button key={habit.id} variants={staggerItem}
              onClick={() => toggleHabit(habit.id)}
              whileTap={{ scale: 0.97 }}
              className="w-full flex items-center gap-3 py-2.5 px-1 border-b border-gray-50 last:border-0 min-touch text-left"
            >
              <motion.div
                animate={isChecked ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isChecked ? 'bg-teal-500 border-teal-500' : 'border-gray-300'
                }`}
              >
                {isChecked && (
                  <motion.svg initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24"
                    stroke="currentColor" strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </motion.svg>
                )}
              </motion.div>
              <span className={`text-sm font-medium transition-colors ${isChecked ? 'text-teal-700 line-through decoration-teal-300' : 'text-gray-700'}`}>
                {habit.name}
              </span>
            </motion.button>
          )
        })}
      </motion.section>

      {/* Mood */}
      <motion.section variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-4">Mood</h2>
        <div className="flex justify-between">
          {MOODS.map(m => (
            <motion.button key={m.value}
              onClick={() => mark(setMood)(m.value)}
              animate={{ scale: mood === m.value ? 1.25 : 1 }}
              whileTap={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="flex flex-col items-center gap-1 min-touch"
            >
              <span className="text-3xl">{m.emoji}</span>
              <span className={`text-xs font-medium transition-colors ${mood === m.value ? 'text-teal-600' : 'text-gray-400'}`}>
                {m.label}
              </span>
            </motion.button>
          ))}
        </div>
      </motion.section>

      {/* Mouth Ulcers */}
      <motion.section variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-3">Mouth Ulcers</h2>
        <div className="flex gap-2">
          <motion.button onClick={() => mark(setUlcerClear)(true)} whileTap={{ scale: 0.96 }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${ulcerClear ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'}`}
          >✅ All clear</motion.button>
          <motion.button onClick={() => mark(setUlcerClear)(false)} whileTap={{ scale: 0.96 }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${!ulcerClear ? 'text-white' : 'bg-gray-100 text-gray-500'}`}
            style={{ backgroundColor: !ulcerClear ? '#f83f35' : '' }}
          >😣 Ulcers present</motion.button>
        </div>

        <AnimatePresence>
          {!ulcerClear && (
            <motion.div
              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Number of ulcers</label>
                  <input type="number" min={1} max={20} value={ulcerCount}
                    onChange={e => mark(setUlcerCount)(parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Pain level</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <motion.button key={n} onClick={() => mark(setUlcerPain)(n)} whileTap={{ scale: 0.92 }}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${ulcerPain === n ? 'text-white' : 'bg-gray-100 text-gray-600'}`}
                        style={{ backgroundColor: ulcerPain === n ? '#f83f35' : '' }}
                      >{n}</motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Food log */}
      <motion.section variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-2">Food Log</h2>
        <textarea value={foodRaw}
          onChange={e => mark(setFoodRaw)(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          placeholder="Porridge, large coffee with milk, chicken fillet roll, two Kit Kats…"
        />
        {foodParsed.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-3 space-y-1.5">
            {foodParsed.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm py-1 border-b border-gray-50 last:border-0">
                <span className="text-gray-700">
                  {item.ulcer_risk && <span title="Possible ulcer trigger" className="mr-1">⚠️</span>}
                  {item.name}
                </span>
                <span className={`font-medium ${item.calories ? 'text-gray-600' : 'text-gray-300'}`}>
                  {item.calories ? `${item.calories} kcal` : '(unrecognised)'}
                </span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-sm pt-1">
              <span className="text-gray-800">Total</span>
              <span className="text-teal-600">{totalCalories(foodParsed)} kcal</span>
            </div>
            <CalorieBar calories={totalCalories(foodParsed)} />
          </motion.div>
        )}
      </motion.section>

      {/* Notes */}
      <motion.section variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-2">Notes</h2>
        <textarea value={notes}
          onChange={e => mark(setNotes)(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          placeholder="Anything else worth noting…"
        />
      </motion.section>

      {saveStatus === 'error' && (
        <p className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center">
          ⚠️ Could not save: {saveError}
        </p>
      )}

    </div>
  )
}
