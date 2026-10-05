// Shared with supabase/functions/send-check-ins, so no imports.

export type ReminderEmailItem = { text: string; hour: number | null; minute: number | null }

type Copy = {
  subjectOne: string
  subjectMany: string
  intro: string
  outro: string
  open: string
  off: string
}

const COPY: Record<string, Copy> = {
  en: {
    subjectOne: 'Today: {text}',
    subjectMany: '{count} reminders today',
    intro: "Today's reminders:",
    outro: 'Mark them done in the app when you can.',
    open: 'Open Today',
    off: 'Turn off emails from Resuming',
  },
  hi: {
    subjectOne: 'आज: {text}',
    subjectMany: 'आज {count} याद',
    intro: 'आज की याद:',
    outro: 'हो जाने पर ऐप में हो गया दबाएँ।',
    open: 'आज खोलें',
    off: 'Resuming के ईमेल बंद करें',
  },
  te: {
    subjectOne: 'ఈరోజు: {text}',
    subjectMany: 'ఈరోజు {count} గుర్తులు',
    intro: 'ఈరోజు గుర్తులు:',
    outro: 'అయ్యాక యాప్‌లో అయింది నొక్కండి.',
    open: 'ఈరోజు తెరవండి',
    off: 'Resuming ఈమెయిల్స్ ఆపండి',
  },
  gu: {
    subjectOne: 'આજે: {text}',
    subjectMany: 'આજે {count} યાદ',
    intro: 'આજની યાદ:',
    outro: 'થઈ જાય ત્યારે ઍપમાં થયું દબાવો.',
    open: 'આજ ખોલો',
    off: 'Resuming ના ઈમેલ બંધ કરો',
  },
  mr: {
    subjectOne: 'आज: {text}',
    subjectMany: 'आज {count} आठवणी',
    intro: 'आजच्या आठवणी:',
    outro: 'झाल्यावर ॲपमध्ये झाले दाबा.',
    open: 'आज उघडा',
    off: 'Resuming चे ईमेल बंद करा',
  },
  ta: {
    subjectOne: 'இன்று: {text}',
    subjectMany: 'இன்று {count} நினைவூட்டல்கள்',
    intro: 'இன்றைய நினைவூட்டல்கள்:',
    outro: 'முடிந்ததும் செயலியில் முடிந்தது என்று தட்டுங்கள்.',
    open: 'இன்றைத் திறக்க',
    off: 'Resuming மின்னஞ்சல்களை நிறுத்து',
  },
}

const MARATHI_DIGITS = '०१२३४५६७८९'

function digits(value: string, locale: string): string {
  if (locale !== 'mr') return value
  return value.replace(/[0-9]/g, (digit) => MARATHI_DIGITS[Number(digit)])
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

/** Subject and plain-text body. Links are added by the caller. */
export function reminderEmailCopy(
  locale: string | null | undefined,
  items: readonly ReminderEmailItem[],
  links: { open: string; off: string },
): { subject: string; text: string } {
  const lang = locale && COPY[locale] ? locale : 'en'
  const copy = COPY[lang]
  const subject =
    items.length === 1
      ? copy.subjectOne.replace('{text}', oneLine(items[0].text))
      : digits(copy.subjectMany.replace('{count}', String(items.length)), lang)
  const lines = items.map((item) => {
    const time = item.hour != null && item.minute != null ? `${digits(clock(item.hour, item.minute), lang)} ` : ''
    return `• ${time}${oneLine(item.text)}`
  })
  const text = [
    copy.intro,
    '',
    ...lines,
    '',
    copy.outro,
    '',
    `${copy.open}: ${links.open}`,
    '',
    `${copy.off}: ${links.off}`,
  ].join('\n')
  return { subject, text }
}
