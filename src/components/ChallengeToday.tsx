import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from './Icon'
import { TaggedName } from './TodayKindTag'
import { useLocale } from '../hooks/useLocale'
import { walkingShareLines } from '../lib/challengeScore'
import { challengePhotoUrl } from '../lib/challengePhotos'
import {
  boardScoreInput,
  challengeCardSrc,
  getChallengeBoard,
  myChallengeIndex,
  type ChallengeBoard,
  type ChallengeIndexRow,
  type ChallengePhase,
} from '../lib/challenges'
import type { DayPeriod } from '../lib/dayPeriod'
import type { Locale } from '../lib/i18n'
import { type TodayTimedItem } from './TodayByTime'

interface Loaded {
  row: ChallengeIndexRow
  board: ChallengeBoard
}

const SHELF_PHASES = ['current', 'soon', 'past'] as const

function challengeDate(locale: Locale, day: string): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-IN' : locale, {
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${day}T12:00:00`))
}

function ordered(rows: ChallengeIndexRow[], phase: ChallengePhase): ChallengeIndexRow[] {
  const copy = rows.filter((row) => row.phase === phase)
  copy.sort((a, b) =>
    phase === 'past' ? b.endsOn.localeCompare(a.endsOn) : a.startsOn.localeCompare(b.startsOn),
  )
  return copy
}

function ChallengeRows({ rows }: { rows: ChallengeIndexRow[] }) {
  const navigate = useNavigate()
  const { locale, t } = useLocale()

  return (
    <ul className="challenge-home-list">
      {rows.map((row) => {
        const note =
          row.phase === 'soon'
            ? t('challenge.startsOn', { date: challengeDate(locale, row.startsOn) })
            : row.phase === 'past'
              ? t('challenge.endedShort')
              : null
        return (
          <li key={row.code} className="challenge-home-card item-kind-challenge">
            <button type="button" className="challenge-home-open" onClick={() => navigate(`/t/${row.code}`)}>
              <img className="challenge-home-mark" src={challengePhotoUrl(row.cardPath) ?? challengeCardSrc(row.kind)} alt="" />
              <span className="challenge-home-name">
                {row.title}
                {note && <span className="challenge-home-status">{note}</span>}
              </span>
              <span className="challenge-home-details">{t('challenge.details')}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function challengePeriod(kind: ChallengeIndexRow['kind']): DayPeriod {
  return kind === 'meditate' ? 'morning' : 'anytime'
}

function ChallengeTodayRow({ row, board }: { row: ChallengeIndexRow; board: ChallengeBoard | null }) {
  const navigate = useNavigate()
  const { locale, t } = useLocale()
  const start = challengeDate(locale, row.startsOn)
  const end = challengeDate(locale, row.endsOn)
  const span = t('challenge.through', { start, end })
  const score = board ? walkingShareLines(boardScoreInput(board, start), locale).current : span
  const yours =
    board?.myRaw != null && board.myCapped != null
      ? board.kind === 'meditate'
        ? board.myRaw === board.myCapped
          ? t('challenge.yourMinutesSame', { raw: board.myRaw.toLocaleString(locale) })
          : t('challenge.yourMinutes', {
              raw: board.myRaw.toLocaleString(locale),
              capped: board.myCapped.toLocaleString(locale),
            })
        : board.myRaw === board.myCapped
          ? t('challenge.yourDaySame', { raw: board.myRaw.toLocaleString(locale) })
          : t('challenge.yourDay', {
              raw: board.myRaw.toLocaleString(locale),
              capped: board.myCapped.toLocaleString(locale),
            })
      : null
  const second = yours ?? (board ? span : null)

  return (
    <li>
      <button
        type="button"
        className="today-row today-row-stack today-row-compact challenge-today-row item-kind-challenge"
        onClick={() => navigate(`/t/${row.code}`)}
      >
        <div className="today-row-head">
          <img className="challenge-today-mark" src={challengePhotoUrl(row.cardPath) ?? challengeCardSrc(row.kind)} alt="" />
          <TaggedName kind={row.kind === 'meditate' ? 'sitChallenge' : 'stepChallenge'}>{row.title}</TaggedName>
        </div>
        <div className="today-row-main">
          <span className="activity-meta">
            <span className="activity-desc challenge-today-line">{score}</span>
            {second && <span className="activity-desc challenge-today-line">{second}</span>}
          </span>
        </div>
        <span className="challenge-home-details challenge-today-details">
          {t('challenge.details')}
          <Icon name="chevron" className="icon challenge-today-chevron" />
        </span>
      </button>
    </li>
  )
}

/** Challenges that include today, inside Morning or Anytime. */
export function useTodayChallengeItems(): TodayTimedItem[] {
  const [rows, setRows] = useState<ChallengeIndexRow[]>([])
  const [boards, setBoards] = useState<Record<string, ChallengeBoard>>({})

  useEffect(() => {
    let live = true
    void myChallengeIndex()
      .then((index) => {
        if (!live) return
        const current = index.filter((row) => row.phase === 'current')
        setRows(current)
        void Promise.all(
          current.map(async (row) => {
            const board = await getChallengeBoard(row.code)
            return board ? ([row.code, board] as const) : null
          }),
        ).then((loaded) => {
          if (!live) return
          setBoards(Object.fromEntries(loaded.filter((item) => item != null)))
        })
      })
      .catch(() => {
        if (live) setRows([])
      })
    return () => {
      live = false
    }
  }, [])

  return rows.map((row) => ({
    key: `challenge-${row.code}`,
    done: false,
    period: challengePeriod(row.kind),
    kind: 'challenge' as const,
    node: <ChallengeTodayRow row={row} board={boards[row.code] ?? null} />,
  }))
}

/**
 * Walking challenges live on Health. Meditation challenges live on Habits.
 * Each page keeps the ones in progress, the ones that start within two days, and the finished ones.
 */
export function ChallengeShelf({
  kind,
  phases = SHELF_PHASES,
}: {
  kind?: 'walk' | 'meditate'
  phases?: readonly ChallengePhase[]
}) {
  const { t } = useLocale()
  const [rows, setRows] = useState<ChallengeIndexRow[]>([])

  useEffect(() => {
    let live = true
    void myChallengeIndex()
      .then((index) => {
        if (live) setRows(index)
      })
      .catch(() => {
        if (live) setRows([])
      })
    return () => {
      live = false
    }
  }, [])

  const navigate = useNavigate()
  const groups = phases
    .map((phase) => ({
      phase,
      rows: ordered(
        rows.filter((row) => kind == null || row.kind === kind),
        phase,
      ),
    }))
    .filter((group) => group.rows.length > 0)

  if (groups.length === 0 && kind == null) return null

  const grouped = groups.length > 1 || groups[0]?.phase !== 'current'
  const addTo =
    kind === 'meditate' ? '/challenges/new?measure=meditate' : '/challenges/new?measure=walk'

  return (
    <section className={kind ? 'challenge-home challenge-shelf' : 'challenge-home'} aria-label={t('challenge.section')}>
      <div className="challenge-shelf-heading">
        <h3 className="today-period-title">{t('challenge.section')}</h3>
        {kind != null && (
          <button type="button" className="btn btn-primary btn-compact" onClick={() => navigate(addTo)}>
            {t('list.add')}
          </button>
        )}
      </div>
      {kind != null && (
        <p className="screen-sub challenge-shelf-sub">
          {t(kind === 'meditate' ? 'challenge.sectionSit' : 'challenge.sectionWalk')}
        </p>
      )}
      {groups.map((group) => (
        <div key={group.phase} className="challenge-shelf-group">
          {grouped && <h4 className="today-period-title">{t(`challenge.${group.phase}`)}</h4>}
          <ChallengeRows rows={group.rows} />
        </div>
      ))}
    </section>
  )
}

/** The challenges you run and do not belong to. */
export function ChallengeRunList() {
  const navigate = useNavigate()
  const { t } = useLocale()
  const [rows, setRows] = useState<Loaded[]>([])

  useEffect(() => {
    let live = true
    void myChallengeIndex()
      .then(async (index) => {
        const loaded = (
          await Promise.all(
            index
              .filter((row) => row.role === 'run')
              .map(async (row) => {
                const board = await getChallengeBoard(row.code)
                return board ? { row, board } : null
              }),
          )
        ).filter((item): item is Loaded => item != null)
        if (live) setRows(loaded)
      })
      .catch(() => {
        if (live) setRows([])
      })
    return () => {
      live = false
    }
  }, [])

  return (
    <section className="screen">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/today')}>
        <Icon name="back" />
        {t('challenge.back')}
      </button>
      <h2>{t('challenge.youRun')}</h2>
      <ul className="shared-list-items">
        {rows.map(({ row, board }) => (
          <li key={row.code} className="shared-list-item">
            <button type="button" className="btn btn-secondary" onClick={() => navigate(`/t/${row.code}`)}>
              {row.title}
              {board.cardReady ? ` · ${t('challenge.cardReady')}` : ''}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
