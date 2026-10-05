/** Common Ayurvedic bottles. Aliases let a short typed name still match. */
const AYURVEDIC_MEDICINES: { name: string; aliases: string[] }[] = [
  { name: 'Ashwagandha', aliases: ['withania'] },
  { name: 'Triphala', aliases: [] },
  { name: 'Chyawanprash', aliases: ['chyavanprash'] },
  { name: 'Brahmi', aliases: ['bacopa'] },
  { name: 'Shatavari', aliases: [] },
  { name: 'Giloy', aliases: ['guduchi', 'gudoochi'] },
  { name: 'Tulsi', aliases: ['tulasi'] },
  { name: 'Amla', aliases: ['amalaki'] },
  { name: 'Neem', aliases: ['nimba'] },
  { name: 'Arjuna', aliases: ['arjunarishta'] },
  { name: 'Dashmool', aliases: ['dashamool', 'dashmularishta'] },
  { name: 'Avipattikar', aliases: [] },
  { name: 'Sitopaladi', aliases: [] },
  { name: 'Trikatu', aliases: [] },
  { name: 'Yashtimadhu', aliases: ['mulethi'] },
  { name: 'Shankhpushpi', aliases: ['shankhapushpi'] },
  { name: 'Punarnava', aliases: [] },
  { name: 'Arogyavardhini', aliases: [] },
  { name: 'Kaishore Guggulu', aliases: ['kishore guggulu', 'guggulu'] },
  { name: 'Hingvastak', aliases: ['hingwashtak'] },
]

/** Up to 20 Ayurvedic names that match what they have typed so far. */
export function ayurvedicSuggestions(query: string, limit = 20): string[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const ranked = AYURVEDIC_MEDICINES.flatMap((item) => {
    const name = item.name.toLowerCase()
    const aliases = item.aliases.map((alias) => alias.toLowerCase())
    const starts = name.startsWith(q) || aliases.some((alias) => alias.startsWith(q))
    const contains = name.includes(q) || aliases.some((alias) => alias.includes(q))
    if (!starts && !contains) return []
    return [{ name: item.name, rank: starts ? 0 : 1 }]
  })
  ranked.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
  return ranked.slice(0, limit).map((item) => item.name)
}
