import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { MarketingLink } from './MarketingLink'
import { todayLocalDate } from '../lib/dates'
import { formatRupees } from '../lib/marketing'
import {
  addMarketingMember,
  countKey,
  createMarketingGroup,
  emptyCounts,
  fetchMarketingAdmin,
  fetchMyMarketingGroups,
  groupCounts,
  memberEarned,
  type MyMarketingGroup,
  removeMarketingMember,
  saveMarketingPayment,
  setMarketingPaymentPaid,
  type MarketingCounts,
  type MarketingGroup,
  type MarketingMember,
  type MarketingPayment,
} from '../lib/marketingData'
import { Icon } from './Icon'

function message(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    const hint = 'hint' in err && typeof err.hint === 'string' ? err.hint : ''
    return hint ? `${err.message} ${hint}` : err.message
  }
  return 'Something went wrong'
}

function EarnedMath({ group, counts }: { group: MarketingGroup; counts: MarketingCounts }) {
  const installAmount = counts.installs * group.install_rate_rupees
  const retainedAmount = counts.retained * group.retained_rate_rupees
  const count = (value: number) => value.toLocaleString('en-IN')
  return (
    <div className="earned-math">
      <p>
        {count(counts.installs)} installs × {formatRupees(group.install_rate_rupees)} ={' '}
        {formatRupees(installAmount)}
      </p>
      <p>
        {count(counts.retained)} five-day people × {formatRupees(group.retained_rate_rupees)} ={' '}
        {formatRupees(retainedAmount)}
      </p>
    </div>
  )
}

function EarnedTotal({ group, counts }: { group: MarketingGroup; counts: MarketingCounts }) {
  const earned = formatRupees(memberEarned(group, counts))
  const waiting = counts.installs < group.min_payout_installs
  return (
    <p className="earned-total">
      <span className="earned-total-label">Earned</span>{' '}
      <span className="earned-total-amount">{earned}</span>
      {waiting ? (
        <span className="earned-total-note">
          until {group.min_payout_installs.toLocaleString('en-IN')} installs
        </span>
      ) : null}
    </p>
  )
}

function CountBoard({ counts }: { counts: MarketingCounts }) {
  const cards = [
    ['Installs', counts.installs, 'First opens'],
    ['In 30 days', counts.in_progress, 'Under five days so far'],
    ['Five days', counts.retained, 'Five different days'],
    ['Ended short', counts.ended_short, 'Window closed early'],
  ] as const
  return (
    <div className="analytics-overview count-board">
      {cards.map(([label, value, hint]) => (
        <div key={label} className="analytics-stat">
          <span className="analytics-stat-label">{label}</span>
          <span className="analytics-stat-value">{value.toLocaleString('en-IN')}</span>
          <span className="analytics-stat-hint">{hint}</span>
        </div>
      ))}
    </div>
  )
}

