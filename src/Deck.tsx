/* eslint-disable @typescript-eslint/no-explicit-any */
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { ENDED, PLAYING, Track, loadYouTubeApi, thumbnail } from './youtube'
import { readDrop } from './dnd'

export type Side = 'A' | 'B'

export type DeckHandle = {
  load(track: Track, autoplay: boolean): void
  play(): void
  pause(): void
  isPlaying(): boolean
  remaining(): number
  track(): Track | null
  // loaded but not started yet, so it is ready to be mixed in
  hasFreshTrack(): boolean
}

type Props = {
  side: Side
  gain: number
  live: boolean
  showVideo: boolean
  onDrop(drop: ReturnType<typeof readDrop>): void
  onEnded(side: Side): void
  onStarted(track: Track): void
  onError(side: Side): void
}

export const Deck = forwardRef<DeckHandle, Props>(function Deck(props, ref) {
  const { side, gain, live, showVideo } = props
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const readyRef = useRef(false)
  const pendingRef = useRef<{ track: Track; autoplay: boolean } | null>(null)
  const trackRef = useRef<Track | null>(null)
  const startedRef = useRef(false)
  const playingRef = useRef(false)
  const gainRef = useRef(gain)
  const volumeRef = useRef(1)
  const callbacks = useRef(props)
  callbacks.current = props

  const [track, setTrack] = useState<Track | null>(null)
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState({ cur: 0, dur: 0 })
  const [over, setOver] = useState(false)
  const [volume, setVolume] = useState(1)

  // what you hear = this deck's own volume × the crossfader position
  function applyVolume() {
    if (readyRef.current) playerRef.current.setVolume(Math.round(gainRef.current * volumeRef.current * 100))
  }

  function doLoad(next: Track, autoplay: boolean) {
    trackRef.current = next
    startedRef.current = false
    setTrack(next)
    if (!readyRef.current) {
      pendingRef.current = { track: next, autoplay }
      return
    }
    if (autoplay) playerRef.current.loadVideoById(next.videoId)
    else playerRef.current.cueVideoById(next.videoId)
  }

  useEffect(() => {
    let cancelled = false
    loadYouTubeApi().then((YT) => {
      if (cancelled || !hostRef.current) return
      const el = document.createElement('div')
      hostRef.current.appendChild(el)
      playerRef.current = new YT.Player(el, {
        width: '100%',
        height: '100%',
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => {
            readyRef.current = true
            playerRef.current.unMute()
            applyVolume()
            const pending = pendingRef.current
            pendingRef.current = null
            if (pending) doLoad(pending.track, pending.autoplay)
          },
          onStateChange: (e: any) => {
            playingRef.current = e.data === PLAYING
            setPlaying(playingRef.current)
            if (e.data === PLAYING && !startedRef.current && trackRef.current) {
              startedRef.current = true
              callbacks.current.onStarted(trackRef.current)
            }
            if (e.data === ENDED) callbacks.current.onEnded(side)
          },
          onError: () => callbacks.current.onError(side),
        },
      })
    })
    const poll = setInterval(() => {
      const p = playerRef.current
      if (!readyRef.current || !p?.getDuration) return
      setTime({ cur: p.getCurrentTime() || 0, dur: p.getDuration() || 0 })
    }, 250)
    return () => {
      cancelled = true
      clearInterval(poll)
      readyRef.current = false
      playerRef.current?.destroy?.()
      playerRef.current = null
      if (hostRef.current) hostRef.current.innerHTML = ''
    }
  }, [side])

  useEffect(() => {
    gainRef.current = gain
    volumeRef.current = volume
    applyVolume()
  }, [gain, volume])

  useImperativeHandle(ref, () => ({
    load: doLoad,
    play: () => readyRef.current && playerRef.current.playVideo(),
    pause: () => readyRef.current && playerRef.current.pauseVideo(),
    isPlaying: () => playingRef.current,
    remaining: () => {
      const p = playerRef.current
      if (!readyRef.current || !p.getDuration) return Infinity
      const dur = p.getDuration()
      return dur > 0 ? dur - p.getCurrentTime() : Infinity
    },
    track: () => trackRef.current,
    hasFreshTrack: () => trackRef.current !== null && !startedRef.current,
  }))

  // while dragging the seek bar, show where you are dragging, not where the song is
  const [seeking, setSeeking] = useState<number | null>(null)
  const shownTime = seeking ?? time.cur
  const progress = time.dur > 0 ? (shownTime / time.dur) * 100 : 0

  function seek(seconds: number) {
    setSeeking(null)
    if (readyRef.current) playerRef.current.seekTo(seconds, true)
    setTime((t) => ({ ...t, cur: seconds }))
  }

  return (
    <section
      className={`deck ${live ? 'is-live' : ''} ${over ? 'is-over' : ''}`}
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setOver(false)
        props.onDrop(readDrop(e))
      }}
    >
      <header className="deck-head">
        <span className="deck-letter">{side}</span>
        <span className="deck-title" title={track?.title}>
          {track ? track.title : 'Empty deck'}
        </span>
        {live && <span className="live-pill">live</span>}
      </header>

      <div className="screen">
        <div className="player-host" ref={hostRef} />
        {track && !showVideo && (
          <div className={`visual ${playing ? 'is-playing' : ''}`}>
            <div className="visual-bg" style={{ backgroundImage: `url(${thumbnail(track.videoId)})` }} />
            <div className="vinyl">
              <div className="vinyl-label" style={{ backgroundImage: `url(${thumbnail(track.videoId)})` }} />
            </div>
            <div className="eq" aria-hidden>
              {Array.from({ length: 14 }, (_, i) => (
                <span key={i} style={{ animationDelay: `${-((i * 37) % 100) / 100}s`, animationDuration: `${0.5 + ((i * 13) % 7) / 10}s` }} />
              ))}
            </div>
          </div>
        )}
        <div className={`drop-hint ${track ? 'when-dragging' : ''}`}>
          {track ? 'Drop to replace the song' : 'Drop a song here'}
        </div>
      </div>

      <input
        className="seek"
        type="range"
        min={0}
        max={time.dur || 1}
        step={0.1}
        value={shownTime}
        disabled={!track || time.dur === 0}
        onChange={(e) => setSeeking(Number(e.target.value))}
        onPointerUp={(e) => seek(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => seek(Number((e.target as HTMLInputElement).value))}
        style={{ '--fill': `${progress}%` } as React.CSSProperties}
        aria-label={`Seek on deck ${side}`}
      />
      <div className="deck-foot">
        <button
          className="round"
          disabled={!track}
          onClick={() => (playing ? playerRef.current.pauseVideo() : playerRef.current.playVideo())}
          aria-label={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="clock">
          {fmt(shownTime)} / {fmt(time.dur)}
        </span>
        <label className="volume" title="This deck's volume">
          <span aria-hidden>🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
            style={{ '--fill': `${volume * 100}%` } as React.CSSProperties}
            aria-label={`Deck ${side} volume`}
          />
        </label>
      </div>
    </section>
  )
})

function fmt(s: number) {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}
