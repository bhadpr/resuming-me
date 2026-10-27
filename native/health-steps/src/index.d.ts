import type { Plugin } from '@capacitor/core'

export interface HealthStepsPlugin extends Plugin {
  availability(): Promise<{ available: boolean }>
  authorization(): Promise<{ asked: boolean }>
  requestAuthorization(): Promise<void>
  query(options: { start: string; end: string }): Promise<{ days: { date: string; steps: number }[] }>
}

export declare const HealthSteps: HealthStepsPlugin
