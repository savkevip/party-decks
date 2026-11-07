declare const __LAN_IP__: string | null

export type GuestRequest = { id: number; videoId: string; by: string }

// The address phones on the same WiFi can open. "localhost" only works on this laptop.
export function guestUrl() {
  const { hostname, port, protocol, origin } = window.location
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
  const base = isLocal && __LAN_IP__ ? `${protocol}//${__LAN_IP__}${port ? `:${port}` : ''}` : origin
  return `${base}/?guest`
}

export const isGuestPage = () => new URLSearchParams(window.location.search).has('guest')

export async function sendRequest(videoId: string, by: string) {
  const res = await fetch('/api/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ videoId, by }),
  })
  if (!res.ok) throw new Error('send failed')
}

export async function fetchRequests(after: number): Promise<{ boot: string; items: GuestRequest[] }> {
  const res = await fetch(`/api/requests?after=${after}`)
  if (!res.ok) throw new Error('poll failed')
  return res.json()
}
