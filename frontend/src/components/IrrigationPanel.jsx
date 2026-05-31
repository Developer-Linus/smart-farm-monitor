import { memo } from 'react'

const SOIL_LOW = 30

const IrrigationPanel = memo(function IrrigationPanel({ irrigationOn, irrigationAuto, onToggle }) {
  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="text-base font-semibold text-green-700 mb-4">Irrigation Control</h2>
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 cursor-pointer select-none font-semibold text-sm">
          <div
            className={`relative w-11 h-6 rounded-full transition-colors ${irrigationAuto ? 'bg-green-400' : 'bg-slate-300'}`}
            onClick={() => onToggle({ auto: !irrigationAuto })}
          >
            <span
              className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${irrigationAuto ? 'left-6' : 'left-1'}`}
            />
          </div>
          Auto Mode
        </label>
        <button
          className="px-4 py-2 rounded-lg bg-blue-700 text-white font-semibold text-sm hover:opacity-85"
          onClick={() => onToggle({ on: true, auto: false })}
        >
          Turn ON
        </button>
        <button
          className="px-4 py-2 rounded-lg bg-slate-500 text-white font-semibold text-sm hover:opacity-85"
          onClick={() => onToggle({ on: false, auto: false })}
        >
          Turn OFF
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        {irrigationAuto
          ? `Auto mode: irrigation activates when soil moisture < ${SOIL_LOW}%`
          : 'Manual mode: use buttons to control irrigation'}
      </p>
    </section>
  )
})

export default IrrigationPanel
