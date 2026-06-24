import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../supabase'
import { parseFood, totalCalories } from '../utils/foodParser'

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

const staggerContainer = {
  animate: { transition: { staggerChildren: 0.06 } }
}
const staggerItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
}

export default function Today() {
  const [habits, setHabits] = useState([])
  const [checked, setChecked] = useState([])
  const [mood, setMood] = useState(null)
  const [ulcerClear, setUlcerClear] = useState(true)
  const [ulcerCount, setUlcerCount] = useState(1)
  const [ulcerPain, setUlcerPain] = useState(null)
  const [foodRaw, setFoodRaw] = useState('')
  const [foodParsed, setFoodParsed] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logId, setLogId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const today = new Date().toISOString().split('T')[0]
  const pct = habits.length ? Math.round((checked.length / habits.length) * 100) : 0

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Load habits
      const { data: habitData } = await supabase
        .from('habits')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_deleted', false)
        .order('sort_order')

      const habitList = habitData?.length
        ? habitData
        : DEFAULT_HABITS.map((name, i) => ({ id: `default-${i}`, name, sort_order: i }))
      setHabits(habitList)

      // Load today's log
      const { data: log } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('user_id', user.id)
        .eq('log_date', today)
        .single()

      if (log) {
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
        // Pre-populate ulcer from yesterday
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
        const { data: yest } = await supabase
          .from('daily_logs')
          .select('ulcer_clear, ulcer_count, ulcer_pain')
          .eq('user_id', user.id)
          .eq('log_date', yesterday)
          .single()
        if (yest && !yest.ulcer_clear) {
          setUlcerClear(false)
          setUlcerCount(yest.ulcer_count ?? 1)
          setUlcerPain(yest.ulcer_pain ?? null)
        }
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  function toggleHabit(id) {
    setChecked(prev =>
      prev.includes(id) ? prev.filter(h => h !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    if (!mood) { setError('Please select a mood before saving.'); return }
    setError('')
    setSaving(true)

    const { data: { user } } = await supabase.auth.getUser()
    const parsed = parseFood(foodRaw)
    const cal = totalCalories(parsed)

    const payload = {
      user_id: user.id,
      log_date: today,
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

    let err
    if (logId) {
      const res = await supabase.from('daily_logs').update(payload).eq('id', logId)
      err = res.error
    } else {
      const res = await supabase.from('daily_logs').insert(payload).select().single()
      err = res.error
      if (res.data) setLogId(res.data.id)
    }

    if (err) { setError(err.message); setSaving(false); return }

    setFoodParsed(parsed)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
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
      {/* Header */}
      <motion.div variants={staggerItem} initial="initial" animate="animate">
        <h1 className="text-2xl font-bold text-gray-900">Today</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          {new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </motion.div>

      {/* Habits */}
      <motion.section
        variants={staggerContainer}
        initial="initial"
        animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <motion.div variants={staggerItem} className="mb-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="font-bold text-gray-800">Habits</h2>
            <span className="text-sm font-semibold text-teal-600">{checked.length} / {habits.length} · {pct}%</span>
          </div>
          {/* Progress bar */}
          <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${pct >= 70 ? 'bg-teal-500' : 'bg-amber-400'}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
            {/* 70% marker */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50" style={{ left: '70%' }} />
          </div>
          <div className="text-xs text-gray-400 mt-1 text-right">Goal: 70%</div>
        </motion.div>

        {habits.map(habit => {
          const isChecked = checked.includes(habit.id)
          return (
            <motion.button
              key={habit.id}
              variants={staggerItem}
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
                  <motion.svg
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    className="w-3.5 h-3.5 text-white"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}
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
      <motion.section
        variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-4">Mood</h2>
        <div className="flex justify-between">
          {MOODS.map(m => (
            <motion.button
              key={m.value}
              onClick={() => setMood(m.value)}
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
      <motion.section
        variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-3">Mouth Ulcers</h2>
        <div className="flex gap-2">
          <motion.button
            onClick={() => setUlcerClear(true)}
            whileTap={{ scale: 0.96 }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              ulcerClear ? 'bg-teal-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            ✅ All clear
          </motion.button>
          <motion.button
            onClick={() => setUlcerClear(false)}
            whileTap={{ scale: 0.96 }}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              !ulcerClear ? 'bg-coral-500 text-white' : 'bg-gray-100 text-gray-500'
            }`}
            style={{ backgroundColor: !ulcerClear ? '#f83f35' : '' }}
          >
            😣 Ulcers present
          </motion.button>
        </div>

        <AnimatePresence>
          {!ulcerClear && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-1 block">Number of ulcers</label>
                  <input
                    type="number" min={1} max={20}
                    value={ulcerCount}
                    onChange={e => setUlcerCount(parseInt(e.target.value) || 1)}
                    className="w-24 px-3 py-2 rounded-xl border border-gray-200 text-sm text-center focus:outline-none focus:ring-2 focus:ring-teal-400"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 mb-2 block">Pain level</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <motion.button
                        key={n}
                        onClick={() => setUlcerPain(n)}
                        whileTap={{ scale: 0.92 }}
                        className={`w-10 h-10 rounded-xl text-sm font-bold transition-colors ${
                          ulcerPain === n ? 'bg-coral-500 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                        style={{ backgroundColor: ulcerPain === n ? '#f83f35' : '' }}
                      >
                        {n}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.section>

      {/* Food log */}
      <motion.section
        variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-2">Food Log</h2>
        <textarea
          value={foodRaw}
          onChange={e => setFoodRaw(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          placeholder="Porridge, large coffee with milk, chicken fillet roll, two Kit Kats…"
        />

        {foodParsed.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 space-y-1.5"
          >
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
          </motion.div>
        )}
      </motion.section>

      {/* Notes */}
      <motion.section
        variants={staggerItem} initial="initial" animate="animate"
        className="bg-white rounded-2xl shadow-sm p-5"
      >
        <h2 className="font-bold text-gray-800 mb-2">Notes</h2>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
          placeholder="Anything else worth noting…"
        />
      </motion.section>

      {/* Error */}
      {error && (
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="text-red-600 text-sm bg-red-50 rounded-xl px-4 py-3"
        >
          {error}
        </motion.p>
      )}

      {/* Save button */}
      <motion.button
        variants={staggerItem} initial="initial" animate="animate"
        onClick={handleSave}
        disabled={saving || saved}
        whileTap={{ scale: 0.97 }}
        animate={saving ? { scale: [1, 0.98, 1] } : {}}
        transition={{ repeat: saving ? Infinity : 0, duration: 0.8 }}
        className={`w-full py-4 rounded-2xl font-bold text-lg transition-colors shadow-sm ${
          saved ? 'bg-teal-500 text-white' : 'bg-teal-500 hover:bg-teal-600 text-white'
        } disabled:opacity-70`}
      >
        <AnimatePresence mode="wait">
          {saved ? (
            <motion.span key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
              ✓ Saved!
            </motion.span>
          ) : saving ? (
            <motion.span key="saving" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Saving…
            </motion.span>
          ) : (
            <motion.span key="save" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              Save day
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
