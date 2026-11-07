// Reads a public YouTube playlist page and pulls out its songs, so no API key is needed.
// Runs inside the Vite server (the browser can't read youtube.com directly).

export type PlaylistSong = { videoId: string; title: string }

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36',
  'Accept-Language': 'en',
  // skips the EU cookie consent page
  Cookie: 'SOCS=CAI',
}

// the page shows 100 songs, the rest come in pages of 100 like when you scroll
const MAX_PAGES = 10

type Found = { songs: PlaylistSong[]; next: string | null }

export async function readPlaylist(listId: string): Promise<PlaylistSong[]> {
  const res = await fetch(`https://www.youtube.com/playlist?list=${encodeURIComponent(listId)}`, { headers: HEADERS })
  const html = await res.text()
  const match = html.match(/var ytInitialData = (\{.*?\});<\/script>/s)
  if (!match) throw new Error('playlist not found')
  const clientVersion = html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)?.[1]

  const found: Found = { songs: [], next: null }
  collect(JSON.parse(match[1]), found)

  for (let page = 1; page < MAX_PAGES && found.next && clientVersion; page++) {
    const token = found.next
    found.next = null
    try {
      const more = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
        method: 'POST',
        headers: { ...HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion } }, continuation: token }),
      })
      collect(await more.json(), found)
    } catch {
      break
    }
  }

  const seen = new Set<string>()
  return found.songs.filter((s) => !seen.has(s.videoId) && seen.add(s.videoId))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function collect(node: any, out: Found) {
  if (!node || typeof node !== 'object') return
  const lockup = node.lockupViewModel
  if (lockup?.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO' && lockup.contentId) {
    const title = lockup.metadata?.lockupMetadataViewModel?.title?.content
    out.songs.push({ videoId: lockup.contentId, title: title ?? `YouTube ${lockup.contentId}` })
    return
  }
  // older page layout
  const video = node.playlistVideoRenderer
  if (video?.videoId && video.isPlayable !== false) {
    const title = video.title?.runs?.map((r: { text: string }) => r.text).join('') ?? video.title?.simpleText
    out.songs.push({ videoId: video.videoId, title: title ?? `YouTube ${video.videoId}` })
    return
  }
  // "load more" marker at the end of the song list; the first one found belongs to the songs
  const more = node.continuationItemViewModel ?? node.continuationItemRenderer
  if (more) {
    out.next ??= findToken(more)
    return
  }
  for (const value of Object.values(node)) collect(value, out)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findToken(node: any): string | null {
  if (!node || typeof node !== 'object') return null
  if (typeof node.continuationCommand?.token === 'string') return node.continuationCommand.token
  for (const value of Object.values(node)) {
    const token = findToken(value)
    if (token) return token
  }
  return null
}
