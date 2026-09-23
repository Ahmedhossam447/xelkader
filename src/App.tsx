import { useState, useRef, useEffect, useCallback } from 'react'
import logoImg from '@/imports/Logo.png'
import {
  supabase,
  type PersonRecord,
  findParticipantByPhone,
  saveParticipantGift,
} from './supabase'

interface WheelItem {
  id: number
  label: string
  wheelLines: string[]
  remaining: number
  color: string
  textDark: boolean
}

const LIMIT = 5
const DISPLAY_SIZE = 340
const DEFAULT_TRAP_PROBABILITY = 0.5 // 50% default chance for 'ملكش حظ يا صحبي'

const STORAGE_KEY_ITEMS = 'moghazy_wheel_items_v2'
const STORAGE_KEY_CONFIG = 'moghazy_wheel_config_v2'
const STORAGE_KEY_USER = 'moghazy_current_user_v1'

const INITIAL_ITEMS: WheelItem[] = [
  { id: 1,  label: 'خصم ١٠٪ على رحلة سيوة ومطروح',              wheelLines: ['خصم ١٠٪', 'سيوة ومطروح'],     remaining: LIMIT, color: '#28A84A', textDark: false },
  { id: 2,  label: 'خصم ١٥٪ على رحلة سيوة ومطروح',              wheelLines: ['خصم ١٥٪', 'سيوة ومطروح'],     remaining: LIMIT, color: '#E2A51B', textDark: true  },
  { id: 3,  label: 'رحلة مجانية بإختيارك 🎉',                   wheelLines: ['رحلة مجانية', 'بإختيارك'],    remaining: LIMIT, color: '#D84926', textDark: false },
  { id: 4,  label: 'ملكش حظ يا صحبي 😅',                       wheelLines: ['ملكش حظ', 'يا صحبي'],        remaining: LIMIT, color: '#256A74', textDark: false },
  { id: 5,  label: 'خصم ١٠٠٠ج على دبلومة التصوير الفوتوغرافي', wheelLines: ['خصم ١٠٠٠ج', 'دبلومة التصوير'], remaining: LIMIT, color: '#28A84A', textDark: false },
  { id: 6,  label: 'خصم ١٠٠٠ج على دبلومة صناعة المحتوى',       wheelLines: ['خصم ١٠٠٠ج', 'دبلومة المحتوى'],remaining: LIMIT, color: '#E2A51B', textDark: true  },
  { id: 7,  label: 'خصم ١٠٪ على ورشة التصوير المعماري',         wheelLines: ['خصم ١٠٪', 'ورشة المعماري'],  remaining: LIMIT, color: '#D84926', textDark: false },
  { id: 8,  label: 'خصم ١٥٪ على ورشة الفاشون',                  wheelLines: ['خصم ١٥٪', 'ورشة الفاشون'],   remaining: LIMIT, color: '#256A74', textDark: false },
  { id: 9,  label: 'هتعمل ريل معانا حالاً 🎬',                  wheelLines: ['ريل معانا', 'حالاً'],         remaining: LIMIT, color: '#28A84A', textDark: false },
  { id: 10, label: 'هتشتغل معانا علاقات عامة لمدة نص ساعة',    wheelLines: ['علاقات عامة', 'نص ساعة'],     remaining: LIMIT, color: '#E2A51B', textDark: true  },
  { id: 11, label: 'هتعزمنا على الغداء 🍽️',                     wheelLines: ['هتعزمنا', 'على الغداء'],      remaining: LIMIT, color: '#D84926', textDark: false },
  { id: 12, label: 'هتيجي اسكندرية في جولة معانا 📸',           wheelLines: ['جولة اسكندرية', 'معانا'],     remaining: LIMIT, color: '#256A74', textDark: false },
]

function drawWheelFrame(canvas: HTMLCanvasElement, rot: number, items: WheelItem[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const dpr = window.devicePixelRatio || 1
  const size = DISPLAY_SIZE

  if (canvas.width !== size * dpr) {
    canvas.width = size * dpr
    canvas.height = size * dpr
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.scale(dpr, dpr)

  const cx = size / 2
  const cy = size / 2
  const r = cx - 10
  const n = items.length
  const segAngle = (Math.PI * 2) / n

  // Outer decorative ring
  ctx.beginPath()
  ctx.arc(cx, cy, r + 9, 0, Math.PI * 2)
  ctx.fillStyle = '#E2A51B'
  ctx.fill()

  ctx.beginPath()
  ctx.arc(cx, cy, r + 5, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()

  // Shadow
  ctx.beginPath()
  ctx.arc(cx, cy, r + 4, 0, Math.PI * 2)
  ctx.shadowColor = 'rgba(0,0,0,0.5)'
  ctx.shadowBlur = 18
  ctx.fillStyle = 'rgba(0,0,0,0.01)'
  ctx.fill()
  ctx.shadowBlur = 0

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((rot * Math.PI) / 180)

  items.forEach((item, i) => {
    const startA = -Math.PI / 2 + i * segAngle
    const endA = startA + segAngle
    const midA = startA + segAngle / 2

    // Segment
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r, startA, endA)
    ctx.closePath()
    ctx.fillStyle = item.remaining > 0 ? item.color : '#888'
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Text
    ctx.save()
    ctx.translate(Math.cos(midA) * r * 0.62, Math.sin(midA) * r * 0.62)
    ctx.rotate(midA + Math.PI / 2)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = item.remaining > 0
      ? (item.textDark ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.95)')
      : 'rgba(200,200,200,0.7)'

    // Dynamic font sizing for long labels
    const longestLine = item.wheelLines.reduce((max, l) => Math.max(max, l.length), 0)
    const fontSize = longestLine > 14 ? 7.8 : longestLine > 10 ? 8.5 : 9.5
    ctx.font = `bold ${fontSize}px 'Cairo', Arial, sans-serif`

    item.wheelLines.forEach((line, j) => {
      const yOff = (j - (item.wheelLines.length - 1) / 2) * 13.5
      ctx.fillText(line, 0, yOff)
    })
    ctx.restore()
  })

  // Center hub
  ctx.beginPath()
  ctx.arc(0, 0, 26, 0, Math.PI * 2)
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.strokeStyle = '#E2A51B'
  ctx.lineWidth = 3
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#28A84A'
  ctx.fill()

  ctx.restore()
  ctx.restore()
}

// Confetti particle component
function Confetti() {
  const colors = ['#28A84A', '#E2A51B', '#D84926', '#256A74', '#C1D3A1', '#fff']
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-sm"
          style={{
            left: `${Math.random() * 100}%`,
            top: '-10px',
            width: `${6 + Math.random() * 6}px`,
            height: `${6 + Math.random() * 6}px`,
            background: colors[i % colors.length],
            animation: `confettiFall ${1 + Math.random() * 1.5}s ease-in ${Math.random() * 0.8}s forwards`,
          }}
        />
      ))}
    </div>
  )
}

