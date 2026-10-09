import { Capacitor } from '@capacitor/core'

/** Big phone photos are shrunk before they cross into the Android app, so the hand-off stays quick. */
const NATIVE_MAX_SIDE = 2048
const NATIVE_SHRINK_ABOVE_BYTES = 1_500_000
const SHARE_FILE_PREFIX = 'share-photo-'

export type PhotoShareResult = 'shared' | 'cancelled' | 'needsTap'

/** iPadOS reports itself as a Mac, so touch decides there. */
function isPhoneOrTablet(): boolean {
  const hints = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData
  if (hints?.mobile) return true
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)) return true
  return /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1
}

/**
 * Whether this app or browser can hand a photo to WhatsApp through the share sheet.
 * A desktop share sheet rarely lists WhatsApp, so desktops copy the photo instead.
 */
export function canSharePhoto(file: File): boolean {
  if (Capacitor.isNativePlatform()) return true
  if (!isPhoneOrTablet()) return false
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function readAsBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''))
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the photo'))
    reader.readAsDataURL(blob)
  })
}

async function shrinkPhoto(file: File): Promise<{ blob: Blob; extension: string }> {
  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  if (file.size <= NATIVE_SHRINK_ABOVE_BYTES) return { blob: file, extension }
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, NATIVE_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ? { blob, extension: 'jpg' } : { blob: file, extension }
  } catch {
    return { blob: file, extension }
  }
}

/** Browsers only take PNG images on the clipboard. */
async function asClipboardPng(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, NATIVE_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('Could not copy the photo')
  return blob
}

/**
 * Copies the photo so it can be pasted into a WhatsApp chat. Call it straight from the tap,
 * before anything else is awaited or a window is opened: the browser needs the page focused.
 */
export async function copyPhotoToClipboard(file: File): Promise<boolean> {
  if (typeof ClipboardItem === 'undefined' || typeof navigator.clipboard?.write !== 'function') return false
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': asClipboardPng(file) })])
    return true
  } catch {
    return false
  }
}

async function shareOnAndroid(file: File, text: string): Promise<PhotoShareResult> {
  const [{ Directory, Filesystem }, { Share }] = await Promise.all([
    import('@capacitor/filesystem'),
    import('@capacitor/share'),
  ])
  try {
    const { files } = await Filesystem.readdir({ path: '', directory: Directory.Cache })
    await Promise.all(
      files
        .filter((entry) => entry.name.startsWith(SHARE_FILE_PREFIX))
        .map((entry) => Filesystem.deleteFile({ path: entry.name, directory: Directory.Cache }).catch(() => {})),
    )
  } catch {
    /* an old photo left in the cache is harmless */
  }
  const { blob, extension } = await shrinkPhoto(file)
  const saved = await Filesystem.writeFile({
    path: `${SHARE_FILE_PREFIX}${Date.now()}.${extension}`,
    data: await readAsBase64(blob),
    directory: Directory.Cache,
  })
  try {
    await Share.share({ text, files: [saved.uri] })
    return 'shared'
  } catch (err) {
    if (err instanceof Error && /cancel/i.test(err.message)) return 'cancelled'
    throw err
  }
}

/**
 * Opens the share sheet with the photo, and the message as its caption. The photo goes
 * straight to the other app; it is never uploaded to Resuming.
 */
export async function sharePhotoWithText(file: File, text: string): Promise<PhotoShareResult> {
  if (Capacitor.isNativePlatform()) return shareOnAndroid(file, text)
  try {
    await navigator.share({ files: [file], text })
    return 'shared'
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled'
    if (err instanceof DOMException && err.name === 'NotAllowedError') return 'needsTap'
    throw err
  }
}
