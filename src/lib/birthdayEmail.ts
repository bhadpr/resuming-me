export const BIRTHDAY_AWAY_DAYS = 30

export function birthdayEmailCopy(): { subject: string; text: string } {
  return {
    subject: 'Happy birthday',
    text: 'Happy birthday. One small thing today is enough.',
  }
}
