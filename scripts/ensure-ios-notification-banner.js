import { readFileSync, writeFileSync } from 'node:fs'

const path =
  'node_modules/@capacitor/local-notifications/ios/Sources/LocalNotificationsPlugin/LocalNotificationsHandler.swift'

let text
try {
  text = readFileSync(path, 'utf8')
} catch {
  process.exit(0)
}

if (text.includes('.banner')) process.exit(0)

const needle = `        return [
            .badge,
            .sound,
            .alert
        ]`

const replacement = `        if #available(iOS 14.0, *) {
            return [.banner, .list, .sound, .badge]
        }
        return [
            .badge,
            .sound,
            .alert
        ]`

if (!text.includes(needle)) {
  console.error('iOS notification banner layout changed; the banner was not added.')
  process.exit(1)
}

writeFileSync(path, text.replace(needle, replacement))
