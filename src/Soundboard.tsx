import { useEffect, useState } from 'react'
import { EFFECTS, playEffect, preloadEffects, setEffectsVolume } from './sfx'

export function Soundboard() {
  const [volume, setVolume] = useState(0.8)
  const [hit, setHit] = useState<string | null>(null)

  // decode the clips on the first interaction, so the first hit is instant
  useEffect(() => {
    const warm = () => preloadEffects()
    window.addEventListener('pointerdown', warm, { once: true })
    return () => window.removeEventListener('pointerdown', warm)
  }, [])

  function fire(key: string) {
    const effect = EFFECTS.find((e) => e.key === key)
    if (!effect) return
    setEffectsVolume(volume)
    playEffect(effect.file, 'maxSeconds' in effect ? effect.maxSeconds : undefined).catch(() => {})
    setHit(key)
    window.setTimeout(() => setHit((h) => (h === key ? null : h)), 180)
  }

  // keys 1 to 6 fire the effects, unless you are typing somewhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      fire(e.key)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <section className="soundboard">
      <div className="pads">
        {EFFECTS.map((e) => (
          <button key={e.key} className={`pad ${hit === e.key ? 'is-hit' : ''}`} onClick={() => fire(e.key)}>
            <span className="pad-emoji">{e.emoji}</span>
            <span className="pad-label">{e.label}</span>
            <kbd>{e.key}</kbd>
          </button>
        ))}
      </div>
      <label className="volume sfx-volume" title="Effects volume">
        <span>Effects</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          style={{ '--fill': `${volume * 100}%` } as React.CSSProperties}
          aria-label="Effects volume"
        />
      </label>
    </section>
  )
}