export function AdminGroupsScreen({ groupId }: { groupId?: string }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [groups, setGroups] = useState<MarketingGroup[]>([])
  const [members, setMembers] = useState<MarketingMember[]>([])
  const [payments, setPayments] = useState<MarketingPayment[]>([])
  const [counts, setCounts] = useState<Map<string, MarketingCounts>>(new Map())
  const [mine, setMine] = useState<MyMarketingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const board = await fetchMarketingAdmin()
    setGroups(board.groups)
    setMembers(board.members)
    setPayments(board.payments)
    setCounts(board.counts)
    setError(board.warning)
    if (board.groups.length > 0) {
      setMine([])
      return
    }
    setMine(await fetchMyMarketingGroups())
  }, [])

  useEffect(() => {
    if (!user) return
    let cancel = false
    setLoading(true)
    void reload()
      .catch((err) => {
        if (!cancel) setError(message(err))
      })
      .finally(() => {
        if (!cancel) setLoading(false)
      })
    return () => {
      cancel = true
    }
  }, [reload, user])

  const selected = groupId ? (groups.find((group) => group.id === groupId) ?? null) : null
  const selectedMine = groupId ? (mine.find((row) => row.group.id === groupId) ?? null) : null

  async function run(action: () => Promise<void>): Promise<boolean> {
    setError(null)
    try {
      await action()
      await reload()
      return true
    } catch (err) {
      setError(message(err))
      return false
    }
  }

  if (loading) {
    return (
      <div className="analytics-screen">
        <p className="screen-sub settings-lead">Loading groups…</p>
      </div>
    )
  }

  return (
    <div className="analytics-screen">
      {error ? <p className="error">{error}</p> : null}
      {groupId && !selected && !selectedMine ? (
        <>
          <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/admin/groups')}>
            <Icon name="back" />
            All groups
          </button>
          <p className="screen-sub">That group is not on this account.</p>
        </>
      ) : selectedMine ? (
        <MemberGroupDetail row={selectedMine} onBack={() => navigate('/admin/groups')} />
      ) : selected ? (
        <GroupDetail
          group={selected}
          members={members.filter((member) => member.group_id === selected.id)}
          payments={payments.filter((payment) => payment.group_id === selected.id)}
          counts={counts}
          onBack={() => navigate('/admin/groups')}
          onRun={run}
        />
      ) : (
        mine.length > 0 ? (
          <MemberGroupList rows={mine} onOpen={(id) => navigate(`/admin/groups/${id}`)} />
        ) : (
          <GroupList
            groups={groups}
            members={members}
            counts={counts}
            onOpen={(id) => navigate(`/admin/groups/${id}`)}
            onCreate={(input) => void run(() => createMarketingGroup(input))}
          />
        )
      )}
    </div>
  )
}

function MemberNumbers({ row }: { row: MyMarketingGroup }) {
  return (
    <>
      <h2 className="activity-name">{row.group.name}</h2>
      <CountBoard counts={row.counts} />
      <EarnedMath group={row.group} counts={row.counts} />
      <EarnedTotal group={row.group} counts={row.counts} />
      <h3 className="section-label">Your link</h3>
      <MarketingLink groupCode={row.group.code} memberCode={row.memberCode} />
    </>
  )
}

function MemberGroupList({
  rows,
  onOpen,
}: {
  rows: MyMarketingGroup[]
  onOpen: (id: string) => void
}) {
  return (
    <ul className="admin-feedback-list">
      {rows.map((row) => (
        <li key={row.group.id} className="admin-feedback-card">
          <MemberNumbers row={row} />
          <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpen(row.group.id)}>
            Open {row.group.name}
          </button>
        </li>
      ))}
    </ul>
  )
}

function MemberGroupDetail({ row, onBack }: { row: MyMarketingGroup; onBack: () => void }) {
  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" />
        Groups
      </button>
      <MemberNumbers row={row} />
    </>
  )
}

