import type { DragEvent } from 'react'
import { parseVideoId } from './youtube'

const UID_TYPE = 'application/x-party-track'

export function startTrackDrag(e: DragEvent, uid: string) {
  e.dataTransfer.setData(UID_TYPE, uid)
  e.dataTransfer.effectAllowed = 'move'
}

// A drop is either a track from our list, or a YouTube link dragged in from another tab
export function readDrop(e: DragEvent): { uid: string } | { videoId: string } | null {
  const uid = e.dataTransfer.getData(UID_TYPE)
  if (uid) return { uid }
  const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')
  const videoId = text ? parseVideoId(text.split('\n')[0]) : null
  return videoId ? { videoId } : null
}
