import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const navItems = [
  { path: '/today', label: 'Today', icon: '📋' },
  { path: '/history', label: 'History', icon: '📅' },
  { path: '/analysis', label: 'Analysis', icon: '📊' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
]

const pageVariants = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -20 },
}

export default function Layout({ children }) {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 bg-white border-r border-gray-100 shadow-sm py-8 px-4 gap-1 shrink-0">
        <div className="mb-6 px-3">
          <div className="text-2xl font-bold text-teal-600">💪 Health</div>
          <div className="text-xs text-gray-400 font-medium mt-0.5">Kevin's Tracker</div>
        </div>
        {navItems.map(item => {
          const active = location.pathname === item.path
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all ${
                active
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
              {active && (
                <motion.div
                  layoutId="sidebar-indicator"
                  className="ml-auto w-1.5 h-5 bg-teal-500 rounded-full"
                />
              )}
            </button>
          )
        })}
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-20 md:pb-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile bottom nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-50">
          <div className="flex">
            {navItems.map(item => {
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  className={`flex-1 flex flex-col items-center py-2 pt-3 gap-0.5 min-touch transition-colors ${
                    active ? 'text-teal-600' : 'text-gray-400'
                  }`}
                >
                  <span className="text-xl leading-none">{item.icon}</span>
                  <span className="text-xs font-medium">{item.label}</span>
                  {active && (
                    <motion.div
                      layoutId="bottom-indicator"
                      className="absolute top-0 h-0.5 w-8 bg-teal-500 rounded-full"
                    />
                  )}
                </button>
              )
            })}
          </div>
        </nav>
      </div>
    </div>
  )
}
