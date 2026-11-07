import { useEffect, useState } from 'react'

declare global {
  interface Navigator {
    brave?: { isBrave(): Promise<boolean> }
  }
}

const DISMISSED = 'pd.adTipDismissed'

// Brave blocks YouTube ads, other browsers don't. Premium can't be detected, so the tip mentions it too.
export function AdTip() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return
    } catch {
      // no storage, just show the tip
    }
    const check = navigator.brave?.isBrave() ?? Promise.resolve(false)
    check.then((isBrave) => setShow(!isBrave)).catch(() => setShow(true))
  }, [])

  if (!show) return null

  function dismiss() {
    setShow(false)
    try {
      localStorage.setItem(DISMISSED, '1')
    } catch {
      // fine, it comes back next time
    }
  }

  return (
    <div className="ad-tip" role="status">
      <span>
        📢 YouTube ads can pop up mid-party. For no ads, open this in the <b>Brave</b> browser, or be signed in to{' '}
        <b>YouTube Premium</b>. Or just roll with the ads.
      </span>
      <button onClick={dismiss}>OK, ads are fine</button>
    </div>
  )
}
