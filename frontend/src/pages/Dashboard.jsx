import { lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { Thermometer, Droplets, Sprout, ShowerHead, Leaf, LogOut, Home } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useFarmData } from '../hooks/useFarmData'
import SensorCard from '../components/SensorCard'
import IrrigationPanel from '../components/IrrigationPanel'
import AlertsPanel from '../components/AlertsPanel'

// Lazy-load heavy components to keep initial bundle small
const SensorCharts = lazy(() => import('../components/SensorCharts'))
const LeafPanel = lazy(() => import('../components/LeafPanel'))
const AgrovetFinder = lazy(() => import('../components/AgrovetFinder'))

const SOIL_LOW  = 30
const SOIL_HIGH = 60
const TEMP_HIGH = 35
const HUM_LOW   = 40

function fmtTime(iso) {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function tempLevel(t)  { return t == null ? '' : t > TEMP_HIGH ? 'danger' : 'good' }
function humLevel(h)   { return h == null ? '' : h < HUM_LOW   ? 'alert'  : 'good' }
function soilLevel(s)  {
  if (s == null) return ''
  if (s < SOIL_LOW)  return 'danger'
  if (s < SOIL_HIGH) return 'alert'
  return 'good'
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const { status, history, online, toggleIrrigation } = useFarmData()

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } finally {
      setUser(null)                  // clear context so ProtectedRoute blocks immediately
      navigate('/', { replace: true })
    }
  }

  const { temperature: temp, humidity: hum, soil_moisture: soil,
          irrigation_on, irrigation_auto, last_updated, leaf_result, leaf_image_b64, alerts } = status

  return (
    <div className="min-h-screen bg-green-50 flex flex-col">
      <header className="bg-green-700 text-white px-6 h-14 flex items-center gap-3 shadow sticky top-0 z-10">
        <Leaf size={20} className="shrink-0" />
        <span className="font-bold text-lg flex-1">Smart Farm Monitor</span>
        <a
          href="/"
          className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-medium"
        >
          <Home size={13} />
          Home
        </a>
        <span className="text-xs opacity-80">Last update: {fmtTime(last_updated)}</span>
        <span
          title="Connection status"
          className={`w-3 h-3 rounded-full shrink-0 ${online ? 'bg-green-300 shadow-[0_0_6px_#86efac]' : 'bg-red-300'}`}
        />
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg font-medium"
        >
          <LogOut size={13} />
          Sign out
        </button>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-6 flex flex-col gap-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <SensorCard
            icon={<Thermometer size={26} />} label="Temperature"
            value={temp != null ? temp.toFixed(1) : null} unit="°C"
            status={temp != null ? (temp > TEMP_HIGH ? 'Too hot!' : 'Normal') : ''}
            level={tempLevel(temp)}
          />
          <SensorCard
            icon={<Droplets size={26} />} label="Humidity"
            value={hum != null ? hum.toFixed(1) : null} unit="%"
            status={hum != null ? (hum < HUM_LOW ? 'Low humidity' : 'Normal') : ''}
            level={humLevel(hum)}
          />
          <SensorCard
            icon={<Sprout size={26} />} label="Soil Moisture"
            value={soil != null ? soil.toFixed(0) : null} unit="%"
            status={soil != null ? (soil < SOIL_LOW ? 'Needs water!' : soil < SOIL_HIGH ? 'Moderate' : 'Sufficient') : ''}
            level={soilLevel(soil)}
          />
          <SensorCard
            icon={<ShowerHead size={26} />} label="Irrigation"
            value={irrigation_on ? 'ON' : 'OFF'} unit=""
            status={irrigation_auto ? 'Auto mode' : 'Manual mode'}
            level={irrigation_on ? 'on' : 'off'}
          />
        </div>

        <IrrigationPanel
          irrigationOn={irrigation_on}
          irrigationAuto={irrigation_auto}
          onToggle={toggleIrrigation}
        />

        <AlertsPanel alerts={alerts} />

        <Suspense fallback={<div className="bg-white rounded-xl shadow p-5 text-sm text-slate-400">Loading charts…</div>}>
          <SensorCharts history={history} />
        </Suspense>

        <Suspense fallback={<div className="bg-white rounded-xl shadow p-5 text-sm text-slate-400">Loading leaf panel…</div>}>
          <LeafPanel leafResult={leaf_result} leafImageB64={leaf_image_b64} />
        </Suspense>

        <Suspense fallback={<div className="bg-white rounded-xl shadow p-5 text-sm text-slate-400">Loading map…</div>}>
          <AgrovetFinder />
        </Suspense>
      </main>

      <footer className="text-center py-3 text-xs text-slate-400 bg-white border-t border-slate-100">
        Smart Farm Monitor &copy; 2025 &nbsp;|&nbsp; Powered by ESP32 &amp; AI
      </footer>
    </div>
  )
}
