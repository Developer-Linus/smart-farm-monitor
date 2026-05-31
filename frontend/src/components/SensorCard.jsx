import { memo } from 'react'

const levelStyles = {
  good:   'border-t-green-400',
  alert:  'border-t-orange-400',
  danger: 'border-t-red-500',
  on:     'border-t-blue-400',
  off:    'border-t-slate-400',
  '':     'border-t-green-400',
}

const SensorCard = memo(function SensorCard({ icon, label, value, unit, status, level = '' }) {
  return (
    <div className={`bg-white rounded-xl shadow p-5 text-center border-t-4 transition-transform hover:-translate-y-1 ${levelStyles[level] ?? 'border-t-green-400'}`}>
      <div className="flex justify-center text-slate-600">{icon}</div>
      <div className="text-xs text-slate-500 uppercase tracking-wider mt-1">{label}</div>
      <div className="text-4xl font-bold leading-none mt-2">
        {value !== null && value !== undefined ? value : '--'}
      </div>
      <div className="text-sm text-slate-400">{unit}</div>
      {status && <div className="text-xs font-medium mt-1 text-slate-600">{status}</div>}
    </div>
  )
})

export default SensorCard
