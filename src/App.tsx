import { useEffect, useRef, useState } from 'react'
import { Deck, DeckHandle, Side } from './Deck'
import { Queue } from './Queue'
import { Track, fetchTitle, makeTrack } from './youtube'
import type { readDrop } from './dnd'
import { fetchRequests } from './guests'
import { GuestsPanel } from './GuestsPanel'
import { Soundboard } from './Soundboard'
import { AdTip } from './AdTip'

function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initial
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage unavailable, keep it in memory
    }
  }, [key, value])
  return [value, setValue] as const
}

const FADE_OPTIONS = [4, 8, 12, 16]

export default function App() {
  const [queue, setQueue] = usePersisted<Track[]>('pd.queue', [])
  const [autoMix, setAutoMix] = usePersisted('pd.auto', true)
  const [fadeSec, setFadeSec] = usePersisted('pd.fade', 8)
  const [played, setPlayed] = usePersisted<Track[]>('pd.played', [])
  const [showVideo, setShowVideo] = usePersisted('pd.video', false)
  // 0 = only deck A is heard, 1 = only deck B
  const [x, setX] = useState(0)
  const [mixing, setMixing] = useState(false)
  const [toast, setToast] = useState('')
  const [showGuests, setShowGuests] = useState(false)

  const deckA = useRef<DeckHandle>(null)
  const deckB = useRef<DeckHandle>(null)
  const deck = (side: Side) => (side === 'A' ? deckA.current! : deckB.current!)
  const liveSide: Side = x < 0.5 ? 'A' : 'B'

  // the timers and player callbacks read the latest values through this ref
  const live = useRef({ x, queue, autoMix, fadeSec, mixing, target: null as Side | null })
  live.current = { ...live.current, x, queue, autoMix, fadeSec, mixing }
  const animRef = useRef<number | null>(null)

  function say(message: string) {
    setToast(message)
    window.setTimeout(() => setToast((t) => (t === message ? '' : t)), 3500)
  }

  function stopAnimation() {
    if (animRef.current !== null) cancelAnimationFrame(animRef.current)
    animRef.current = null
    live.current.target = null
    setMixing(false)
  }

  function fadeTo(target: number, seconds: number, onDone: () => void) {
    const from = live.current.x
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / (seconds * 1000))
      setX(from + (target - from) * t)
      if (t < 1) animRef.current = requestAnimationFrame(step)
      else {
        animRef.current = null
        onDone()
      }
    }
    animRef.current = requestAnimationFrame(step)
  }

  function mixNext() {
    if (live.current.mixing) return
    const fromSide: Side = live.current.x < 0.5 ? 'A' : 'B'
    const toSide: Side = fromSide === 'A' ? 'B' : 'A'
    const to = deck(toSide)

    if (to.hasFreshTrack()) {
      to.play()
    } else {
      const next = live.current.queue[0]
      if (!next) return say('The list is empty, add more songs.')
      setQueue((q) => q.slice(1))
      to.load(next, true)
    }

    live.current.mixing = true
    live.current.target = toSide
    setMixing(true)
    waitUntilPlaying(to, 6000).then(() => {
      if (live.current.target !== toSide) return
      fadeTo(toSide === 'B' ? 1 : 0, live.current.fadeSec, () => {
        deck(fromSide).pause()
        live.current.target = null
        setMixing(false)
      })
    })
  }

  function startParty() {
    const d = deck(liveSide)
    if (d.track()) return d.play()
    const next = queue[0]
    if (!next) return say('Add some songs to the list first.')
    setQueue((q) => q.slice(1))
    d.load(next, true)
  }

  // auto mix: when the live song is about to end, bring in the next one
  useEffect(() => {
    const timer = setInterval(() => {
      const s = live.current
      if (!s.autoMix || s.mixing) return
      const d = deck(s.x < 0.5 ? 'A' : 'B')
      if (d?.isPlaying() && d.remaining() <= s.fadeSec + 1.5) mixNext()
    }, 300)
    return () => clearInterval(timer)
  }, [])

  // songs sent by guests from their phones land at the end of the list
  const guestCursor = useRef({ after: 0, boot: '', busy: false })
  useEffect(() => {
    const cursor = guestCursor.current
    const poll = async () => {
      if (cursor.busy) return
      cursor.busy = true
      try {
        const res = await fetchRequests(cursor.after)
        if (cursor.boot && res.boot !== cursor.boot) cursor.after = 0
        cursor.boot = res.boot
        const fresh = res.items.filter((i) => i.id > cursor.after)
        if (fresh.length === 0) return
        cursor.after = fresh[fresh.length - 1].id
        const tracks = fresh.map((i) => ({ ...makeTrack(i.videoId), by: i.by || 'A guest' }))
        setQueue((q) => [...q, ...tracks])
        say(fresh.length === 1 ? `${tracks[0].by} added a song 🎶` : `${fresh.length} songs from guests 🎶`)
        for (const t of tracks) {
          fetchTitle(t.videoId).then((title) =>
            setQueue((q) => q.map((x) => (x.uid === t.uid ? { ...x, title: title ?? `YouTube ${t.videoId}` } : x))),
          )
        }
      } catch {
        // server not reachable right now, try again on the next tick
      } finally {
        cursor.busy = false
      }
    }
    poll()
    const timer = setInterval(poll, 2000)
    return () => clearInterval(timer)
  }, [])

  // iframes swallow drag events, so the players ignore the mouse while something is being dragged
  useEffect(() => {
    let depth = 0
    const set = (on: boolean) => document.body.classList.toggle('dragging', on)
    const enter = () => {
      depth++
      set(true)
    }
    const leave = () => {
      depth = Math.max(0, depth - 1)
      if (depth === 0) set(false)
    }
    const end = (e: Event) => {
      // a file dropped outside a drop zone would otherwise make the browser open it and leave the party
      if (e.type === 'drop') e.preventDefault()
      depth = 0
      set(false)
    }
    const allowDrop = (e: DragEvent) => e.preventDefault()
    window.addEventListener('dragstart', enter)
    window.addEventListener('dragenter', enter)
    window.addEventListener('dragleave', leave)
    window.addEventListener('dragend', end)
    window.addEventListener('dragover', allowDrop)
    window.addEventListener('drop', end)
    return () => {
      window.removeEventListener('dragstart', enter)
      window.removeEventListener('dragenter', enter)
      window.removeEventListener('dragleave', leave)
      window.removeEventListener('dragend', end)
      window.removeEventListener('dragover', allowDrop)
      window.removeEventListener('drop', end)
    }
  }, [])

  function handleEnded(side: Side) {
    const s = live.current
    if (s.autoMix && !s.mixing && side === (s.x < 0.5 ? 'A' : 'B')) mixNext()
  }

  function handleError(side: Side) {
    say("This song can't be played here (blocked by the publisher). Skipping.")
    const s = live.current
    if (s.target === side) {
      stopAnimation()
      live.current.mixing = false
      mixNext()
    } else if (side === (s.x < 0.5 ? 'A' : 'B') && s.autoMix) {
      mixNext()
    }
  }

  function sendToDeck(uid: string, side: Side) {
    const upcoming = queue.find((t) => t.uid === uid)
    if (upcoming) setQueue((q) => q.filter((t) => t.uid !== uid))
    // an already played song stays in the list, it just goes on the deck again
    const track = upcoming ?? played.find((t) => t.uid === uid)
    if (track) deck(side).load(track, false)
  }

  function handleDeckDrop(side: Side, drop: ReturnType<typeof readDrop>) {
    if (!drop) return
    if ('uid' in drop) return sendToDeck(drop.uid, side)
    const { videoId } = drop
    fetchTitle(videoId).then((t) => deck(side).load(makeTrack(videoId, t ?? `YouTube ${videoId}`), false))
  }

  const gainA = Math.cos((x * Math.PI) / 2)
  const gainB = Math.sin((x * Math.PI) / 2)

  return (
    <div className="app">
      <AdTip />

      <div className="decks">
        <Deck
          ref={deckA}
          side="A"
          gain={gainA}
          live={liveSide === 'A'}
          showVideo={showVideo}
          onDrop={(d) => handleDeckDrop('A', d)}
          onEnded={handleEnded}
          onError={handleError}
          onStarted={(t) => setPlayed((p) => [t, ...p.filter((x) => x.uid !== t.uid)].slice(0, 300))}
        />
        <Deck
          ref={deckB}
          side="B"
          gain={gainB}
          live={liveSide === 'B'}
          showVideo={showVideo}
          onDrop={(d) => handleDeckDrop('B', d)}
          onEnded={handleEnded}
          onError={handleError}
          onStarted={(t) => setPlayed((p) => [t, ...p.filter((x) => x.uid !== t.uid)].slice(0, 300))}
        />
      </div>

      <div className="mixer">
        <span className="fader-label">A</span>
        <input
          className="fader"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={x}
          onChange={(e) => {
            stopAnimation()
            setX(Number(e.target.value))
          }}
          aria-label="Crossfader"
        />
        <span className="fader-label">B</span>
      </div>

      <div className="controls">
        <button className="primary" onClick={startParty}>
          ▶ Play
        </button>
        <button onClick={mixNext} disabled={mixing}>
          {mixing ? 'Mixing…' : '⇄ Mix to next'}
        </button>
        <label className="toggle">
          <input type="checkbox" checked={showVideo} onChange={(e) => setShowVideo(e.target.checked)} />
          <span>Video</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={autoMix} onChange={(e) => setAutoMix(e.target.checked)} />
          <span>Auto mix</span>
        </label>
        <button onClick={() => setShowGuests(true)}>📱 Guests</button>
        <label className="fade-select">
          Fade
          <select value={fadeSec} onChange={(e) => setFadeSec(Number(e.target.value))}>
            {FADE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="explain">
        {autoMix
          ? `When a song has ${fadeSec} seconds left, the next one fades in by itself. You just add songs.`
          : 'Manual mode: move the slider or click "Mix to next".'}
      </p>

      <Soundboard />

      <Queue
        queue={queue}
        setQueue={setQueue}
        played={played}
        setPlayed={setPlayed}
        onSendToDeck={sendToDeck}
      />

      {showGuests && <GuestsPanel onClose={() => setShowGuests(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function waitUntilPlaying(d: DeckHandle, timeoutMs: number) {
  return new Promise<void>((resolve) => {
    const started = Date.now()
    const check = setInterval(() => {
      if (d.isPlaying() || Date.now() - started > timeoutMs) {
        clearInterval(check)
        resolve()
      }
    }, 100)
  })
}
