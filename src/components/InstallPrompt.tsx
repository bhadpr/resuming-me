import { useEffect, useState } from 'react'
import {
  INSTALL_DISMISS_KEY,
  isLikelyIosSafari,
  isStandaloneDisplay,
  readDismissedFlag,
  shouldShowInstallTip,
  writeDismissedFlag,
} from '../lib/onboarding'

/** Soft tip for iOS Safari users who haven't installed to Home Screen yet. */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(
      shouldShowInstallTip({
        dismissed: readDismissedFlag(INSTALL_DISMISS_KEY),
        standalone: isStandaloneDisplay(),
        iosSafari: isLikelyIosSafari(),
      }),
    )
  }, [])

  if (!visible) return null

  return (
    <div className="install-prompt" role="status">
      <p>
        Add Resuming to your Home Screen so data stays available after idle time —
        Share → <strong>Add to Home Screen</strong>.
      </p>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          writeDismissedFlag(INSTALL_DISMISS_KEY, true)
          setVisible(false)
        }}
      >
        Dismiss
      </button>
    </div>
  )
}
