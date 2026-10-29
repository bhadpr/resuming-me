import { describe, expect, it } from 'vitest'
import { accountIsGone, messageForSharedListAdd } from './importSharedList'

const connection = 'Could not add them. Check your connection and try again.'
const unavailable = 'This list is no longer available.'

describe('accountIsGone', () => {
  it('recognizes a sign-in the server no longer has', () => {
    expect(
      accountIsGone({
        message:
          'insert or update on table "shared_list_accepts" violates foreign key constraint "shared_list_accepts_user_id_fkey"',
      }),
    ).toBe(true)
    expect(
      accountIsGone({
        message: 'insert or update on table "profiles" violates foreign key constraint "profiles_id_fkey"',
      }),
    ).toBe(true)
  })
})

describe('messageForSharedListAdd', () => {
  it('keeps a lost connection as the connection sentence', () => {
    expect(messageForSharedListAdd(new Error('TypeError: Load failed'), connection, unavailable)).toBe(connection)
  })

  it('says when the list itself is gone', () => {
    expect(messageForSharedListAdd(new Error('shared_list_unavailable'), connection, unavailable)).toBe(unavailable)
  })

  it('shows a database message, including a stale sign-in', () => {
    expect(messageForSharedListAdd(new Error('Sign in again, then save.'), connection, unavailable)).toBe(
      'Sign in again, then save.',
    )
    expect(
      messageForSharedListAdd(
        { message: 'insert or update on table "reminders" violates foreign key constraint "reminders_user_id_fkey"' },
        connection,
        unavailable,
      ),
    ).toContain('reminders_user_id_fkey')
  })
})
