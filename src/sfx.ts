// Party sound effects in public/sounds. Free clips from mixkit.co (Mixkit Sound Effects Free License), horn, applause and drums from pixabay.com

let ctx: AudioContext | null = null
let master: GainNode | null = null
const buffers = new Map<string, Promise<AudioBuffer>>()

function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') ctx.resume()
  return { ctx, out: master! }
}

function load(file: string) {
  let buffer = buffers.get(file)
  if (!buffer) {
    buffer = fetch(`/sounds/${file}`)
      .then((res) => res.arrayBuffer())
      .then((data) => audio().ctx.decodeAudioData(data))
    buffers.set(file, buffer)
  }
  return buffer
}

export function preloadEffects() {
  for (const e of EFFECTS) load(e.file).catch(() => buffers.delete(e.file))
}

export function setEffectsVolume(v: number) {
  audio().out.gain.value = v
}

// maxSeconds cuts long clips short with a one second fade out
export async function playEffect(file: string, maxSeconds?: number) {
  const { ctx, out } = audio()
  const src = ctx.createBufferSource()
  src.buffer = await load(file)
  const gain = ctx.createGain()
  src.connect(gain).connect(out)
  const now = ctx.currentTime
  src.start(now)
  if (maxSeconds && src.buffer.duration > maxSeconds) {
    gain.gain.setValueAtTime(1, now + maxSeconds - 1)
    gain.gain.linearRampToValueAtTime(0, now + maxSeconds)
    src.stop(now + maxSeconds)
  }
}

export const EFFECTS = [
  { key: '1', emoji: '📯', label: 'Horn', file: 'horn.mp3' },
  { key: '2', emoji: '👏', label: 'Applause', file: 'applause.mp3', maxSeconds: 6 },
  { key: '3', emoji: '🥁', label: 'Drums', file: 'drums.mp3', maxSeconds: 8 },
  { key: '4', emoji: '💥', label: 'Ba dum tss', file: 'badumtss.mp3' },
  { key: '5', emoji: '🎧', label: 'Scratch', file: 'scratch.mp3' },
  { key: '6', emoji: '🎺', label: 'Fail', file: 'fail.mp3' },
]
