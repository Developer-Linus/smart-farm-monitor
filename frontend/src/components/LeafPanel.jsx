import { memo } from 'react'
import { Leaf, CheckCircle, AlertTriangle } from 'lucide-react'

const DISEASE_ADVICE = {
  'Tomato Early Blight':           'Apply fungicide (chlorothalonil or mancozeb). Remove lower infected leaves.',
  'Tomato Healthy':                'Your tomato plants look healthy! Keep up the good work.',
  'Tomato Leaf Late Blight':       'Apply fungicide immediately. Remove and destroy infected plants. Improve air circulation.',
  'Tomato Leaf Yellow Curl Virus': 'Control whiteflies. Remove infected plants. Use resistant varieties.',
  'Tomato Mold Leaf':              'Improve ventilation. Apply fungicide. Reduce humidity in greenhouse.',
  'Tomato Septora Leaf Spot':      'Apply fungicide. Remove infected leaves. Avoid wetting foliage.',
}

const LeafPanel = memo(function LeafPanel({ leafResult, leafImageB64 }) {
  const advice = leafResult ? DISEASE_ADVICE[leafResult.disease] : null

  const scores = leafResult?.all_scores
    ? Object.entries(leafResult.all_scores).sort((a, b) => b[1] - a[1])
    : []

  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="text-base font-semibold text-green-700 mb-4 flex items-center gap-2">
        <Leaf size={17} /> Tomato Leaf Health
      </h2>
      <div className="flex flex-wrap gap-6 items-start">
        <div className="text-center shrink-0">
          <img
            src={leafImageB64 ? `data:image/jpeg;base64,${leafImageB64}` : '/placeholder_leaf.png'}
            alt="Latest leaf"
            className="w-52 h-52 object-cover rounded-xl border-2 border-green-200 bg-green-50"
          />
          <p className="text-xs text-slate-400 mt-1">Latest image from ESP32-CAM</p>
        </div>
        <div className="flex-1 min-w-48">
          {leafResult ? (
            <>
              <span
                className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm mb-2 ${
                  leafResult.healthy
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {leafResult.healthy
                  ? <CheckCircle size={14} />
                  : <AlertTriangle size={14} />}
                {leafResult.disease}
              </span>
              <p className="text-sm text-slate-500 mb-2">Confidence: {leafResult.confidence}%</p>
              {advice && (
                <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg px-3 py-2 text-sm mb-3">
                  {advice}
                </div>
              )}
              {scores.length > 0 && (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr>
                      <th className="text-left py-1 px-1 text-slate-400 font-semibold">Condition</th>
                      <th className="text-left py-1 px-1 text-slate-400 font-semibold">Score</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map(([name, score]) => (
                      <tr key={name} className="border-b border-slate-100">
                        <td className="py-1 px-1">{name.replace(/_/g, ' ')}</td>
                        <td className="py-1 px-1">{score}%</td>
                        <td className="py-1 px-1">
                          <span
                            className="inline-block h-2 bg-green-400 rounded"
                            style={{ width: Math.max(score, 1) }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-400 mt-4">Awaiting image from ESP32-CAM…</p>
          )}
        </div>
      </div>
    </section>
  )
})

export default LeafPanel
