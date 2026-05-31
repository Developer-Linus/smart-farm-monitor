import { memo } from 'react'
import { CheckCircle, AlertTriangle, Bell } from 'lucide-react'

const AlertsPanel = memo(function AlertsPanel({ alerts }) {
  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="text-base font-semibold text-green-700 mb-3 flex items-center gap-2">
        <Bell size={17} /> Alerts
      </h2>
      <ul className="flex flex-col gap-2">
        {alerts.length === 0 ? (
          <li className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 border-l-4 border-green-400 text-sm text-slate-500">
            <CheckCircle size={15} className="text-green-500 shrink-0" /> All systems normal
          </li>
        ) : (
          alerts.map((alert, i) => (
            <li
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-50 border-l-4 border-yellow-400 text-sm"
            >
              <AlertTriangle size={15} className="text-yellow-500 shrink-0" />
              {alert}
            </li>
          ))
        )}
      </ul>
    </section>
  )
})

export default AlertsPanel
