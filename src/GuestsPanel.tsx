import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { guestUrl } from './guests'

export function GuestsPanel({ onClose }: { onClose(): void }) {
  const url = guestUrl()
  const [qr, setQr] = useState('')
  const reachable = !url.includes('localhost')

  useEffect(() => {
    QRCode.toDataURL(url, { width: 640, margin: 1 }).then(setQr)
  }, [url])

  return (
    <div className="overlay" onClick={onClose}>
      <div className="qr-card" onClick={(e) => e.stopPropagation()}>
        <h2>Scan to play your song</h2>
        {qr && <img className="qr" src={qr} alt="QR code for guests" />}
        <p className="qr-url">{url}</p>
        <p className="muted">
          {reachable
            ? 'Guests need to be on the same WiFi as this laptop. Their songs go to the end of the list.'
            : "Can't find this laptop's WiFi address, so phones won't be able to open the page."}
        </p>
        <button onClick={onClose}>Close</button>
      </div>
    </div>
  )
}
