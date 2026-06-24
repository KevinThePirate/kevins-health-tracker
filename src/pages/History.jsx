import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../supabase'

const MOODS = { 5: '😄', 4: '😰', 3: '😐', 2: '😔', 1: '😞' }

function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year, month) {
  return new Date(year, month, 1).getDay()
}

export default function History() {
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [logs, setLogs] = useState({})
  const [habits, setHabits] = useState({})
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadMonth() }, [year, month])

  async function loadMonth() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const from = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const to = `${year}-${String(month + 1).padStart(2, '0')}-${getDaysInMonth(year, month)}`

    const { data } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', user.id)
      .gte('log_date', from)
      .lte('log_date', to)

    const { data: habitData } = await supabase
      .from('habits')
      .select('id, name')
      .eq('user_id', user.id)

    const habitMap = {}
    habitData?.forEach(h => { habitMap[h.id] = h.name })
    setHabits(habitMap)

    const map = {}
    data?.forEach(log => { map[log.log_date] = log })
    setLogs(map)
    setLoading(false)
  }

  function dotColor(log) {
    if (!log) return null
    const totalHabits = Object.keys(habits).length || 17
    const pct = log.habit_ids?.length ? (log.habit_ids.length / totalHabits) * 100 : 0
    if (pct >= 70) return 'bg-teal-500'
    if (pct > 0) return 'bg-amber-400'
    return 'bg-gray-300'
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const days = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month) // 0=Sunday
  const blanks = (firstDay + 6) % 7 // adjust to Monday start

  const monthName = new Date(year, month, 1).toLocaleString('en-IE', { month: 'long', year: 'numeric' })

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">History</h1>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 font-bold text-lg">‹</button>
        <span className="font-semibold text-gray-800">{monthName}</span>
        <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-100 text-gray-600 font-bold text-lg">›</button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
          <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: blanks }).map((_, i) => <div key={`b${i}`} />)}
        {Array.from({ length: days }).map((_, i) => {
          const day = i + 1
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
          const log = logs[dateStr]
          const color = dotColor(log)
          const isToday = dateStr === new Date().toISOString().split('T')[0]

          return (
            <motion.button
              key={day}
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                if (log) setSelected(log)
                else navigate(`/today?date=${dateStr}`)
              }}
              className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 transition-colors hover:bg-gray-50 cursor-pointer ${isToday ? 'ring-2 ring-teal-400' : ''}`}
            >
              <span className={`text-sm font-medium ${isToday ? 'text-teal-600' : 'text-gray-700'}`}>{day}</span>
              {color && <div className={`w-2 h-2 rounded-full ${color}`} />}
            </motion.button>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mt-4 justify-center text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-teal-500 inline-block" /> ≥70%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> &lt;70%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> Minimal</span>
      </div>

      {/* Day detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) setSelected(null) }}
          >
            <motion.div
              initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white rounded-3xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-bold text-xl text-gray-900">
                    {new Date(selected.log_date + 'T12:00:00').toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/today?date=${selected.log_date}`)}
                    className="px-3 py-1.5 bg-teal-50 text-teal-700 text-sm font-semibold rounded-xl hover:bg-teal-100 transition-colors"
                  >✏️ Edit</button>
                  <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Mood</div>
                  <span className="text-2xl">{MOODS[selected.mood] || '—'}</span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Habits</div>
                  <div className="text-sm text-gray-700">
                    {selected.habit_ids?.length
                      ? selected.habit_ids.map(id => habits[id] || id).join(', ')
                      : 'None logged'}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Ulcers</div>
                  <div className="text-sm text-gray-700">
                    {selected.ulcer_clear
                      ? '✅ All clear'
                      : `😣 ${selected.ulcer_count || '?'} ulcer(s), pain ${selected.ulcer_pain || '?'}/5`}
                  </div>
                </div>

                {selected.food_raw && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Food</div>
                    <div className="text-sm text-gray-700">{selected.food_raw}</div>
                    {selected.total_calories && (
                      <div className="text-xs text-teal-600 font-medium mt-1">{selected.total_calories} kcal estimated</div>
                    )}
                  </div>
                )}

                {selected.notes && (
                  <div>
                    <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Notes</div>
                    <div className="text-sm text-gray-700">{selected.notes}</div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
