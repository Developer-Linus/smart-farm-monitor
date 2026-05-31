import { useState, useEffect, useRef } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  Leaf, Activity, ScanSearch, Droplets, Thermometer,
  Sprout, BarChart3, Bell, MapPin, Cpu, Zap, ArrowRight,
  ChevronRight, Menu, X, Shield,
} from 'lucide-react'

// ---- static data ---------------------------------------------------------

const NAV_LINKS = [
  { label: 'Features',    href: '#features' },
  { label: 'How It Works', href: '#how'      },
  { label: 'About',       href: '#about'    },
]

const FEATURES = [
  { Icon: Activity,  title: 'Real-time Sensor Feeds',   desc: 'Temperature, humidity and soil moisture stream live from your ESP32 every 3 seconds.' },
  { Icon: ScanSearch,title: 'AI Disease Detection',     desc: 'MobileNetV2 scans leaf images from the ESP32-CAM and identifies 6 tomato conditions.' },
  { Icon: Droplets,  title: 'Automated Irrigation',     desc: 'The pump activates automatically when soil moisture drops below your configured threshold.' },
  { Icon: BarChart3, title: 'Sensor History Charts',    desc: 'Visualise temperature, humidity and soil trends over time with interactive graphs.' },
  { Icon: Bell,      title: 'Smart Alerts',             desc: 'Instant dashboard alerts when temperature spikes, humidity drops, or soil gets too dry.' },
  { Icon: MapPin,    title: 'Agrovet Finder',           desc: 'Locate the nearest agricultural supply stores using OpenStreetMap and your GPS position.' },
]

const STEPS = [
  { Icon: Cpu,       number: '01', title: 'Connect your ESP32',         desc: 'Flash the Arduino sketch to your ESP32-CAM. It connects to WiFi and starts posting sensor data immediately.' },
  { Icon: ScanSearch,number: '02', title: 'AI analyses your farm',      desc: 'The Flask backend runs TFLite inference on every leaf image and checks sensor readings against your thresholds.' },
  { Icon: Zap,       number: '03', title: 'Act on actionable insights', desc: 'Your dashboard surfaces alerts, controls the irrigation pump, and logs a full history for informed decisions.' },
]

const STATS = [
  { value: '6',     label: 'Disease types detected'  },
  { value: '3s',    label: 'Sensor update interval'  },
  { value: '200+',  label: 'History records kept'    },
  { value: '25 km', label: 'Agrovet search radius'   },
]

const TECH_TAGS = ['ESP32-CAM', 'TensorFlow Lite', 'Flask', 'React', 'PlantVillage']

const LIVE_ROWS = [
  { Icon: Thermometer, label: 'Temperature', value: '24.3 C',  color: '#fbbf24' },
  { Icon: Droplets,    label: 'Humidity',    value: '68%',     color: '#60a5fa' },
  { Icon: Sprout,      label: 'Soil',        value: '52%',     color: '#4ade80' },
  { Icon: Activity,    label: 'Irrigation',  value: 'AUTO',    color: '#a78bfa' },
]

// ---- scroll-reveal hook --------------------------------------------------

function useInView() {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    const show = () => setInView(true)
    // Fire as soon as any pixel enters the viewport
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { show(); obs.disconnect() } },
      { threshold: 0 }
    )
    if (el) obs.observe(el)
    // Fallback: reveal after 1.5s in case the observer never fires
    const t = setTimeout(show, 1500)
    return () => { obs.disconnect(); clearTimeout(t) }
  }, [])
  return [ref, inView]
}

// ---- auth modal ----------------------------------------------------------

