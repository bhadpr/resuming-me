import { describe, it, expect } from 'vitest'
import { isSupabaseConfigured } from './supabase'

describe('supabase client config', () => {
  it('reports unconfigured or configured as a boolean', () => {
    expect(typeof isSupabaseConfigured()).toBe('boolean')
  })
})