function MemberRoster({ members }: { members: MarketingMember[] }) {
  const people = members.filter((member) => !member.removed_at)
  return (
    <div className="group-roster">
      <h3 className="section-label">Members</h3>
      {people.length === 0 ? (
        <p className="activity-desc">No members yet.</p>
      ) : (
        <ul className="group-roster-list">
          {people.map((member) => (
            <li key={member.id}>{member.email}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

function GroupList({
  groups,
  members,
  counts,
  onOpen,
  onCreate,
}: {
  groups: MarketingGroup[]
  members: MarketingMember[]
  counts: Map<string, MarketingCounts>
  onOpen: (id: string) => void
  onCreate: (input: {
    name: string
    installGoal: number
    installRate: number
    retainedRate: number
    cap: number | null
    minPayoutInstalls: number
  }) => void
}) {
  const [name, setName] = useState('')
  const [goal, setGoal] = useState('1000')
  const [installRate, setInstallRate] = useState('5')
  const [retainedRate, setRetainedRate] = useState('50')
  const [cap, setCap] = useState('')
  const [minInstalls, setMinInstalls] = useState('500')

  function submit(event: FormEvent) {
    event.preventDefault()
    const installGoal = Number(goal)
    const install = Number(installRate)
    const retained = Number(retainedRate)
    const minimum = Number(minInstalls)
    if (!name.trim() || !Number.isInteger(installGoal) || installGoal < 1) return
    if (!Number.isInteger(install) || install < 0) return
    if (!Number.isInteger(retained) || retained < 0) return
    if (!Number.isInteger(minimum) || minimum < 0) return
    const capValue = cap.trim() === '' ? null : Number(cap)
    if (capValue != null && (!Number.isInteger(capValue) || capValue < 0)) return
    onCreate({
      name,
      installGoal,
      installRate: install,
      retainedRate: retained,
      cap: capValue,
      minPayoutInstalls: minimum,
    })
    setName('')
  }

  return (
    <>
      <p className="screen-sub settings-lead">
        Each group has its own numbers page. Open one for the Play link, members, and payments.
      </p>
      {groups.length === 0 ? (
        <p className="screen-sub">No groups yet.</p>
      ) : (
        <ul className="admin-feedback-list">
          {groups.map((group) => {
            const tally = groupCounts(counts, group.id)
            return (
              <li key={group.id} className="admin-feedback-card">
                <h2 className="activity-name">{group.name}</h2>
                <CountBoard counts={tally} />
                <EarnedMath group={group} counts={tally} />
                <EarnedTotal group={group} counts={tally} />
                <MemberRoster members={members.filter((member) => member.group_id === group.id)} />
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpen(group.id)}>
                  Open {group.name}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <form className="today-section group-create stacked-form" onSubmit={submit}>
        <h3 className="section-label">New group</h3>
        <label className="field">
          <span className="field-label">Name</span>
          <input className="field-input" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Install goal</span>
          <input className="field-input" inputMode="numeric" value={goal} onChange={(event) => setGoal(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Minimum installs before pay</span>
          <input className="field-input" inputMode="numeric" value={minInstalls} onChange={(event) => setMinInstalls(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Rupees per install</span>
          <input className="field-input" inputMode="numeric" value={installRate} onChange={(event) => setInstallRate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Rupees per five-day return</span>
          <input className="field-input" inputMode="numeric" value={retainedRate} onChange={(event) => setRetainedRate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Cap in rupees, optional</span>
          <input className="field-input" inputMode="numeric" value={cap} onChange={(event) => setCap(event.target.value)} />
        </label>
        <button type="submit" className="btn btn-primary">
          Create group
        </button>
      </form>
    </>
  )
}

function GroupDetail({
  group,
  members,
  payments,
  counts,
  onBack,
  onRun,
}: {
  group: MarketingGroup
  members: MarketingMember[]
  payments: MarketingPayment[]
  counts: Map<string, MarketingCounts>
  onBack: () => void
  onRun: (action: () => Promise<void>) => Promise<boolean>
}) {
  const [email, setEmail] = useState('')
  const [amount, setAmount] = useState('')
  const [note, setNote] = useState('')
  const [paidOn, setPaidOn] = useState(todayLocalDate())
  const [payMemberId, setPayMemberId] = useState('')
  const [paid, setPaid] = useState(true)
  const tally = groupCounts(counts, group.id)
  const earned = memberEarned(group, tally)
  const markedPaid = useMemo(
    () => payments.filter((row) => row.paid).reduce((sum, row) => sum + row.amount_rupees, 0),
    [payments],
  )
  const memberName = new Map(members.map((member) => [member.id, member.email]))

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" />
        Groups
      </button>
      <h2 className="activity-name">{group.name}</h2>
      <p className="activity-desc">
        Goal {group.install_goal.toLocaleString('en-IN')} installs. Pay starts at{' '}
        {group.min_payout_installs.toLocaleString('en-IN')} installs. {formatRupees(group.install_rate_rupees)}{' '}
        per install, {formatRupees(group.retained_rate_rupees)} per five-day return
        {group.cap_rupees == null ? '' : `, cap ${formatRupees(group.cap_rupees)}`}.
      </p>
      <CountBoard counts={tally} />
      <EarnedMath group={group} counts={tally} />
      <div className="analytics-overview money-board">
        <div className="analytics-stat">
          <span className="analytics-stat-label">Earned</span>
          <span className="analytics-stat-value">{formatRupees(earned)}</span>
          <span className="analytics-stat-hint">
            {tally.installs < group.min_payout_installs
              ? `Starts at ${group.min_payout_installs.toLocaleString('en-IN')} installs`
              : 'From the rates above'}
          </span>
        </div>
        <div className="analytics-stat">
          <span className="analytics-stat-label">Marked paid</span>
          <span className="analytics-stat-value">{formatRupees(markedPaid)}</span>
          <span className="analytics-stat-hint">Payments you ticked</span>
        </div>
      </div>

      <section className="today-section">
        <h3 className="section-label">Members</h3>
        <ul className="admin-feedback-list">
          {members.map((member) => {
            const mine = counts.get(countKey(group.id, member.id)) ?? emptyCounts()
            return (
              <li key={member.id} className="admin-feedback-card">
                <p className="activity-name">{member.email}</p>
                <p className="activity-desc">Code {member.code}</p>
                {member.removed_at ? (
                  <p className="activity-desc">New installs from this link have stopped.</p>
                ) : (
                  <CountBoard counts={mine} />
                )}
                {member.removed_at ? null : (
                  <MarketingLink groupCode={group.code} memberCode={member.code} />
                )}
                {member.removed_at ? null : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void onRun(() => removeMarketingMember(member.id))}
                  >
                    Stop new installs
                  </button>
                )}
              </li>
            )
          })}
        </ul>
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault()
            if (!email.trim()) return
            void onRun(() => addMarketingMember(group.id, email)).then((ok) => {
              if (ok) setEmail('')
            })
          }}
        >
          <label className="field">
            <span className="field-label">Account email</span>
            <input
              className="field-input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="They sign in once first"
            />
          </label>
          <button type="submit" className="btn btn-primary">
            Add member
          </button>
        </form>
      </section>

      <section className="today-section">
        <h3 className="section-label">Payments</h3>
        <ul className="admin-feedback-list">
          {payments.map((payment) => (
            <li key={payment.id} className="admin-feedback-card">
              <p className="activity-name">
                {formatRupees(payment.amount_rupees)} · {payment.paid_on}
                {payment.member_id ? ` · ${memberName.get(payment.member_id) ?? 'Member'}` : ''}
              </p>
              {payment.note ? <p className="activity-desc">{payment.note}</p> : null}
              <label className="activity-desc">
                <input
                  type="checkbox"
                  checked={payment.paid}
                  onChange={(event) =>
                    void onRun(() => setMarketingPaymentPaid(payment.id, event.target.checked))
                  }
                />{' '}
                Paid
              </label>
            </li>
          ))}
        </ul>
        <form
          className="stacked-form"
          onSubmit={(event) => {
            event.preventDefault()
            const value = Number(amount)
            if (!Number.isInteger(value) || value < 0 || !paidOn) return
            void onRun(() =>
              saveMarketingPayment({
                groupId: group.id,
                memberId: payMemberId || null,
                paidOn,
                amount: value,
                note,
                paid,
              }),
            ).then((ok) => {
              if (!ok) return
              setAmount('')
              setNote('')
              setPayMemberId('')
              setPaid(true)
            })
          }}
        >
          <label className="field">
            <span className="field-label">Amount in rupees</span>
            <input className="field-input" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input className="field-input" type="date" value={paidOn} onChange={(event) => setPaidOn(event.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Person, optional</span>
            <select className="field-input" value={payMemberId} onChange={(event) => setPayMemberId(event.target.value)}>
              <option value="">The whole group</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.email}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Note</span>
            <input className="field-input" value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <label className="activity-desc">
            <input type="checkbox" checked={paid} onChange={(event) => setPaid(event.target.checked)} /> Paid
          </label>
          <button type="submit" className="btn btn-primary">
            Add payment
          </button>
        </form>
      </section>
    </>
  )
}