function AuthModal({ onClose }) {
  const { setUser } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode]       = useState('login')
  const [form, setForm]       = useState({ name: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const url  = mode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = mode === 'login'
        ? { email: form.email, password: form.password }
        : { name: form.name, email: form.email, password: form.password }
      const res  = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); return }
      setUser({ name: data.name })   // update context — ProtectedRoute now lets through
      navigate('/dashboard', { replace: true })
    } catch {
      setError('Network error. Is the server running?')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(6,15,9,0.8)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 22, padding: '40px 36px',
        width: '100%', maxWidth: 420,
        boxShadow: '0 28px 80px rgba(0,0,0,0.35)',
        animation: 'modal-pop 0.28s cubic-bezier(.22,.68,0,1.2) both',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <h2 style={{ fontFamily: SF, fontSize: 26, fontWeight: 700, color: '#0a1f10', marginBottom: 4 }}>
              {mode === 'login' ? 'Welcome back' : 'Get started'}
            </h2>
            <p style={{ color: '#6b7280', fontSize: 14 }}>
              {mode === 'login' ? 'Sign in to your farm dashboard' : 'Create your free account'}
            </p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 2 }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {mode === 'register' && (
            <div>
              <label style={LBL}>Full name</label>
              <input className="lp-input" type="text" placeholder="Jane Farmer" value={form.name} onChange={set('name')} required />
            </div>
          )}
          <div>
            <label style={LBL}>Email address</label>
            <input className="lp-input" type="email" placeholder="you@farm.com" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label style={LBL}>Password</label>
            <input className="lp-input" type="password"
              placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'}
              value={form.password} onChange={set('password')} required minLength={8} />
          </div>
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: 13 }}>
              {error}
            </div>
          )}
          <button type="submit" className="lp-btn-primary" disabled={loading} style={{ marginTop: 4 }}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
            {!loading && <ChevronRight size={15} />}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: 13, color: '#6b7280', marginTop: 20 }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError('') }}
            style={{ background: 'none', border: 'none', color: '#15803d', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            {mode === 'login' ? 'Register' : 'Sign In'}
          </button>
        </p>
      </div>
    </div>
  )
}

// ---- shared style shorthands ---------------------------------------------

const SF  = "'Playfair Display', Georgia, serif"
const BD  = "'Outfit', system-ui, sans-serif"
const LBL = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6, fontFamily: BD }

// ---- pill badge ----------------------------------------------------------

function Pill({ icon: Icon, children, dark }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7,
      background: dark ? 'rgba(34,197,94,0.12)' : '#f0fdf4',
      border: `1px solid ${dark ? 'rgba(34,197,94,0.28)' : '#bbf7d0'}`,
      borderRadius: 100, padding: '5px 14px', marginBottom: 18,
    }}>
      {Icon && <Icon size={12} color={dark ? '#4ade80' : '#16a34a'} />}
      <span style={{ color: dark ? '#86efac' : '#15803d', fontSize: 12, fontWeight: 600, letterSpacing: '0.09em' }}>
        {children}
      </span>
    </div>
  )
}

// ---- main component ------------------------------------------------------

