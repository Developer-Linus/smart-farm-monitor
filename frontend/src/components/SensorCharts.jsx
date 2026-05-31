import { memo, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'

function fmtTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const SensorCharts = memo(function SensorCharts({ history }) {
  const data = useMemo(
    () => history.map(r => ({
      time: fmtTime(r.timestamp),
      temp: r.temperature,
      hum: r.humidity,
      soil: r.soil_moisture,
    })),
    [history]
  )

  if (!data.length) {
    return (
      <section className="bg-white rounded-xl shadow p-5">
        <h2 className="text-base font-semibold text-green-700 mb-3">Sensor History</h2>
        <p className="text-sm text-slate-400 text-center py-8">Waiting for data…</p>
      </section>
    )
  }

  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="text-base font-semibold text-green-700 mb-4">Sensor History</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={30} />
              <YAxis yAxisId="t" domain={['auto', 'auto']} tick={{ fontSize: 11 }} unit="°C" />
              <YAxis yAxisId="h" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Legend />
              <Line yAxisId="t" type="monotone" dataKey="temp" name="Temp (°C)" stroke="#e53935" dot={false} strokeWidth={2} />
              <Line yAxisId="h" type="monotone" dataKey="hum" name="Humidity (%)" stroke="#1e88e5" dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="time" tick={{ fontSize: 11 }} minTickGap={30} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="soil" name="Soil Moisture (%)" stroke="#43a047" dot={false} strokeWidth={2} fill="rgba(67,160,71,.1)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  )
})

export default SensorCharts
