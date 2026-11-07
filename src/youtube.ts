/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady?: () => void
  }
}

// by: guest name, when the song was sent from a phone
export type Track = { uid: string; videoId: string; title: string; by?: string }

export const PLAYING = 1
export const ENDED = 0

let apiPromise: Promise<any> | null = null

export function loadYouTubeApi(): Promise<any> {
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT)
    window.onYouTubeIframeAPIReady = () => resolve(window.YT)
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    document.head.appendChild(script)
  })
  return apiPromise
}

export function parseVideoId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const url = new URL(s)
    if (url.hostname === 'youtu.be') return url.pathname.slice(1, 12) || null
    if (url.hostname.endsWith('youtube.com')) {
      const v = url.searchParams.get('v')
      if (v) return v
      const m = url.pathname.match(/\/(shorts|embed|live)\/([\w-]{11})/)
      if (m) return m[2]
    }
  } catch {
    // not a URL
  }
  return null
}

// any link with list=..., also a song opened inside a playlist
export function parsePlaylistId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    if (!url.hostname.endsWith('youtube.com') && url.hostname !== 'youtu.be') return null
    return url.searchParams.get('list')
  } catch {
    return null
  }
}

export async function fetchPlaylist(listId: string): Promise<Track[]> {
  const res = await fetch(`/api/playlist?list=${encodeURIComponent(listId)}`)
  const json: { songs: { videoId: string; title: string }[] } = await res.json()
  return json.songs.map((s) => makeTrack(s.videoId, s.title))
}

export function makeTrack(videoId: string, title?: string): Track {
  return { uid: Math.random().toString(36).slice(2) + Date.now().toString(36), videoId, title: title ?? 'Loading title…' }
}

export async function fetchTitle(videoId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`)
    const json = await res.json()
    return typeof json.title === 'string' ? json.title : null
  } catch {
    return null
  }
}



export const thumbnail = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