export default function SignIn() {
  const { user } = useAuth()
  const [modal, setModal] = useState(false)
  const [menu,  setMenu]  = useState(false)
  const [solid, setSolid] = useState(false)
  const videoRef = useRef(null)

  // All hooks must be called before any conditional returns (Rules of Hooks)
  useEffect(() => {
    const fn = () => setSolid(window.scrollY > 48)
    window.addEventListener('scroll', fn, { passive: true })
    return () => window.removeEventListener('scroll', fn)
  }, [])

  useEffect(() => {
    const fn = () => { if (window.innerWidth >= 768) setMenu(false) }
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])

  const [featRef, featIn] = useInView()
  const [howRef,  howIn]  = useInView()
  const [statRef, statIn] = useInView()
  const [abtRef,  abtIn]  = useInView()

  if (user === undefined) return null
  const authed = !!user

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;1,600&family=Outfit:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Outfit', system-ui, sans-serif; background: #faf8f2; }

        @keyframes lp-up    { from { opacity:0; transform:translateY(22px) } to { opacity:1; transform:translateY(0) } }
        @keyframes dot-ring { 0% { transform:scale(1); opacity:.7 } 100% { transform:scale(2.4); opacity:0 } }
        @keyframes modal-pop { from { opacity:0; transform:scale(.94) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }

        /* Firefly float */
        @keyframes fly-a { 0%,100%{transform:translate(0,0) scale(1);opacity:.7} 40%{transform:translate(14px,-40px) scale(1.3);opacity:1} 70%{transform:translate(-8px,-70px) scale(.8);opacity:.5} }
        @keyframes fly-b { 0%,100%{transform:translate(0,0);opacity:.5} 33%{transform:translate(-18px,-35px);opacity:.9} 66%{transform:translate(10px,-65px);opacity:.4} }
        @keyframes fly-c { 0%,100%{transform:translate(0,0) scale(1);opacity:.6} 50%{transform:translate(20px,-55px) scale(1.4);opacity:1} }

        .h1 { animation: lp-up .75s .08s both ease }
        .h2 { animation: lp-up .75s .2s  both ease }
        .h3 { animation: lp-up .75s .32s both ease }
        .h4 { animation: lp-up .75s .44s both ease }

        .rv { opacity:0; transform:translateY(18px); transition:opacity .55s ease, transform .55s ease }
        .rv.on { opacity:1; transform:translateY(0) }
        .d1 { transition-delay:.04s } .d2 { transition-delay:.10s } .d3 { transition-delay:.16s }
        .d4 { transition-delay:.22s } .d5 { transition-delay:.28s } .d6 { transition-delay:.34s }

        .lp-input {
          width:100%; padding:12px 16px;
          border:1.5px solid #e2e8f0; border-radius:10px;
          font-family:'Outfit',sans-serif; font-size:14px; color:#111827;
          background:#f8fafc; outline:none;
          transition:border-color .2s, box-shadow .2s, background .2s;
        }
        .lp-input:focus { border-color:#16a34a; background:#fff; box-shadow:0 0 0 3px rgba(22,163,74,.12) }
        .lp-input::placeholder { color:#9ca3af }

        .lp-btn-primary {
          display:inline-flex; align-items:center; justify-content:center; gap:6px;
          width:100%; padding:13px 24px;
          background:#15803d; color:#fff; border:none; border-radius:10px;
          font-family:'Outfit',sans-serif; font-size:15px; font-weight:600; cursor:pointer;
          box-shadow:0 4px 18px rgba(21,128,61,.35);
          transition:background .2s, transform .15s, box-shadow .2s;
        }
        .lp-btn-primary:hover:not(:disabled) { background:#166534; transform:translateY(-2px); box-shadow:0 8px 24px rgba(21,128,61,.45) }
        .lp-btn-primary:disabled { opacity:.6; cursor:not-allowed }

        .hero-cta {
          display:inline-flex; align-items:center; gap:8px;
          padding:15px 32px; background:#22c55e; color:#0a1f10;
          border:none; border-radius:12px;
          font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; cursor:pointer;
          box-shadow:0 6px 24px rgba(34,197,94,.45);
          transition:background .2s, transform .15s, box-shadow .2s;
        }
        .hero-cta:hover { background:#16a34a; color:#fff; transform:translateY(-3px); box-shadow:0 10px 32px rgba(34,197,94,.5) }

        .ghost-cta {
          display:inline-flex; align-items:center; gap:8px;
          padding:14px 28px; background:transparent; color:#d1fae5;
          border:1.5px solid rgba(209,250,229,.3); border-radius:12px;
          font-family:'Outfit',sans-serif; font-size:16px; font-weight:500; cursor:pointer; text-decoration:none;
          transition:background .2s, border-color .2s;
        }
        .ghost-cta:hover { background:rgba(255,255,255,.08); border-color:rgba(209,250,229,.55) }

        .feat-card {
          background:#fff; border-radius:16px; padding:28px 24px;
          border:1px solid #e8f5e9;
          transition:transform .22s, box-shadow .22s, border-color .22s;
        }
        .feat-card:hover { transform:translateY(-5px); box-shadow:0 16px 48px rgba(21,128,61,.1); border-color:#bbf7d0 }

        .step-card {
          position:relative; padding:32px; background:#fff;
          border-radius:20px; border:1px solid #e8f5e9;
          transition:box-shadow .22s;
        }
        .step-card:hover { box-shadow:0 16px 48px rgba(0,0,0,.07) }

        .nav-a {
          font-family:'Outfit',sans-serif; font-size:14px; font-weight:500;
          text-decoration:none; padding:5px 0;
          border-bottom:2px solid transparent;
          transition:color .2s, border-color .2s;
        }
        .nav-a:hover { border-color:#22c55e }

        @media (max-width:767px) { .lg-only { display:none !important } }
        @media (min-width:768px) { .sm-only { display:none !important } }
      `}</style>

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: solid ? 'rgba(255,255,255,0.96)' : 'transparent',
        backdropFilter: solid ? 'blur(14px)' : 'none',
        boxShadow: solid ? '0 1px 20px rgba(0,0,0,.07)' : 'none',
        transition: 'background .3s, box-shadow .3s',
      }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px', height: 68, display: 'flex', alignItems: 'center', gap: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: '0 0 auto' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#4ade80,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Leaf size={18} color="#fff" />
            </div>
            <span style={{ fontFamily: SF, fontSize: 18, fontWeight: 700, color: solid ? '#0a1f10' : '#fff' }}>
              Smart Farm
            </span>
          </div>

          <div className="lg-only" style={{ display: 'flex', gap: 28, marginLeft: 12 }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} className="nav-a" style={{ color: solid ? '#374151' : 'rgba(255,255,255,.8)' }}>
                {l.label}
              </a>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {authed ? (
            <a href="/dashboard" className="lg-only" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 9, cursor: 'pointer',
              background: solid ? '#15803d' : 'rgba(255,255,255,.14)',
              border: solid ? 'none' : '1px solid rgba(255,255,255,.28)',
              color: '#fff', fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 600,
              textDecoration: 'none', transition: 'background .2s',
            }}>
              Dashboard <ChevronRight size={14} />
            </a>
          ) : (
            <button className="lg-only" onClick={() => setModal(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 20px', borderRadius: 9, cursor: 'pointer',
              background: solid ? '#15803d' : 'rgba(255,255,255,.14)',
              border: solid ? 'none' : '1px solid rgba(255,255,255,.28)',
              color: '#fff', fontFamily: "'Outfit',sans-serif", fontSize: 14, fontWeight: 600,
              transition: 'background .2s',
            }}>
              Sign In <ChevronRight size={14} />
            </button>
          )}

          <button className="sm-only" onClick={() => setMenu(m => !m)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: solid ? '#0a1f10' : '#fff', padding: 4 }}>
            {menu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {menu && (
          <div style={{ background: '#fff', borderTop: '1px solid #e8f5e9', padding: '16px 24px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenu(false)}
                style={{ color: '#374151', fontSize: 15, fontWeight: 500, textDecoration: 'none', padding: '6px 0' }}>
                {l.label}
              </a>
            ))}
            {authed ? (
              <a href="/dashboard" style={{
                marginTop: 6, padding: '11px 20px', background: '#15803d', color: '#fff',
                borderRadius: 10, fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 600,
                textDecoration: 'none', textAlign: 'center',
              }}>
                Go to Dashboard
              </a>
            ) : (
              <button onClick={() => { setModal(true); setMenu(false) }} style={{
                marginTop: 6, padding: '11px 20px', background: '#15803d', color: '#fff',
                border: 'none', borderRadius: 10, fontFamily: "'Outfit',sans-serif", fontSize: 15, fontWeight: 600, cursor: 'pointer',
              }}>
                Sign In
              </button>
            )}
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{
        position: 'relative', overflow: 'hidden', minHeight: '100vh',
        background: '#050f08',
        display: 'flex', alignItems: 'center', paddingTop: 68,
      }}>

        {/* ---- Background video ---- */}
        <video
          ref={videoRef}
          autoPlay muted loop playsInline
          onLoadedData={() => { if (videoRef.current) videoRef.current.playbackRate = 0.5 }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        >
          <source src="/video/tomato_land_video.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay so text stays readable */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(160deg, rgba(5,15,8,.82) 0%, rgba(9,26,14,.72) 50%, rgba(7,21,8,.85) 100%)',
        }} />

        {/* Bottom vignette to ground the content */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%',
          background: 'linear-gradient(to top, rgba(5,15,8,.9) 0%, transparent 100%)',
          pointerEvents: 'none',
        }} />

        {/* ---- Firefly particles ---- */}
        {[
          { left:'12%', top:'55%', size:4, anim:'fly-a 5.2s ease-in-out infinite', color:'rgba(134,239,172,.9)' },
          { left:'24%', top:'62%', size:3, anim:'fly-b 6.8s ease-in-out 1s infinite', color:'rgba(74,222,128,.8)' },
          { left:'38%', top:'58%', size:5, anim:'fly-c 4.5s ease-in-out 0.5s infinite', color:'rgba(187,247,208,.9)' },
          { left:'55%', top:'65%', size:3, anim:'fly-a 7.1s ease-in-out 2s infinite', color:'rgba(74,222,128,.7)' },
          { left:'68%', top:'53%', size:4, anim:'fly-b 5.8s ease-in-out 1.2s infinite', color:'rgba(134,239,172,.85)' },
          { left:'78%', top:'60%', size:3, anim:'fly-c 6.3s ease-in-out 0.8s infinite', color:'rgba(74,222,128,.75)' },
          { left:'88%', top:'56%', size:4, anim:'fly-a 4.9s ease-in-out 3s infinite', color:'rgba(187,247,208,.8)' },
          { left:'6%',  top:'70%', size:3, anim:'fly-c 7.4s ease-in-out 1.8s infinite', color:'rgba(74,222,128,.65)' },
          { left:'46%', top:'72%', size:5, anim:'fly-b 5.5s ease-in-out 0.3s infinite', color:'rgba(134,239,172,.9)' },
          { left:'62%', top:'68%', size:3, anim:'fly-a 6.6s ease-in-out 2.5s infinite', color:'rgba(74,222,128,.7)' },
        ].map((f, i) => (
          <div key={i} style={{
            position: 'absolute', left: f.left, top: f.top,
            width: f.size, height: f.size, borderRadius: '50%',
            background: f.color,
            boxShadow: `0 0 ${f.size * 3}px ${f.size}px ${f.color}`,
            animation: f.anim,
            pointerEvents: 'none',
          }} />
        ))}

        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '96px 24px 80px', width: '100%' }}>
          <div style={{ maxWidth: 740 }}>
            <div className="h1">
              <Pill icon={Shield} dark>IoT + AI for tomato farmers</Pill>
            </div>
            <h1 className="h2" style={{ fontFamily: SF, fontSize: 'clamp(40px,6vw,78px)', fontWeight: 800, lineHeight: 1.04, color: '#f0fdf4', marginBottom: 24, letterSpacing: '-0.02em' }}>
              Intelligent monitoring<br />for your{' '}
              <em style={{ color: '#4ade80', fontStyle: 'italic' }}>tomato farm.</em>
            </h1>
            <p className="h3" style={{ fontSize: 18, color: '#a7f3d0', opacity: .85, lineHeight: 1.8, maxWidth: 560, marginBottom: 40 }}>
              Real-time sensor feeds, AI-powered leaf disease detection, and automated irrigation control. Built on ESP32 and TensorFlow Lite.
            </p>
            <div className="h4" style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
              {authed ? (
                <a href="/dashboard" className="hero-cta">
                  Go to Dashboard <ArrowRight size={18} />
                </a>
              ) : (
                <button className="hero-cta" onClick={() => setModal(true)}>
                  Get started free <ArrowRight size={18} />
                </button>
              )}
              <a href="#features" className="ghost-cta">See features</a>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'rgba(167,243,208,.45)', fontSize: 10, letterSpacing: '.14em' }}>SCROLL</span>
          <div style={{ width: 1, height: 38, background: 'linear-gradient(to bottom,rgba(74,222,128,.5),transparent)' }} />
        </div>
      </section>

      {/* STATS BAR */}
      <section ref={statRef} style={{ background: '#0d2618', borderTop: '1px solid rgba(74,222,128,.1)' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
            {STATS.map((s, i) => (
              <div key={i} className={`rv d${i + 1} ${statIn ? 'on' : ''}`} style={{
                textAlign: 'center', padding: '32px 16px',
                borderRight: i < STATS.length - 1 ? '1px solid rgba(74,222,128,.08)' : 'none',
              }}>
                <div style={{ fontFamily: SF, fontSize: 38, fontWeight: 800, color: '#4ade80', lineHeight: 1 }}>{s.value}</div>
                <div style={{ color: '#86efac', opacity: .6, fontSize: 13, marginTop: 6 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" ref={featRef} style={{ background: '#faf8f2', padding: '108px 0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <Pill icon={Sprout}>EVERYTHING YOU NEED</Pill>
            <h2 style={{ fontFamily: SF, fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: '#0a1f10', lineHeight: 1.1, marginBottom: 16 }}>
              What Smart Farm does<br />for your operation
            </h2>
            <p style={{ color: '#4b5563', fontSize: 16, lineHeight: 1.75, maxWidth: 520, margin: '0 auto' }}>
              Every feature is built around one goal: giving smallholder tomato farmers the tools that used to only exist in industrial agriculture.
            </p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 20 }}>
            {FEATURES.map(({ Icon, title, desc }, i) => (
              <div key={i} className={`feat-card rv d${(i % 6) + 1} ${featIn ? 'on' : ''}`}>
                <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 18, background: 'linear-gradient(135deg,#f0fdf4,#dcfce7)', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={22} color="#15803d" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>{title}</h3>
                <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" ref={howRef} style={{ background: '#fff', padding: '108px 0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <Pill icon={Zap}>SETUP IN MINUTES</Pill>
            <h2 style={{ fontFamily: SF, fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: '#0a1f10', lineHeight: 1.1 }}>
              How it works
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 24 }}>
            {STEPS.map(({ Icon, number, title, desc }, i) => (
              <div key={i} className={`step-card rv d${i + 1} ${howIn ? 'on' : ''}`}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, flexShrink: 0, background: '#0d2618', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon size={22} color="#4ade80" />
                  </div>
                  <span style={{ fontFamily: SF, fontSize: 44, fontWeight: 800, color: '#e8f5e9', lineHeight: 1 }}>{number}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 600, color: '#111827', marginBottom: 10 }}>{title}</h3>
                <p style={{ fontSize: 14.5, color: '#6b7280', lineHeight: 1.75 }}>{desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="lg-only" style={{ position: 'absolute', top: '50%', right: -13, width: 26, height: 26, borderRadius: '50%', background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                    <ArrowRight size={12} color="#15803d" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" ref={abtRef} style={{ background: '#f0fdf4', padding: '108px 0' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '0 24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 64, alignItems: 'center' }}>
            <div className={`rv d1 ${abtIn ? 'on' : ''}`}>
              <Pill icon={Leaf}>ABOUT THE PROJECT</Pill>
              <h2 style={{ fontFamily: SF, fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 700, color: '#0a1f10', lineHeight: 1.15, marginBottom: 20 }}>
                Built for the farmer who deserves better tools
              </h2>
              <p style={{ fontSize: 15.5, color: '#374151', lineHeight: 1.85, marginBottom: 16 }}>
                Smart Farm Monitor brings precision agriculture to smallholder tomato farmers. Crop disease and inefficient irrigation are two of the biggest yield killers, and both are preventable with the right data.
              </p>
              <p style={{ fontSize: 15.5, color: '#374151', lineHeight: 1.85, marginBottom: 32 }}>
                The system runs on an ESP32-CAM with a DHT22 sensor and a capacitive soil moisture probe. The Flask backend runs a TFLite model trained on the PlantVillage dataset, detecting 6 common tomato leaf conditions.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {TECH_TAGS.map(tag => (
                  <span key={tag} style={{ padding: '5px 13px', borderRadius: 100, background: '#fff', border: '1px solid #bbf7d0', fontSize: 12, fontWeight: 500, color: '#15803d' }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Live readings card */}
            <div className={`rv d2 ${abtIn ? 'on' : ''}`}>
              <div style={{ borderRadius: 22, background: 'linear-gradient(145deg,#0d2618,#0f3020)', padding: 32, boxShadow: '0 28px 64px rgba(13,38,24,.28)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
                  <div style={{ position: 'relative', width: 10, height: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4ade80' }} />
                    <div style={{ position: 'absolute', inset: -3, borderRadius: '50%', border: '1px solid #4ade80', animation: 'dot-ring 2s ease-out infinite' }} />
                  </div>
                  <span style={{ color: '#86efac', fontSize: 12, fontWeight: 600, letterSpacing: '.1em' }}>LIVE READINGS</span>
                </div>
                {LIVE_ROWS.map(({ Icon, label, value, color }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0', borderBottom: i < LIVE_ROWS.length - 1 ? '1px solid rgba(74,222,128,.08)' : 'none' }}>
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={17} color={color} />
                    </div>
                    <span style={{ flex: 1, color: '#d1fae5', fontSize: 13.5 }}>{label}</span>
                    <span style={{ color, fontWeight: 700, fontSize: 17 }}>{value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 22, padding: '12px 16px', borderRadius: 12, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Shield size={15} color="#4ade80" />
                  <span style={{ color: '#86efac', fontSize: 13 }}>All systems operating normally</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{ background: 'linear-gradient(135deg,#0d2618 0%,#0f3020 100%)', padding: '108px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,.08) 0%,transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'relative', maxWidth: 580, margin: '0 auto' }}>
          <h2 style={{ fontFamily: SF, fontSize: 'clamp(28px,4vw,52px)', fontWeight: 700, color: '#f0fdf4', marginBottom: 16, lineHeight: 1.12 }}>
            Ready to monitor your farm?
          </h2>
          <p style={{ fontSize: 17, color: '#86efac', opacity: .8, marginBottom: 40, lineHeight: 1.75 }}>
            Create a free account and connect your ESP32 in under 10 minutes.
          </p>
          {authed ? (
            <a href="/dashboard" className="hero-cta" style={{ margin: '0 auto' }}>
              Go to Dashboard <ArrowRight size={18} />
            </a>
          ) : (
            <button className="hero-cta" onClick={() => setModal(true)} style={{ margin: '0 auto' }}>
              Get started free <ArrowRight size={18} />
            </button>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ background: '#060f09', padding: '56px 24px 32px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 40, marginBottom: 48 }}>
            <div style={{ maxWidth: 260 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#4ade80,#15803d)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Leaf size={16} color="#fff" />
                </div>
                <span style={{ fontFamily: SF, fontSize: 16, fontWeight: 700, color: '#f0fdf4' }}>Smart Farm Monitor</span>
              </div>
              <p style={{ fontSize: 13.5, color: '#4b5563', lineHeight: 1.75 }}>
                IoT-powered precision agriculture for smallholder tomato farmers.
              </p>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48 }}>
              <div>
                <div style={{ color: '#4ade80', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', marginBottom: 16 }}>PRODUCT</div>
                {['Features', 'How It Works', 'About'].map(l => (
                  <a key={l} href={`#${l.toLowerCase().replace(/ /g, '')}`}
                    style={{ display: 'block', color: '#6b7280', fontSize: 13.5, textDecoration: 'none', marginBottom: 10, transition: 'color .2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#86efac'}
                    onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}
                  >{l}</a>
                ))}
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid #1a2e1f', paddingTop: 24, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: '#374151', fontSize: 13 }}>Smart Farm Monitor 2025. Built for tomato farmers.</span>
            <span style={{ color: '#374151', fontSize: 13 }}>Powered by ESP32 and AI</span>
          </div>
        </div>
      </footer>

      {modal && <AuthModal onClose={() => setModal(false)} />}
    </>
  )
}
