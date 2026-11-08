import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useLocale } from '../hooks/useLocale'
import { meditationHours, publicChallengeCount } from '../lib/challengeScore'
import { challengePhotoUrl } from '../lib/challengePhotos'
import {
  boardShareMessage,
  cancelChallengeLeave,
  defaultChallengeShare,
  challengeHasEnded,
  challengeIssue,
  challengeIssueKey,
  challengeUrl,
  endWalkingChallenge,
  getChallengeBoard,
  getChallengeHistory,
  isChallengeCode,
  joinWalkingChallenge,
  markChallengeShared,
  scheduleChallengeLeave,
  setChallengeShareMessage,
  setWalkingChallengeStatus,
  teamImageSrc,
  walkingJoinGate,
  type ChallengeBoard,
  type ChallengeHistory,
} from '../lib/challenges'
import { ChallengeTrend, teamColor } from './ChallengeTrend'
import { readPhoneSteps, requestPhoneSteps, type PhoneSteps } from '../lib/healthSteps'
import { Icon } from './Icon'

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; board: ChallengeBoard | null }

/** resuming.me/t/<code>: the teams, and one tap to join. No scores in this sprint. */
export function ChallengePage({ code }: { code: string }) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { t, locale } = useLocale()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [steps, setSteps] = useState<PhoneSteps | null>(null)
  const [teamId, setTeamId] = useState<string | null>(null)
  const [confirmEmpty, setConfirmEmpty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [shareDraft, setShareDraft] = useState<string | null>(null)
  const [shareFor, setShareFor] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState(false)
  const [history, setHistory] = useState<ChallengeHistory>({ teams: [], mine: [] })
  const board = load.state === 'ready' ? load.board : null
  const platform = Capacitor.getPlatform()
  const sitting = board?.kind === 'meditate'
  const stepsPending = !sitting && platform === 'android' && steps == null
  const gate = sitting ? 'join' : walkingJoinGate(platform, steps)

  useDocumentMeta({
    title: board?.title ? `${board.title} · Resuming` : 'Resuming',
    description: board?.title ?? undefined,
    noindex: true,
  })

  useEffect(() => {
    if (!isChallengeCode(code)) {
      setLoad({ state: 'ready', board: null })
      return
    }
    let live = true
    setLoad({ state: 'loading' })
    getChallengeBoard(code)
      .then((found) => {
        if (!live) return
        setLoad({ state: 'ready', board: found })
        setTeamId(found?.teams[0]?.id ?? null)
      })
      .catch(() => {
        if (live) setLoad({ state: 'error' })
      })
    return () => {
      live = false
    }
  }, [code, attempt])

  useEffect(() => {
    if (!isChallengeCode(code)) return
    let live = true
    void getChallengeHistory(code).then((found) => {
      if (live) setHistory(found)
    })
    return () => {
      live = false
    }
  }, [code, attempt])

  useEffect(() => {
    if (platform !== 'android' || board?.kind === 'meditate') return
    let live = true
    void readPhoneSteps().then((result) => {
      if (live) setSteps(result)
    })
    return () => {
      live = false
    }
  }, [platform, attempt, board?.kind])

  useEffect(() => {
    if (sessionStorage.getItem('resuming-challenge-photo-note') !== code) return
    sessionStorage.removeItem('resuming-challenge-photo-note')
    setPhotoNote(true)
  }, [code])

  async function connect() {
    setBusy(true)
    try {
      setSteps(await requestPhoneSteps())
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    if (!board || !teamId) return
    if (!user) {
      navigate(`/?next=${encodeURIComponent(`/t/${code}`)}`)
      return
    }
    if (gate === 'confirm-empty' && !confirmEmpty) {
      setConfirmEmpty(true)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await joinWalkingChallenge(code, teamId)
      setAttempt((count) => count + 1)
      setConfirmEmpty(false)
    } catch (err) {
      setError(t(challengeIssueKey(challengeIssue(err as { message?: string }))))
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(status: 'switched_off' | 'deleted') {
    if (!board) return
    setBusy(true)
    setError(null)
    try {
      await setWalkingChallengeStatus(board.id, status)
      if (status === 'deleted') {
        navigate('/today')
        return
      }
      setAttempt((count) => count + 1)
    } catch (err) {
      setError(t(challengeIssueKey(challengeIssue(err as { message?: string }))))
    } finally {
      setBusy(false)
    }
  }

  async function copyLink() {
    const url = challengeUrl(code, board?.cardPhoto)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  function goBack() {
    navigate(user ? '/today' : '/')
  }

  const back = (
    <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={goBack}>
      <Icon name="back" />
      {t('challenge.back')}
    </button>
  )

  if (load.state === 'loading' || authLoading) {
    return (
      <section className="shared-event">
        {back}
        <p className="muted-center">{t('challenge.loading')}</p>
      </section>
    )
  }

  if (load.state === 'error') {
    return (
      <section className="shared-event">
        {back}
        <p className="shared-event-status">{t('challenge.loadFailed')}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((count) => count + 1)}>
          {t('challenge.tryAgain')}
        </button>
      </section>
    )
  }

  if (!board) {
    return (
      <section className="shared-event">
        {back}
        <p className="shared-event-status">{t('challenge.unavailable')}</p>
        <Link className="btn btn-secondary" to="/">
          {t('challenge.home')}
        </Link>
      </section>
    )
  }

  if (board.status === 'switched_off' && board.teams.length === 0) {
    return (
      <section className="shared-event">
        {back}
        <p className="shared-event-status">{t('challenge.switchedOff')}</p>
        {error && <p className="error">{error}</p>}
        {board.isOwner && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void changeStatus('deleted')}
          >
            {t('challenge.delete')}
          </button>
        )}
        <Link className="btn btn-secondary" to={user ? '/today' : '/'}>
          {t('challenge.home')}
        </Link>
      </section>
    )
  }

  const dateLabel = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  const startsLabel = dateLabel.format(new Date(`${board.startsOn}T12:00:00`))
  const shareLine = boardShareMessage(board, startsLabel, locale, false)
  const over = challengeHasEnded(board)
  const recordLine = board.cardReady ? boardShareMessage(board, startsLabel, locale, true) : null
  const shareFallback = defaultChallengeShare({
    title: board.title ?? '',
    shape: board.shape,
    kind: board.kind,
    locale,
  })
  const shareDraftText =
    shareFor === board.id && shareDraft != null ? shareDraft : (board.shareMessage ?? shareFallback)
  const shareUrl = `https://wa.me/?text=${encodeURIComponent(
    `${shareDraftText.trim() || shareFallback}\n${challengeUrl(board.code, board.cardPhoto)}`,
  )}`
  const recordUrl = recordLine ? `https://wa.me/?text=${encodeURIComponent(recordLine)}` : null
  const countLabel = (value: number) => value.toLocaleString(locale)

  const measure = board.kind === 'meditate' ? 'minutes' : 'steps'
  const ranked = [...board.teams].sort((a, b) => (b.pace ?? -1) - (a.pace ?? -1))
  const leaderPace = Math.max(
    0,
    ...ranked.map((team) => (team.pace == null ? 0 : publicChallengeCount(team.pace, measure))),
  )
  const loggedAverage =
    history.mine.length === 0
      ? 0
      : Math.round(history.mine.reduce((sum, day) => sum + day.steps, 0) / history.mine.length)

  return (
    <section className="shared-event">
      {back}
      <div className="challenge-detail-head">
        <img className="challenge-detail-mark" src={challengePhotoUrl(board.cardPhoto) ?? '/og-walk.jpg'} alt="" />
        <div className="shared-event-body">
          <p className="shared-event-intro">
            {t(board.kind === 'meditate' ? 'challenge.pageIntroSit' : 'challenge.pageIntro')}
          </p>
          <h1 className="shared-event-title">{board.title}</h1>
          <p className="shared-event-when">
            {t('challenge.through', {
              start: dateLabel.format(new Date(`${board.startsOn}T12:00:00`)),
              end: dateLabel.format(new Date(`${board.endsOn}T12:00:00`)),
            })}
          </p>
        </div>
      </div>
      {photoNote && <p className="shared-event-note">{t('challenge.photoFailed')}</p>}
      {board.shape === 'together' && board.target != null && (
        <p className="shared-event-from">
          {board.kind === 'meditate'
            ? t('challenge.targetLineHours', {
                target: meditationHours(board.target).toLocaleString(locale),
              })
            : t('challenge.targetLine', { target: board.target.toLocaleString(locale) })}
        </p>
      )}
      {board.scorePhase && <p className="challenge-lead">{shareLine.split('\n')[0]}</p>}
      {over && <p className="shared-event-status">{t('challenge.ended')}</p>}
      {board.myLeavingOn && <p className="shared-event-note">{t('challenge.leaving')}</p>}

      <ul className="shared-list-items">
        {ranked.map((team) => {
          const pace = team.pace == null ? null : publicChallengeCount(team.pace, measure)
          const width = pace == null || leaderPace === 0 ? 0 : Math.max(8, Math.round((pace / leaderPace) * 100))
          return (
            <li key={team.id} className="shared-list-item">
              <div className={team.id === board.myTeamId ? 'challenge-team-card is-mine' : 'challenge-team-card'}>
                <div className="challenge-score-top">
                  <span className="challenge-team-heading">
                    {!board.myTeamId && board.shape === 'race' && !stepsPending && gate !== 'blocked' && (
                      <input
                        type="radio"
                        name="team"
                        checked={teamId === team.id}
                        onChange={() => setTeamId(team.id)}
                      />
                    )}
                    <img
                      className="challenge-team-picture"
                      src={challengePhotoUrl(team.photoPath) ?? teamImageSrc(team.image)}
                      alt=""
                    />
                    <span className="challenge-score-name">
                      <span>{team.name}</span>
                      <span className="challenge-score-meta">
                        {team.id === board.myTeamId && <span>{t('challenge.myTeam')}</span>}
                        <span>
                          {team.memberCount === 0
                            ? t('challenge.waiting')
                            : t('challenge.members', { count: team.memberCount })}
                        </span>
                      </span>
                    </span>
                  </span>
                  {pace != null && (
                    <span className="challenge-score-value">
                      <strong>{countLabel(pace)}</strong>
                      <span>{t('challenge.averageLabel')}</span>
                    </span>
                  )}
                </div>
                {pace != null && (
                  <span className="challenge-score-track" aria-hidden="true">
                    <span style={{ width: `${width}%`, background: teamColor(team.image) }} />
                  </span>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {new Set(history.teams.map((point) => point.day)).size >= 2 && (
        <section className="challenge-chart-block" aria-label={t('challenge.dayByDay')}>
          <h2 className="today-period-title">{t('challenge.dayByDay')}</h2>
          <ChallengeTrend
            teams={board.teams}
            points={history.teams}
            locale={locale}
            unit={t(board.kind === 'meditate' ? 'challenge.chartMinutes' : 'challenge.chartUnit')}
          />
        </section>
      )}

      {(history.mine.length > 0 || board.myRaw != null || board.myDayClosed) && (
        <section
          className="challenge-log-block"
          aria-label={t(board.kind === 'meditate' ? 'challenge.loggedHeadingMinutes' : 'challenge.loggedHeading')}
        >
          <h2 className="today-period-title">
            {t(board.kind === 'meditate' ? 'challenge.loggedHeadingMinutes' : 'challenge.loggedHeading')}
          </h2>
          {history.mine.length > 0 && (
            <p className="shared-event-from">
              {t(board.kind === 'meditate' ? 'challenge.loggedSummaryMinutes' : 'challenge.loggedSummary', {
                steps: loggedAverage.toLocaleString(locale),
                count: history.mine.length,
              })}
            </p>
          )}
          {board.myRaw != null && board.myCapped != null && (
            <p className="shared-event-note">
              {board.kind === 'meditate'
                ? board.myRaw === board.myCapped
                  ? t('challenge.yourMinutesSame', { raw: countLabel(board.myRaw) })
                  : t('challenge.yourMinutes', {
                      raw: countLabel(board.myRaw),
                      capped: countLabel(board.myCapped),
                    })
                : board.myRaw === board.myCapped
                  ? t('challenge.yourDaySame', { raw: countLabel(board.myRaw) })
                  : t('challenge.yourDay', {
                      raw: countLabel(board.myRaw),
                      capped: countLabel(board.myCapped),
                    })}
            </p>
          )}
          {board.myDayClosed && <p className="shared-event-note">{t('challenge.dayClosed')}</p>}
          {history.mine.length > 0 && (
            <ul className="challenge-log">
              {history.mine.map((day) => (
                <li key={day.day}>
                  <span>{dateLabel.format(new Date(`${day.day}T12:00:00`))}</span>
                  <strong>{day.steps.toLocaleString(locale)}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}

      {!over && !board.myTeamId && !stepsPending && gate === 'blocked' && (
        <p className="shared-event-note">{t('challenge.viewOnly')}</p>
      )}

      {!over && board.status === 'active' && !board.myTeamId && gate === 'connect' && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void connect()}>
          {t('challenge.connect')}
        </button>
      )}

      {!over && board.status === 'active' && !board.myTeamId && (gate === 'join' || gate === 'confirm-empty') && (
        <>
          {confirmEmpty && <p className="shared-event-note">{t('challenge.emptyWarning')}</p>}
          <button type="button" className="btn btn-primary" disabled={busy || !teamId} onClick={() => void join()}>
            {busy
              ? t('challenge.joining')
              : !user
                ? t('challenge.signIn')
                : confirmEmpty
                  ? t('challenge.joinAnyway')
                  : t('challenge.join')}
          </button>
        </>
      )}

      {!over &&
        board.isOwner &&
        board.status === 'active' &&
        board.joinedCount > (board.myTeamId ? 1 : 0) && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() =>
              void endWalkingChallenge(board.id)
                .then(() => setAttempt((count) => count + 1))
                .catch((err) => setError(t(challengeIssueKey(challengeIssue(err as { message?: string })))))
            }
          >
            {t('challenge.end')}
          </button>
        )}

      {recordUrl && user && (board.isOwner || board.myTeamId) && (
        <a
          className="btn btn-primary"
          href={recordUrl}
          onClick={() => void markChallengeShared(board.id).then(() => setAttempt((count) => count + 1))}
        >
          {t('challenge.cardReady')}
        </a>
      )}

      <label className="challenge-share-message">
        <span className="field-label">{t('challenge.shareEdit')}</span>
        <textarea
          className="field-input"
          maxLength={280}
          rows={3}
          value={shareDraftText}
          onChange={(event) => {
            setShareFor(board.id)
            setShareDraft(event.target.value)
          }}
          onBlur={() => {
            if (!user || !board.isOwner) return
            const next = shareDraftText.trim()
            const stored = board.shareMessage?.trim() ?? ''
            const writing = !next || next === shareFallback ? '' : next
            if (!next) setShareDraft(shareFallback)
            if (writing === stored) return
            setBusy(true)
            setError(null)
            void setChallengeShareMessage(board.id, writing)
              .then(() => setAttempt((count) => count + 1))
              .catch((err) => setError(t(challengeIssueKey(challengeIssue(err as { message?: string })))))
              .finally(() => setBusy(false))
          }}
        />
        <span className="shared-event-note">{t('challenge.shareHint')}</span>
      </label>

      <div className="challenge-share-row">
        <button type="button" className="btn btn-secondary" onClick={() => void copyLink()}>
          {copied ? t('challenge.copied') : t('challenge.copy')}
        </button>
        <a className="btn btn-secondary" href={shareUrl}>
          {t('challenge.share')}
        </a>
      </div>

      {!over && board.myTeamId && (board.status === 'active' || board.status === 'switched_off') && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() =>
            void (board.myLeavingOn ? cancelChallengeLeave(board.id) : scheduleChallengeLeave(board.id))
              .then(() => setAttempt((count) => count + 1))
              .catch((err) => setError(t(challengeIssueKey(challengeIssue(err as { message?: string })))))
          }
        >
          {board.myLeavingOn ? t('challenge.stay') : t('challenge.leave')}
        </button>
      )}

      {!over && board.isOwner && board.status !== 'ended' && (
        <>
          {board.status === 'active' && (
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => void changeStatus('switched_off')}
            >
              {t('challenge.switchOff')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void changeStatus('deleted')}
          >
            {t('challenge.delete')}
          </button>
        </>
      )}
    </section>
  )
}
