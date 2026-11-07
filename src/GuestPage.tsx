import { useState } from 'react'
import { fetchTitle, parseVideoId, thumbnail } from './youtube'
import { sendRequest } from './guests'

type Sent = { videoId: string; title: string }

export function GuestPage() {
  const [name, setName] = useState(() => {
    try {
      return localStorage.getItem('pd.guestName') ?? ''
    } catch {
      return ''
    }
  })
  const [link, setLink] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'error' | 'bad'>('idle')
  const [sent, setSent] = useState<Sent[]>([])

  async function submit() {
    const videoId = parseVideoId(link)
    if (!videoId) return setStatus('bad')
    setStatus('sending')
    try {
      await sendRequest(videoId, name)
      try {
        localStorage.setItem('pd.guestName', name)
      } catch {
        // fine, we just won't remember the name
      }
      setLink('')
      setStatus('idle')
      const title = (await fetchTitle(videoId)) ?? 'Your song'
      setSent((s) => [{ videoId, title }, ...s])
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="guest">
      <h1>Play your song 🎶</h1>
      <p className="muted">
        In the YouTube app tap <b>Share</b>, then <b>Copy link</b>, and paste it here. Your song goes to the end of the list.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" maxLength={30} />
        <input
          value={link}
          onChange={(e) => {
            setLink(e.target.value)
            if (status !== 'sending') setStatus('idle')
          }}
          placeholder="Paste a YouTube link"
          inputMode="url"
          autoFocus
        />
        <button className="primary" type="submit" disabled={!link.trim() || status === 'sending'}>
          {status === 'sending' ? 'Sending…' : 'Send to the DJ'}
        </button>
      </form>

      {status === 'bad' && <p className="note">That doesn't look like a YouTube link. Try again.</p>}
      {status === 'error' && <p className="note">It didn't arrive. Are you on the same WiFi as the laptop?</p>}

      {sent.length > 0 && (
        <>
          <h2>Sent ✓</h2>
          <ul className="results">
            {sent.map((s, i) => (
              <li key={i}>
                <img src={thumbnail(s.videoId)} alt="" />
                <span className="t-title">{s.title}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