export default function App() {
  // User Registration State
  const [currentUser, setCurrentUser] = useState<PersonRecord | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_USER)
      if (saved) return JSON.parse(saved)
    } catch (e) {}
    return null
  })

  const [inputName, setInputName] = useState('')
  const [inputPhone, setInputPhone] = useState('')
  const [registerError, setRegisterError] = useState<string | null>(null)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isReturningUser, setIsReturningUser] = useState(false)
  const [hasWon, setHasWon] = useState<boolean>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY_USER)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.Gifts || parsed.gift || parsed.Gift) return true
      }
    } catch (e) {}
    return false
  })

  // Wheel Items
  const [items, setItems] = useState<WheelItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_ITEMS)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length === INITIAL_ITEMS.length) {
          return parsed
        }
      }
    } catch (e) {
      console.error(e)
    }
    return INITIAL_ITEMS
  })

  // Wheel Config
  const [trapProbability, setTrapProbability] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.trapProbability === 'number') return parsed.trapProbability
      }
    } catch (e) {}
    return DEFAULT_TRAP_PROBABILITY
  })

  const [trapUnlimited, setTrapUnlimited] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG)
      if (typeof parsed.trapUnlimited === 'boolean') return parsed.trapUnlimited
    } catch (e) {}
    return true
  })

  const [allowDuplicatePhones, setAllowDuplicatePhones] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONFIG)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (typeof parsed.allowDuplicatePhones === 'boolean') return parsed.allowDuplicatePhones
      }
    } catch (e) {}
    return false // By default, one play per phone number
  })

  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [result, setResult] = useState<WheelItem | null>(null)
  const [showResult, setShowResult] = useState(false)

  // Secret Admin Modal state (hidden from regular mobile users)
  const [showAdminModal, setShowAdminModal] = useState(false)
  const [adminTab, setAdminTab] = useState<'settings' | 'items' | 'people'>('settings')
  const [editingItemId, setEditingItemId] = useState<number | null>(null)
  const [logoClicks, setLogoClicks] = useState(0)
  const clickTimerRef = useRef<number | null>(null)

  // Whitelist helper for unlimited test spins (Moghazy / 01146989133)
  const isWhitelistedUser = (user: PersonRecord | null) => {
    if (!user) return false
    const phone = user.PhoneNumber || ''
    const name = (user.name || '').toLowerCase()
    return (
      phone === '01146989133' ||
      phone.endsWith('1146989133') ||
      name === 'moghazy' ||
      name.includes('مغازي')
    )
  }

  // Restore won gift on page refresh if user already has a prize
  useEffect(() => {
    if (currentUser) {
      const existingGift = currentUser.Gifts || currentUser.gift || currentUser.Gift
      if (existingGift) {
        setHasWon(true)
        if (!result) {
          const matched = items.find(it => it.label === existingGift) || {
            id: 999,
            label: existingGift,
            color: '#28A84A',
            remaining: 0,
            textDark: false,
            wheelLines: [existingGift],
          }
          setResult(matched)
        }
      }
    }
  }, [currentUser, items, result])

  // Supabase People list for admin
  const [peopleList, setPeopleList] = useState<PersonRecord[]>([])
  const [loadingPeople, setLoadingPeople] = useState(false)
  const [peopleSearch, setPeopleSearch] = useState('')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  // Save items and config to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items))
    } catch (e) {}
  }, [items])

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY_CONFIG,
        JSON.stringify({ trapProbability, trapUnlimited, allowDuplicatePhones })
      )
    } catch (e) {}
  }, [trapProbability, trapUnlimited, allowDuplicatePhones])

  // Check URL param ?admin=1 or #admin
  useEffect(() => {
    if (window.location.search.includes('admin') || window.location.hash.includes('admin')) {
      setShowAdminModal(true)
    }
  }, [])

  // Fetch people from Supabase for Admin tab
  const fetchPeople = useCallback(async () => {
    setLoadingPeople(true)
    try {
      const { data, error } = await supabase
        .from('People')
        .select('*')
        .order('id', { ascending: false })
      if (!error && data) {
        setPeopleList(data)
      }
    } catch (err) {
      console.error('Error fetching people:', err)
    } finally {
      setLoadingPeople(false)
    }
  }, [])

  useEffect(() => {
    if (showAdminModal && adminTab === 'people') {
      fetchPeople()
    }
  }, [showAdminModal, adminTab, fetchPeople])

  // Handle User Registration & Login
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setRegisterError(null)

    const trimmedName = inputName.trim()
    const trimmedPhone = inputPhone.trim()

    // Whitelist check: Skip verification & duplicate block for Moghazy / 01146989133
    const isWhitelisted =
      trimmedPhone === '01146989133' ||
      trimmedPhone.endsWith('1146989133') ||
      trimmedName.toLowerCase() === 'moghazy' ||
      trimmedName.includes('مغازي')

    if (!isWhitelisted) {
      if (!trimmedName || trimmedName.length < 2) {
        setRegisterError('يرجى إدخال اسمك بالكامل')
        return
      }

      if (!trimmedPhone || trimmedPhone.length < 8) {
        setRegisterError('يرجى إدخال رقم هاتف صحيح (على الأقل 8 أرقام)')
        return
      }
    }

    setIsRegistering(true)
    try {
      if (!isWhitelisted) {
        // Query Supabase for existing record by phone number
        const existing = await findParticipantByPhone(trimmedPhone)

        if (existing) {
          // Returning user: DO NOT show error! Log them in!
          const wonGift = existing.Gifts || existing.gift || existing.Gift

          const loggedInUser: PersonRecord = {
            id: existing.id,
            name: existing.name || trimmedName,
            PhoneNumber: existing.PhoneNumber || trimmedPhone,
            Gifts: wonGift,
            gift: wonGift,
          }
          setCurrentUser(loggedInUser)
          try {
            sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(loggedInUser))
          } catch (err) {}

          if (wonGift) {
            // Already has won prize: display it with December 1st expiration notice!
            setIsReturningUser(true)
            setHasWon(true)
            const matched = items.find(it => it.label === wonGift) || {
              id: 999,
              label: wonGift,
              color: '#28A84A',
              remaining: 0,
              textDark: false,
              wheelLines: [wonGift],
            }
            setResult(matched)
            setShowResult(true)
            setIsRegistering(false)
            return
          } else {
            // Registered earlier without winning yet: allow them to spin
            setIsReturningUser(false)
            setHasWon(false)
            setIsRegistering(false)
            return
          }
        }
      }

      // New user or whitelisted user
      const newUser: PersonRecord = {
        name: trimmedName || 'Moghazy',
        PhoneNumber: trimmedPhone || '01146989133',
      }
      setCurrentUser(newUser)
      setIsReturningUser(false)
      setHasWon(false)
      try {
        sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser))
      } catch (err) {}
    } catch (err) {
      console.error(err)
      if (!isWhitelisted) {
        setRegisterError('تعذر الاتصال بقاعدة البيانات. تأكد من اتصال الإنترنت')
      } else {
        const fallback = { name: trimmedName || 'Moghazy', PhoneNumber: trimmedPhone || '01146989133' }
        setCurrentUser(fallback)
      }
    } finally {
      setIsRegistering(false)
    }
  }

  // Calculate real prizes (excluding trap item id 4 if unlimited)
  const realPrizes = items.filter(i => i.id !== 4)
  const realPrizesRemaining = realPrizes.reduce((s, i) => s + i.remaining, 0)
  const totalDisplayRemaining = trapUnlimited
    ? realPrizesRemaining
    : items.reduce((s, i) => s + i.remaining, 0)

  const available = items.filter(i => i.remaining > 0)
  const isDone = realPrizesRemaining === 0

  const draw = useCallback((rot: number) => {
    if (canvasRef.current) drawWheelFrame(canvasRef.current, rot, itemsRef.current)
  }, [])

  useEffect(() => {
    if (currentUser) {
      draw(rotation)
    }
  }, [rotation, items, currentUser, draw])

  const spin = useCallback(() => {
    if (spinning || available.length === 0 || (hasWon && !isWhitelistedUser(currentUser))) return

    // 1. Pick winner using weighted probability:
    const trapItem = available.find(it => it.id === 4)
    const availableRealPrizes = available.filter(it => it.id !== 4)

    let winner: WheelItem
    if (trapItem && availableRealPrizes.length > 0) {
      if (Math.random() < trapProbability) {
        winner = trapItem
      } else {
        winner = availableRealPrizes[Math.floor(Math.random() * availableRealPrizes.length)]
      }
    } else {
      winner = available[Math.floor(Math.random() * available.length)]
    }

    // 2. Calculate exact stop angle so the pointer (at 12 o'clock / -90°)
    // points dead center into the winner slice:
    const winnerIdx = itemsRef.current.findIndex(it => it.id === winner.id)
    const segDeg = 360 / itemsRef.current.length
    const winnerCenterDeg = winnerIdx * segDeg + segDeg / 2
    const targetOffset = (360 - (winnerCenterDeg % 360)) % 360

    // Forward spin calculation: ensure rotation always spins forward by at least 5-8 full turns
    // and lands exactly on targetOffset:
    const currentRot = rotation
    const currentAngle = ((currentRot % 360) + 360) % 360
    const extraSpins = (5 + Math.floor(Math.random() * 4)) * 360
    const forwardDelta = (targetOffset - currentAngle + 360) % 360
    const targetRot = currentRot + extraSpins + forwardDelta

    setSpinning(true)
    const t0 = performance.now()
    const duration = 4800 + Math.random() * 800

    const animate = (now: number) => {
      const t = Math.min((now - t0) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 4)
      const cur = currentRot + (targetRot - currentRot) * eased
      setRotation(cur)

      if (t < 1) {
        rafRef.current = requestAnimationFrame(animate)
      } else {
        setRotation(targetRot)
        setSpinning(false)
        setItems(prev => prev.map(it => {
          if (it.id === winner.id) {
            if (it.id === 4 && trapUnlimited) {
              return it
            }
            return { ...it, remaining: Math.max(0, it.remaining - 1) }
          }
          return it
        }))
        setResult(winner)
        setHasWon(true)
        setIsReturningUser(false)

        // Save won gift to Supabase and update local user session
        if (currentUser) {
          const updatedUser: PersonRecord = {
            ...currentUser,
            Gifts: winner.label,
            gift: winner.label,
          }
          setCurrentUser(updatedUser)
          try {
            sessionStorage.setItem(STORAGE_KEY_USER, JSON.stringify(updatedUser))
          } catch (e) {}

          // Record gift into Supabase People table
          saveParticipantGift(
            currentUser.name,
            currentUser.PhoneNumber,
            winner.label,
            currentUser.id
          )
            .then(({ data, error }) => {
              if (error) {
                console.error('Error saving winner gift to Supabase:', error)
              } else if (data && data[0]?.id) {
                setCurrentUser(prev => (prev ? { ...prev, id: data[0].id } : prev))
              }
            })
            .catch(err => {
              console.error('Exception in saveParticipantGift:', err)
            })
        }

        setTimeout(() => setShowResult(true), 350)
      }
    }
    rafRef.current = requestAnimationFrame(animate)
  }, [spinning, available, rotation, trapProbability, trapUnlimited, hasWon, currentUser])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  const closeResult = () => setShowResult(false)
  const isNoWin = result?.id === 4 || result?.label.includes('ملكش حظ') || result?.label.includes('ملكش نصيب')

  // Secret 5-tap gesture on logo to toggle Admin Panel
  const handleLogoTap = () => {
    setLogoClicks(prev => {
      const next = prev + 1
      if (next >= 5) {
        setShowAdminModal(true)
        return 0
      }
      return next
    })
    if (clickTimerRef.current) window.clearTimeout(clickTimerRef.current)
    clickTimerRef.current = window.setTimeout(() => {
      setLogoClicks(0)
    }, 1500)
  }

  // Admin Reset Game Function (Resets remaining counts without changing names)
  const handleResetGame = () => {
    setItems(prev => prev.map(it => ({ ...it, remaining: LIMIT })))
    setRotation(0)
    setResult(null)
    setShowResult(false)
  }

  // Restore everything to initial defaults
  const handleRestoreDefaults = () => {
    if (window.confirm('هل أنت متأكد من استعادة جميع الأسماء والكميات الأصلية؟')) {
      setItems(INITIAL_ITEMS)
      setTrapProbability(DEFAULT_TRAP_PROBABILITY)
      setTrapUnlimited(true)
      localStorage.removeItem(STORAGE_KEY_ITEMS)
      localStorage.removeItem(STORAGE_KEY_CONFIG)
      setRotation(0)
      setResult(null)
      setShowResult(false)
    }
  }

  // Helper to update a specific item
  const updateItem = (id: number, updates: Partial<WheelItem>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it))
  }

  // Filtered people for admin table
  const filteredPeople = peopleList.filter(p =>
    (p.name && p.name.toLowerCase().includes(peopleSearch.toLowerCase())) ||
    (p.PhoneNumber && p.PhoneNumber.includes(peopleSearch))
  )

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden select-none"
      style={{
        fontFamily: "'Cairo', Arial, sans-serif",
        background: 'radial-gradient(ellipse at 60% 0%, #1a3320 0%, #0e1e1e 45%, #161210 100%)',
      }}
    >
      {/* Background decorative circles */}
      <div className="absolute top-[-120px] right-[-120px] w-80 h-80 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(40,168,74,0.15) 0%, transparent 70%)' }} />
      <div className="absolute bottom-[-100px] left-[-100px] w-72 h-72 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(216,73,38,0.12) 0%, transparent 70%)' }} />
      <div className="absolute top-1/2 left-[-80px] w-48 h-48 rounded-full pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(226,165,27,0.08) 0%, transparent 70%)' }} />

      {/* Brand Logo with hidden 5-tap admin trigger */}
      <div className="mb-2 cursor-pointer transition-transform active:scale-95" onClick={handleLogoTap} title="في الكادر">
        <img
          src={logoImg}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement
            if (!target.src.endsWith('/Logo.png')) {
              target.src = '/Logo.png'
            }
          }}
          alt="في الكادر"
          className="object-contain"
          style={{ height: '72px', filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}
        />
      </div>

      {/* Title */}
      <div className="text-center mb-2">
        <h1 className="font-black text-3xl" style={{ color: '#E2A51B', textShadow: '0 2px 12px rgba(226,165,27,0.4)' }}>
          دولاب الحظ 🎡
        </h1>
        <p className="text-sm mt-1" style={{ color: '#C1D3A1', opacity: 0.85 }}>
          {currentUser
            ? hasWon && !isWhitelistedUser(currentUser)
              ? `أهلاً يا ${currentUser.name}! جائزتك: ${currentUser.Gifts || currentUser.gift || result?.label || ''} 🎉`
              : `أهلاً يا ${currentUser.name}! دور وشوف هتاخد إيه 🎉`
            : 'سجل بياناتك علشان تبدأ تدور وتكسب جوائز!'}
        </p>
      </div>

      {/* STEP 1: Registration Form if user not registered yet */}
      {!currentUser ? (
        <div className="w-full max-w-sm mt-3 z-10">
          <form
            onSubmit={handleRegister}
            className="modal-animate rounded-3xl p-6 sm:p-7 shadow-2xl space-y-4"
            style={{
              background: 'rgba(20, 35, 25, 0.75)',
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(226, 165, 27, 0.4)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div className="text-center mb-3">
              <span className="text-4xl">🎁</span>
              <h2 className="text-lg font-black text-amber-400 mt-1">سجل للمشاركة في السحب</h2>
            </div>

            {registerError && (
              <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/50 text-red-200 text-xs font-bold leading-relaxed text-center">
                {registerError}
              </div>
            )}

            {/* Name Input */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                الاسم بالكامل:
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={inputName}
                  onChange={e => setInputName(e.target.value)}
                  placeholder="اكتب اسمك الثلاثي"
                  disabled={isRegistering}
                  className="w-full py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-amber-400 transition-all"
                />
              </div>
            </div>

            {/* Phone Input */}
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1.5">
                رقم الهاتف (الموبايل):
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  dir="ltr"
                  value={inputPhone}
                  onChange={e => setInputPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="01xxxxxxxxx"
                  disabled={isRegistering}
                  className="w-full py-3 px-4 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-amber-400 transition-all font-mono"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isRegistering}
              className="w-full py-3.5 px-4 rounded-full font-black text-base text-white transition-all active:scale-95 shadow-lg disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
              style={{
                background: 'linear-gradient(135deg, #28A84A 0%, #1a6e30 100%)',
                boxShadow: '0 4px 18px rgba(40,168,74,0.5)',
              }}
            >
              {isRegistering ? (
                <>
                  <span className="inline-block animate-spin">⏳</span>
                  <span>جاري تسجيلك...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>ابدأ اللعب الآن!</span>
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-gray-400 pt-1">
              🔒 بياناتك محفوظة بأمان ولن تستخدم إلا لتسليم الجائزة.
            </p>
          </form>
        </div>
      ) : isDone ? (
        /* All done state */
        <div className="text-center py-14 flex flex-col items-center gap-4">
          <div className="text-7xl">🏆</div>
          <p className="text-white text-2xl font-black">انتهت جميع الجوائز!</p>
          <p style={{ color: '#E2A51B' }} className="text-base font-semibold">شكراً لمشاركتكم معنا 💚</p>
          {showAdminModal && (
            <button
              onClick={handleResetGame}
              className="mt-4 px-6 py-2 rounded-xl text-sm font-bold bg-amber-500 text-black hover:bg-amber-400"
            >
              🔄 إعادة تشغيل اللعبة
            </button>
          )}
        </div>
      ) : hasWon && !isWhitelistedUser(currentUser) ? (
        /* Winner card state - wheel is completely gone! */
        <div className="w-full max-w-sm mt-3 z-10">
          <div
            className="modal-animate rounded-3xl p-6 sm:p-7 shadow-2xl text-center space-y-4"
            style={{
              background: 'rgba(20, 35, 25, 0.85)',
              backdropFilter: 'blur(12px)',
              border: '2px solid rgba(40, 168, 74, 0.5)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
            }}
          >
            <div className="text-5xl sm:text-6xl mb-1">🎁</div>

            <h2 className="text-xl sm:text-2xl font-black text-amber-400">
              أهلاً يا {currentUser.name}! 🎉
            </h2>

            <p className="text-xs text-gray-300">
              لقد شاركت بالفعل في السحب وجائزتك هي:
            </p>

            {/* Won Prize Box */}
            <div
              className="rounded-2xl p-4 border"
              style={{
                background: 'rgba(255, 255, 255, 0.08)',
                borderColor: 'rgba(40, 168, 74, 0.5)',
              }}
            >
              <p className="text-lg font-bold text-white leading-relaxed">
                {result?.label || currentUser.Gifts || currentUser.gift || 'جائزتك القيّمة'}
              </p>
            </div>

            {/* Expiration Notice */}
            <div
              className="rounded-2xl py-3 px-4 text-center border"
              style={{
                background: 'rgba(226, 165, 27, 0.12)',
                borderColor: 'rgba(226, 165, 27, 0.45)',
              }}
            >
              <p className="text-sm font-black text-amber-300">
                ⏳ الجائزة صالحة حتى 1 ديسمبر فقط
              </p>
            </div>

            {/* Phone */}
            <p className="text-xs text-gray-400">
              📱 مسجل برقم: <span className="font-mono text-amber-300 font-bold">{currentUser.PhoneNumber}</span>
            </p>

            {/* Actions */}
            <div className="pt-2 flex flex-col gap-2.5">
              <button
                onClick={() => setShowResult(true)}
                className="w-full py-3 px-4 rounded-full font-bold text-sm text-white transition-all active:scale-95 shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #28A84A 0%, #1a6e30 100%)',
                  boxShadow: '0 4px 18px rgba(40,168,74,0.5)',
                }}
              >
                <span>🎊</span>
                <span>عرض كارت الجائزة</span>
              </button>

              <button
                onClick={() => {
                  setCurrentUser(null)
                  sessionStorage.removeItem(STORAGE_KEY_USER)
                  setResult(null)
                  setHasWon(false)
                  setIsReturningUser(false)
                }}
                className="text-xs text-gray-400 hover:text-white underline py-1 cursor-pointer transition-colors"
              >
                تسجيل برقم هاتف آخر
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Wheel mode (Only visible before user wins) */
        <div className="flex flex-col items-center mt-2">
          {/* Top Pointer Triangle */}
          <div
            style={{
              width: 0,
              height: 0,
              borderLeft: '16px solid transparent',
              borderRight: '16px solid transparent',
              borderTop: '32px solid #E2A51B',
              filter: 'drop-shadow(0 3px 8px rgba(226,165,27,0.7))',
              zIndex: 10,
              marginBottom: '-4px',
            }}
          />

          {/* Canvas */}
          <canvas
            ref={canvasRef}
            style={{
              width: DISPLAY_SIZE,
              height: DISPLAY_SIZE,
              maxWidth: '88vw',
              maxHeight: '88vw',
              borderRadius: '50%',
              cursor: spinning ? 'default' : 'pointer',
              filter: 'drop-shadow(0 8px 28px rgba(0,0,0,0.65))',
              display: 'block',
              touchAction: 'manipulation',
            }}
            onClick={!spinning ? spin : undefined}
          />

          {/* Spin button */}
          <button
            onClick={spin}
            disabled={spinning}
            className="mt-6 font-black text-lg rounded-full transition-all active:scale-95 disabled:cursor-not-allowed"
            style={{
              padding: '14px 48px',
              background: spinning
                ? 'rgba(80,80,80,0.6)'
                : 'linear-gradient(135deg, #28A84A 0%, #1a6e30 100%)',
              color: '#fff',
              border: 'none',
              boxShadow: spinning ? 'none' : '0 4px 20px rgba(40,168,74,0.55)',
              cursor: spinning ? 'default' : 'pointer',
              opacity: spinning ? 0.6 : 1,
              letterSpacing: '0.02em',
            }}
          >
            {spinning ? '⏳ جاري الدوران...' : '🎯 دور دلوقتي!'}
          </button>

          {/* Remaining count hint */}
          <p className="mt-2.5 text-xs" style={{ color: 'rgba(193,211,161,0.6)' }}>
            {totalDisplayRemaining} جائزة متاحة
          </p>
        </div>
      )}

      {/* Result Modal */}
      {showResult && result && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.78)', backdropFilter: 'blur(6px)' }}
          onClick={closeResult}
        >
          {!isNoWin && <Confetti />}
          <div
            className="modal-animate relative rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center shadow-2xl"
            style={{
              background: isNoWin
                ? 'linear-gradient(135deg, #0e2229, #112828)'
                : 'linear-gradient(135deg, #0d1f0d, #102a1a)',
              border: `3px solid ${isNoWin ? '#256A74' : '#28A84A'}`,
              boxShadow: `0 0 40px ${isNoWin ? 'rgba(37,106,116,0.4)' : 'rgba(40,168,74,0.4)'}`,
            }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-5xl sm:text-6xl mb-3">
              {isReturningUser ? '🎁' : isNoWin ? '😅' : '🎊'}
            </div>

            <h2 className="font-black text-xl sm:text-2xl mb-1" style={{ color: isNoWin ? '#C1D3A1' : '#E2A51B' }}>
              {isReturningUser
                ? `أهلاً بك مجدداً يا ${currentUser?.name || 'صديقنا'}! 👋`
                : isNoWin
                ? `آسفين يا ${currentUser?.name || 'صديقي'}!`
                : `مبروووك يا ${currentUser?.name || ''}! 🎉`}
            </h2>

            <p className="text-xs text-gray-300 mb-3">
              {isReturningUser
                ? 'لقد شاركت معنا بالفعل في السحب وجائزتك هي:'
                : isNoWin
                ? 'ملكش نصيب المرة دي، شرفتنا بوجودك 💚'
                : 'حصلت على:'}
            </p>

            <div
              className="rounded-2xl p-4 mb-3"
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: `1px solid ${isNoWin ? 'rgba(37,106,116,0.4)' : 'rgba(40,168,74,0.4)'}`,
              }}
            >
              <p className="text-base sm:text-lg font-bold leading-relaxed" style={{ color: '#fff' }}>
                {result.label}
              </p>
            </div>

            {/* Expiration Notice */}
            {!isNoWin && (
              <div
                className="rounded-2xl py-3 px-4 mb-4 text-center border"
                style={{
                  background: 'rgba(226, 165, 27, 0.12)',
                  borderColor: 'rgba(226, 165, 27, 0.45)',
                }}
              >
                <p className="text-sm font-black text-amber-300">
                  ⏳ الجائزة صالحة حتى 1 ديسمبر فقط
                </p>
              </div>
            )}

            {currentUser && (
              <p className="text-[11px] text-gray-400 mb-4">
                📱 مسجل برقم: <span className="font-mono text-amber-300">{currentUser.PhoneNumber}</span>
              </p>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center items-center">
              <button
                onClick={closeResult}
                className="font-black rounded-full text-base transition-all active:scale-95 w-full sm:w-auto"
                style={{
                  padding: '12px 36px',
                  background: isNoWin
                    ? 'linear-gradient(135deg, #256A74, #1a4a53)'
                    : 'linear-gradient(135deg, #28A84A, #1a6e30)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: `0 4px 16px ${isNoWin ? 'rgba(37,106,116,0.5)' : 'rgba(40,168,74,0.5)'}`,
                }}
              >
                {isReturningUser ? 'حسناً، فهمت 👍' : 'تمام! 👍'}
              </button>

              {isWhitelistedUser(currentUser) && (
                <button
                  onClick={() => {
                    closeResult()
                    setTimeout(() => spin(), 250)
                  }}
                  className="font-bold rounded-full text-xs transition-all active:scale-95 px-4 py-3 bg-amber-500 hover:bg-amber-400 text-black shadow-lg flex items-center justify-center gap-1.5 w-full sm:w-auto"
                >
                  <span>🔄</span>
                  <span>دور تاني (Moghazy Test)</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Secret Admin Panel (Visible only when unlocked via 5-taps on logo or ?admin=1) */}
      {showAdminModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
          onClick={() => setShowAdminModal(false)}
        >
          <div
            className="modal-animate relative rounded-2xl p-5 max-w-lg w-full text-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            style={{
              background: '#141d1a',
              border: '2px solid #E2A51B',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-700 pb-3 mb-3 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">⚙️</span>
                <h3 className="font-bold text-lg text-amber-400">لوحة تحكم المشرف (Admin)</h3>
              </div>
              <button
                onClick={() => setShowAdminModal(false)}
                className="text-gray-400 hover:text-white text-xl font-bold px-2"
              >
                ✕
              </button>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 mb-3 shrink-0">
              <button
                onClick={() => setAdminTab('settings')}
                className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs transition-all ${
                  adminTab === 'settings'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                ⚙️ اللعبة والفخ
              </button>
              <button
                onClick={() => setAdminTab('items')}
                className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs transition-all ${
                  adminTab === 'items'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                ✏️ الجوائز ({items.length})
              </button>
              <button
                onClick={() => setAdminTab('people')}
                className={`flex-1 py-2 px-2 rounded-xl font-bold text-xs transition-all ${
                  adminTab === 'people'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
              >
                👥 المسجلون ({peopleList.length})
              </button>
            </div>

            {/* Tab 1: Game Settings */}
            {adminTab === 'settings' && (
              <div className="overflow-y-auto space-y-3.5 pr-1">
                {/* Probability adjustment */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                  <label className="block text-sm font-bold text-amber-300 mb-2">
                    نسبة فخ "ملكش حظ يا صحبي": {Math.round(trapProbability * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.10"
                    max="0.85"
                    step="0.05"
                    value={trapProbability}
                    onChange={e => setTrapProbability(parseFloat(e.target.value))}
                    className="w-full cursor-pointer accent-amber-400"
                  />
                  <div className="flex justify-between text-xs text-gray-400 mt-2">
                    <span>10% (سهل)</span>
                    <button
                      onClick={() => setTrapProbability(0.50)}
                      className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 hover:bg-amber-500/40 text-[11px]"
                    >
                      الافتراضي: 50%
                    </button>
                    <span>85% (فخ قوي)</span>
                  </div>
                </div>

                {/* Unlimited trap toggle */}
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-gray-200">فخ غير محدود (Unlimited Trap)</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      الفخ لا ينتهي أبداً ولا يتحول إلى رمادي
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={trapUnlimited}
                    onChange={e => setTrapUnlimited(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Allow duplicate phones toggle */}
                <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-xs text-gray-200">السماح بتكرار رقم الهاتف</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {allowDuplicatePhones ? 'مسموح لأي شخص اللعب أكثر من مرة بنفس الرقم' : 'كل رقم هاتف يمكنه اللعب مرة واحدة فقط'}
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={allowDuplicatePhones}
                    onChange={e => setAllowDuplicatePhones(e.target.checked)}
                    className="w-5 h-5 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Reset User Session */}
                {currentUser && (
                  <div className="bg-white/5 p-3.5 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <p className="font-bold text-xs text-gray-200">المستخدم الحالي المسجل:</p>
                      <p className="text-[11px] text-amber-300 font-mono mt-0.5">
                        {currentUser.name} ({currentUser.PhoneNumber})
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setCurrentUser(null)
                        sessionStorage.removeItem(STORAGE_KEY_USER)
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold"
                    >
                      تسجيل خروج
                    </button>
                  </div>
                )}

                {/* Reset Game Button */}
                <div className="pt-1">
                  <button
                    onClick={handleResetGame}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-sm transition-all bg-amber-600 hover:bg-amber-700 text-white flex items-center justify-center gap-2"
                  >
                    <span>🔄</span>
                    <span>إعادة تصفير الجوائز للحد الأقصى (Reset Counters)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Edit Items & Limits */}
            {adminTab === 'items' && (
              <div className="overflow-y-auto space-y-2.5 pr-1 max-h-[58vh]">
                <div className="flex items-center justify-between bg-black/40 px-3 py-2 rounded-xl text-xs text-gray-300">
                  <span>💡 اضغط على أي جائزة لتعديل اسمها والكمية</span>
                  <button
                    onClick={handleRestoreDefaults}
                    className="text-red-400 hover:text-red-300 underline font-bold"
                  >
                    استعادة الأصل
                  </button>
                </div>

                {items.map((it) => {
                  const isEditing = editingItemId === it.id

                  return (
                    <div
                      key={it.id}
                      className="rounded-xl border border-white/10 bg-white/5 transition-all overflow-hidden"
                    >
                      {/* Summary row */}
                      <div
                        className="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5"
                        onClick={() => setEditingItemId(isEditing ? null : it.id)}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-full shrink-0 border border-white/30"
                            style={{ background: it.color }}
                          />
                          <span className="font-bold text-xs truncate max-w-[180px] sm:max-w-[240px]">
                            {it.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-black/40 font-mono font-bold text-amber-300">
                            {it.id === 4 && trapUnlimited ? '∞' : `${it.remaining} متبقي`}
                          </span>
                          <span className="text-xs text-gray-400">
                            {isEditing ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>

                      {/* Expanded Edit Form */}
                      {isEditing && (
                        <div className="p-3 border-t border-white/10 bg-black/40 space-y-3 text-xs">
                          {/* Full Label */}
                          <div>
                            <label className="block text-gray-400 mb-1 font-bold">
                              الاسم الكامل (يظهر في نافذة الفوز):
                            </label>
                            <input
                              type="text"
                              value={it.label}
                              onChange={(e) => {
                                const newLabel = e.target.value
                                updateItem(it.id, { label: newLabel })
                              }}
                              className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                            />
                          </div>

                          {/* Wheel Lines (Line 1 & Line 2) */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-gray-400 mb-1 font-bold">
                                سطر الشريحة ١:
                              </label>
                              <input
                                type="text"
                                value={it.wheelLines[0] || ''}
                                onChange={(e) => {
                                  const lines = [...it.wheelLines]
                                  lines[0] = e.target.value
                                  updateItem(it.id, { wheelLines: lines })
                                }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-gray-400 mb-1 font-bold">
                                سطر الشريحة ٢:
                              </label>
                              <input
                                type="text"
                                value={it.wheelLines[1] || ''}
                                onChange={(e) => {
                                  const lines = [...it.wheelLines]
                                  lines[1] = e.target.value
                                  updateItem(it.id, { wheelLines: lines })
                                }}
                                className="w-full bg-white/10 border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>

                          {/* Remaining / Limit Count */}
                          <div className="flex items-center justify-between pt-1">
                            <span className="font-bold text-gray-300">الكمية المتاحة (Remaining):</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateItem(it.id, { remaining: Math.max(0, it.remaining - 1) })}
                                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-sm"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                min="0"
                                max="999"
                                value={it.remaining}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 0
                                  updateItem(it.id, { remaining: Math.max(0, val) })
                                }}
                                className="w-14 text-center bg-white/10 border border-white/20 rounded-lg p-1 text-white font-mono font-bold focus:outline-none focus:border-amber-400"
                              />
                              <button
                                onClick={() => updateItem(it.id, { remaining: it.remaining + 1 })}
                                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center justify-center text-sm"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Tab 3: People registered in Supabase */}
            {adminTab === 'people' && (
              <div className="overflow-y-auto space-y-3 pr-1 max-h-[58vh]">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={peopleSearch}
                    onChange={e => setPeopleSearch(e.target.value)}
                    placeholder="ابحث بالاسم أو رقم الهاتف..."
                    className="flex-1 bg-white/10 border border-white/20 rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-400 focus:outline-none focus:border-amber-400"
                  />
                  <button
                    onClick={fetchPeople}
                    disabled={loadingPeople}
                    className="px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 text-xs font-bold shrink-0"
                  >
                    {loadingPeople ? 'جاري التحميل...' : '🔄 تحديث'}
                  </button>
                </div>

                {loadingPeople ? (
                  <p className="text-center py-8 text-xs text-gray-400">جاري جلب البيانات من Supabase...</p>
                ) : filteredPeople.length === 0 ? (
                  <div className="text-center py-8 text-xs text-gray-400 bg-white/5 rounded-xl">
                    {peopleSearch ? 'لا توجد نتائج تطابق بحثك' : 'لا يوجد مشاركون مسجلون حتى الآن'}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredPeople.map((person, idx) => {
                      const personGift = person.Gifts || person.gift || person.Gift
                      return (
                        <div
                          key={person.id || idx}
                          className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-bold text-white text-sm">{person.name}</p>
                            <p className="font-mono text-gray-400 text-xs mt-0.5">{person.PhoneNumber}</p>
                            {personGift && (
                              <div className="mt-1">
                                <span className="inline-block px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px] font-bold border border-amber-500/30">
                                  🎁 {personGift}
                                </span>
                              </div>
                            )}
                          </div>
                          {person.created_at && (
                            <div className="text-left text-[10px] text-gray-400 shrink-0">
                              {new Date(person.created_at).toLocaleDateString('ar-EG', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-gray-700 flex gap-2 shrink-0">
              <button
                onClick={() => setShowAdminModal(false)}
                className="w-full py-2.5 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all"
              >
                حفظ وإغلاق اللوحة ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
