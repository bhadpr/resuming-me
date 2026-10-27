import { registerPlugin } from '@capacitor/core'

export interface HealthStepsPlugin {
  availability(): Promise<{ available: boolean }>
  authorization(): Promise<{ asked: boolean }>
  requestAuthorization(): Promise<void>
  query(options: { start: string; end: string }): Promise<{ days: { date: string; steps: number }[] }>
}

export const HealthSteps = registerPlugin<HealthStepsPlugin>('HealthSteps')
