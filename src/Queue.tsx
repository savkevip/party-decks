import { useState } from 'react'
import { Track, fetchPlaylist, fetchTitle, makeTrack, parsePlaylistId, parseVideoId, thumbnail } from './youtube'
import { readDrop, startTrackDrag } from './dnd'
import type { Side } from './Deck'

type Props = {
  queue: Track[]
  setQueue(update: (q: Track[]) => Track[]): void
  // newest first
  played: Track[]
  setPlayed(update: (p: Track[]) => Track[]): void
  onSendToDeck(uid: string, side: Side): void
}

export function Queue({ queue, setQueue, played, setPlayed, onSendToDeck }: Props) {
  const [text, setText] = useState('')
  const [note, setNote] = useState('')
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const needle = normalize(filter)
  // keep each song's real position, so moving and "sledeća" still work while searching
  const matches = (t: Track) => !needle || normalize(t.title).includes(needle)
  const shown = queue.map((t, i) => ({ t, i })).filter(({ t }) => matches(t))
  const shownPlayed = played.filter(matches)
  const total = queue.length + played.length

  function addTracks(tracks: Track[], at = Infinity) {
    setQueue((q) => [...q.slice(0, at), ...tracks, ...q.slice(at)])
    for (const t of tracks) {
      if (!t.title.endsWith('…')) continue
      fetchTitle(t.videoId).then((title) =>
        setQueue((q) => q.map((x) => (x.uid === t.uid ? { ...x, title: title ?? `YouTube ${t.videoId}` } : x))),
      )
    }
  }

  async function submit() {
    const value = text.trim()
    if (!value) return
    setNote('')
    const listId = parsePlaylistId(value)
    if (listId) {
      setNote('Loading playlist…')
      try {
        const songs = await fetchPlaylist(listId)
        if (songs.length === 0) throw new Error('empty')
        addTracks(songs)
        setText('')
        setNote(`Added ${songs.length} songs from the playlist 🎉`)
        return
      } catch {
        // a YouTube "Mix" can't be read as a playlist, so fall back to just the song in the link
        if (!parseVideoId(value)) {
          setNote("Can't open that playlist. Is it public or unlisted? Private ones don't work.")
          return
        }
        setNote("Can't open that playlist (a YouTube Mix or private), so I added just this song.")
      }
    }
    const ids = value
      .split(/\s+/)
      .map(parseVideoId)
      .filter((id): id is string => id !== null)
    if (ids.length > 0) {
      addTracks(ids.map((id) => makeTrack(id)))
      setText('')
      return
    }
    setNote("That doesn't look like a YouTube link. Paste a song or playlist link.")
  }

  function handleDrop(e: React.DragEvent, at: number) {
    e.preventDefault()
    setOverIndex(null)
    const drop = readDrop(e)
    if (!drop) return
    if ('videoId' in drop) return addTracks([makeTrack(drop.videoId)], at)
    const replay = played.find((t) => t.uid === drop.uid)
    setQueue((q) => {
      const from = q.findIndex((t) => t.uid === drop.uid)
      // an already played song dragged up into the list gets queued again
      if (from === -1) return replay ? [...q.slice(0, at), { ...replay, uid: makeTrack(replay.videoId).uid }, ...q.slice(at)] : q
      const moved = q[from]
      const rest = q.filter((_, i) => i !== from)
      const target = from < at ? at - 1 : at
      return [...rest.slice(0, target), moved, ...rest.slice(target)]
    })
  }

  return (
    <section className="queue">
      <form
        className="add"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a song or playlist link"
        />
        <button type="submit">Add</button>
      </form>
      {note && <p className="note">{note}</p>}

      <div className="queue-head">
        <h2>Queue</h2>
        <span className="muted">
          {total === 0
            ? 'empty'
            : `${queue.length} up next${played.length ? ` · ${played.length} played` : ''} · drag to reorder`}
        </span>
        {total > 0 && (
          <input
            className="filter"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="🔍 Search the queue"
            aria-label="Search the queue"
          />
        )}
        {total > 0 && (
          <button
            className="link"
            onClick={() => {
              if (!confirm('Clear the whole queue, played songs too?')) return
              setQueue(() => [])
              setPlayed(() => [])
            }}
          >
            Clear all
          </button>
        )}
      </div>

      <ol
        className="tracks"
        onDragOver={(e) => {
          e.preventDefault()
          setOverIndex(queue.length)
        }}
        onDragLeave={() => setOverIndex(null)}
        onDrop={(e) => handleDrop(e, queue.length)}
      >
        {total === 0 && (
          <li className="empty">Songs land here. You can also drag a link in from a YouTube tab.</li>
        )}
        {total > 0 && shown.length + shownPlayed.length === 0 && <li className="empty">No song matching “{filter}” in the queue.</li>}
        {shown.map(({ t, i }) => (
          <li
            key={t.uid}
            className={`track ${overIndex === i ? 'drop-before' : ''}`}
            draggable
            onDragStart={(e) => startTrackDrag(e, t.uid)}
            onDragOver={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOverIndex(i)
            }}
            onDrop={(e) => {
              e.stopPropagation()
              handleDrop(e, i)
            }}
          >
            <span className="grip">⋮⋮</span>
            <img src={thumbnail(t.videoId)} alt="" loading="lazy" />
            <span className="t-title">
              {i === 0 && <span className="next-pill">next</span>}
              {t.title}
              {t.by && <span className="by"> · from {t.by}</span>}
            </span>
            <span className="t-actions">
              <button onClick={() => onSendToDeck(t.uid, 'A')} title="Load on deck A">A</button>
              <button onClick={() => onSendToDeck(t.uid, 'B')} title="Load on deck B">B</button>
              <button onClick={() => setQueue((q) => q.filter((x) => x.uid !== t.uid))} title="Remove">
                ×
              </button>
            </span>
          </li>
        ))}
        {shownPlayed.map((t) => (
          <li key={t.uid} className="track is-played" draggable onDragStart={(e) => startTrackDrag(e, t.uid)}>
            <span className="grip">⋮⋮</span>
            <img src={thumbnail(t.videoId)} alt="" loading="lazy" />
            <span className="t-title">
              <span className="played-pill">played</span>
              {t.title}
              {t.by && <span className="by"> · from {t.by}</span>}
            </span>
            <span className="t-actions">
              <button onClick={() => onSendToDeck(t.uid, 'A')} title="Load on deck A">A</button>
              <button onClick={() => onSendToDeck(t.uid, 'B')} title="Load on deck B">B</button>
              <button onClick={() => setPlayed((p) => p.filter((x) => x.uid !== t.uid))} title="Remove">
                ×
              </button>
            </span>
          </li>
        ))}
      </ol>


    </section>
  )
}

// lowercase and without š, č, ć, ž, đ, so "saulic" finds "Šaulić"
function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/đ/g, 'dj')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}
