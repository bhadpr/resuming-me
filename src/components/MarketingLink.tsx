import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { marketingInstallLink } from '../lib/marketing'

export function MarketingLink({
  groupCode,
  memberCode,
}: {
  groupCode: string
  memberCode: string
}) {
  const link = marketingInstallLink(groupCode, memberCode)
  const [src, setSrc] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancel = false
    void QRCode.toDataURL(link, { margin: 1, width: 280 }).then((url) => {
      if (!cancel) setSrc(url)
    })
    return () => {
      cancel = true
    }
  }, [link])

  return (
    <div className="marketing-link">
      {src ? <img className="marketing-qr" src={src} alt="" /> : null}
      <p className="activity-desc marketing-url">{link}</p>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => {
          void navigator.clipboard.writeText(link).then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? 'Copied' : 'Copy link'}
      </button>
    </div>
  )
}
