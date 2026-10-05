import { todayLocalDate } from './dates'
import { earnedRupees } from './marketing'
import { createSupabaseClient } from './supabase'

export interface MarketingGroup {
  id: string
  name: string
  code: string
  install_goal: number
  install_rate_rupees: number
  retained_rate_rupees: number
  cap_rupees: number | null
  min_payout_installs: number
}

export interface MarketingMember {
  id: string
  group_id: string
  email: string
  code: string
  removed_at: string | null
}

export interface MarketingPayment {
  id: string
  group_id: string
  member_id: string | null
  paid_on: string
  amount_rupees: number
  note: string
  paid: boolean
}

export interface MarketingCounts {
  installs: number
  in_progress: number
  retained: number
  ended_short: number
}

const EMPTY_COUNTS: MarketingCounts = {
  installs: 0,
  in_progress: 0,
  retained: 0,
  ended_short: 0,
}

export function emptyCounts(): MarketingCounts {
  return { ...EMPTY_COUNTS }
}

export function addCounts(left: MarketingCounts, right: MarketingCounts): MarketingCounts {
  return {
    installs: left.installs + right.installs,
    in_progress: left.in_progress + right.in_progress,
    retained: left.retained + right.retained,
    ended_short: left.ended_short + right.ended_short,
  }
}

export async function fetchMarketingAdmin(): Promise<{
  groups: MarketingGroup[]
  members: MarketingMember[]
  payments: MarketingPayment[]
  counts: Map<string, MarketingCounts>
  warning: string | null
}> {
  const client = createSupabaseClient()
  const { data: sessionWrap, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionWrap.session) throw new Error('Sign in again to load groups.')

  const asOf = todayLocalDate()
  const groupsRes = await client
    .from('marketing_groups')
    .select(
      'id, name, code, install_goal, install_rate_rupees, retained_rate_rupees, cap_rupees, min_payout_installs',
    )
    .order('name')
  if (groupsRes.error) throw groupsRes.error

  const [membersRes, paymentsRes, countsRes] = await Promise.all([
    client
      .from('marketing_members')
      .select('id, group_id, email, code, removed_at')
      .order('email'),
    client
      .from('marketing_payments')
      .select('id, group_id, member_id, paid_on, amount_rupees, note, paid')
      .order('paid_on', { ascending: false }),
    client.rpc('marketing_admin_counts', { p_as_of: asOf }),
  ])

  const counts = new Map<string, MarketingCounts>()
  const countRows = Array.isArray(countsRes.data) ? countsRes.data : []
  for (const row of countRows) {
    counts.set(countKey(row.group_id, row.member_id), {
      installs: Number(row.installs) || 0,
      in_progress: Number(row.in_progress) || 0,
      retained: Number(row.retained) || 0,
      ended_short: Number(row.ended_short) || 0,
    })
  }

  const warning =
    membersRes.error?.message ?? paymentsRes.error?.message ?? countsRes.error?.message ?? null

  return {
    groups: groupsRes.data ?? [],
    members: membersRes.error ? [] : (membersRes.data ?? []),
    payments: paymentsRes.error ? [] : (paymentsRes.data ?? []),
    counts,
    warning,
  }
}

export function countKey(groupId: string, memberId: string | null): string {
  return `${groupId}:${memberId ?? ''}`
}

export function groupCounts(
  counts: Map<string, MarketingCounts>,
  groupId: string,
): MarketingCounts {
  let total = emptyCounts()
  for (const [key, value] of counts) {
    if (key.startsWith(`${groupId}:`)) total = addCounts(total, value)
  }
  return total
}

export interface MyMarketingGroup {
  group: MarketingGroup
  memberCode: string
  counts: MarketingCounts
  mine: MarketingCounts
}

export async function fetchMyMarketingGroups(): Promise<MyMarketingGroup[]> {
  const client = createSupabaseClient()
  const { data: sessionWrap, error: sessionError } = await client.auth.getSession()
  if (sessionError) throw sessionError
  if (!sessionWrap.session) return []
  const { data, error } = await client.rpc('marketing_my_stats', { p_as_of: todayLocalDate() })
  if (error) throw error
  return (data ?? []).map((row) => ({
    group: {
      id: row.group_id,
      name: row.group_name,
      code: row.group_code,
      install_goal: row.install_goal,
      install_rate_rupees: row.install_rate_rupees,
      retained_rate_rupees: row.retained_rate_rupees,
      cap_rupees: row.cap_rupees,
      min_payout_installs: row.min_payout_installs,
    },
    memberCode: row.member_code,
    counts: {
      installs: row.group_installs,
      in_progress: row.group_in_progress,
      retained: row.group_retained,
      ended_short: row.group_ended_short,
    },
    mine: {
      installs: row.my_installs,
      in_progress: row.my_in_progress,
      retained: row.my_retained,
      ended_short: row.my_ended_short,
    },
  }))
}

export function memberEarned(group: MarketingGroup, counts: MarketingCounts): number {
  return earnedRupees(
    counts.installs,
    counts.retained,
    group.install_rate_rupees,
    group.retained_rate_rupees,
    group.cap_rupees,
    group.min_payout_installs,
  )
}

export async function createMarketingGroup(input: {
  name: string
  installGoal: number
  installRate: number
  retainedRate: number
  cap: number | null
  minPayoutInstalls: number
}): Promise<void> {
  const { error } = await createSupabaseClient().from('marketing_groups').insert({
    name: input.name.trim(),
    code: '',
    install_goal: input.installGoal,
    install_rate_rupees: input.installRate,
    retained_rate_rupees: input.retainedRate,
    cap_rupees: input.cap,
    min_payout_installs: input.minPayoutInstalls,
  })
  if (error) throw error
}

export async function addMarketingMember(groupId: string, email: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('marketing_add_member', {
    p_group_id: groupId,
    p_email: email.trim(),
  })
  if (error) throw error
}

export async function removeMarketingMember(memberId: string): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('marketing_members')
    .update({ removed_at: new Date().toISOString() })
    .eq('id', memberId)
  if (error) throw error
}

export async function saveMarketingPayment(input: {
  groupId: string
  memberId: string | null
  paidOn: string
  amount: number
  note: string
  paid: boolean
}): Promise<void> {
  const { error } = await createSupabaseClient().from('marketing_payments').insert({
    group_id: input.groupId,
    member_id: input.memberId,
    paid_on: input.paidOn,
    amount_rupees: input.amount,
    note: input.note.trim(),
    paid: input.paid,
  })
  if (error) throw error
}

export async function setMarketingPaymentPaid(paymentId: string, paid: boolean): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('marketing_payments')
    .update({ paid })
    .eq('id', paymentId)
  if (error) throw error
}
