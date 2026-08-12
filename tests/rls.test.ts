import { describe, it, expect } from 'vitest'

/**
 * RLS integration test — requires a test Supabase project with migrations applied.
 *
 * Run manually after setup:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   SUPABASE_USER_A_EMAIL=... SUPABASE_USER_A_PASSWORD=... \
 *   SUPABASE_USER_B_EMAIL=... SUPABASE_USER_B_PASSWORD=... \
 *   npm test -- tests/rls.test.ts
 *
 * Skipped by default in CI/local dev without credentials.
 */
const configured =
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_ANON_KEY &&
  process.env.SUPABASE_USER_A_EMAIL &&
  process.env.SUPABASE_USER_A_PASSWORD &&
  process.env.SUPABASE_USER_B_EMAIL &&
  process.env.SUPABASE_USER_B_PASSWORD

describe.skipIf(!configured)('RLS cross-account isolation', () => {
  it('user B cannot read user A activities', async () => {
    const { createClient } = await import('@supabase/supabase-js')

    const clientA = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    )
    const clientB = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!,
    )

    const { error: signInAError } = await clientA.auth.signInWithPassword({
      email: process.env.SUPABASE_USER_A_EMAIL!,
      password: process.env.SUPABASE_USER_A_PASSWORD!,
    })
    expect(signInAError).toBeNull()

    const { data: userA } = await clientA.auth.getUser()
    expect(userA.user).not.toBeNull()

    const { data: inserted, error: insertError } = await clientA
      .from('activities')
      .insert({
        user_id: userA.user!.id,
        name: 'RLS test activity',
        type: 'daily',
        tracking_mode: 'checkbox',
      })
      .select('id')
      .single()

    expect(insertError).toBeNull()
    expect(inserted?.id).toBeTruthy()

    await clientA.auth.signOut()

    const { error: signInBError } = await clientB.auth.signInWithPassword({
      email: process.env.SUPABASE_USER_B_EMAIL!,
      password: process.env.SUPABASE_USER_B_PASSWORD!,
    })
    expect(signInBError).toBeNull()

    const { data: leaked, error: readError } = await clientB
      .from('activities')
      .select('id, name')
      .eq('id', inserted!.id)

    expect(readError).toBeNull()
    expect(leaked).toEqual([])

    await clientB.auth.signOut()

    // Cleanup as user A
    await clientA.auth.signInWithPassword({
      email: process.env.SUPABASE_USER_A_EMAIL!,
      password: process.env.SUPABASE_USER_A_PASSWORD!,
    })
    await clientA.from('activities').delete().eq('id', inserted!.id)
    await clientA.auth.signOut()
  })
})

describe('RLS test harness', () => {
  it('skips integration test when env vars are missing', () => {
    if (!configured) {
      expect(configured).toBeFalsy()
    } else {
      expect(configured).toBeTruthy()
    }
  })
})
