import { useEffect, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useLocale } from '../hooks/useLocale'
import { meditationHours, publicChallengeCount } from '../lib/challengeScore'
import { challengePhotoUrl } from '../lib/challengePhotos'
import { addDays } from '../lib/dates'
import {
  boardShareMessage,
  cancelChallengeLeave,
  cleanChallengeName,
  cleanWhatsAppGroupLink,
  defaultChallengeShare,
  challengeHasEnded,
  challengeIssue,
  challengeIssueKey,
  challengePhone,
  challengeCardSrc,
  challengeUrl,
  endWalkingChallenge,
  getChallengeBoard,
  getChallengeHistory,
  goalSpanOk,
  isChallengeCode,
  joinWalkingChallenge,
  markChallengeShared,
  scheduleChallengeLeave,
  setChallengeShareMessage,
  setWalkingChallengeStatus,
  teamImageSrc,
  teamNamesOk,
  updateChallengeDetails,
  walkingJoinGate,
  type ChallengeBoard,
  type ChallengeHistory,
} from '../lib/challenges'
import { ChallengeTrend, teamColor } from './ChallengeTrend'
import { readPhoneSteps, requestPhoneSteps, type PhoneSteps } from '../lib/healthSteps'
import { syncWalkingChallenges } from '../lib/walkingSync'
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
  const [editing, setEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [endDraft, setEndDraft] = useState('')
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [cardPreview, setCardPreview] = useState<string | null>(null)
  const [teamDrafts, setTeamDrafts] = useState<
    { id: string; name: string; link: string; file: File | null; preview: string | null }[]
  >([])
  const [error, setError] = useState<string | null>(null)
  const [photoNote, setPhotoNote] = useState(false)
  const [history, setHistory] = useState<ChallengeHistory>({ teams: [], mine: [] })
  const board = load.state === 'ready' ? load.board : null
  const platform = Capacitor.getPlatform()
  const phone = challengePhone()
  const native = platform !== 'web'
  const sitting = board?.kind === 'meditate'
  const stepsPending = !sitting && native && (phone === 'android' || phone === 'ios') && steps == null
  const gate = sitting ? 'join' : walkingJoinGate(phone, native ? steps : { status: 'unavailable' })

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
    if (!native || phone === 'web' || board?.kind === 'meditate') return
    let live = true
    void readPhoneSteps().then((result) => {
      if (live) setSteps(result)
    })
    return () => {
      live = false
    }
  }, [native, phone, attempt, board?.kind])

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
      void syncWalkingChallenges().catch(() => {})
      setAttempt((count) => count + 1)
      setConfirmEmpty(false)
    } catch (err) {
      setError(t(challengeIssueKey(challengeIssue(err as { message?: string }))))
    } finally {
      setBusy(false)
    }
  }

  function clearEditPictures() {
    setCardPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setCardFile(null)
    setTeamDrafts((current) => {
      current.forEach((team) => {
        if (team.preview) URL.revokeObjectURL(team.preview)
      })
      return current
    })
  }

  function startEdit() {
    if (!board) return
    clearEditPictures()
    setTitleDraft(board.title ?? '')
    setEndDraft(board.endsOn)
    setTeamDrafts(
      board.teams.map((team) => ({
        id: team.id,
        name: team.name,
        link: team.whatsappUrl ?? '',
        file: null,
        preview: null,
      })),
    )
    setError(null)
    setEditing(true)
  }

  function stopEdit() {
    clearEditPictures()
    setTeamDrafts([])
    setEditing(false)
  }

  async function saveEdits() {
    if (!board) return
    const title = cleanChallengeName(titleDraft)
    if (!title || title.length > 60) {
      setError(t('challenge.errors.name'))
      return
    }
    if (!goalSpanOk(board.startsOn, endDraft)) {
      setError(t('challenge.errors.dates'))
      return
    }
    const names = teamDrafts.map((team) => cleanChallengeName(team.name))
    if (!teamNamesOk(board.shape, names)) {
      setError(t(board.shape === 'race' ? 'challenge.errors.teams' : 'challenge.errors.oneTeam'))
      return
    }
    const links = teamDrafts.map((team) => cleanWhatsAppGroupLink(team.link))
    if (links.some((link) => !link.ok)) {
      setError(t('challenge.errors.whatsapp'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      await updateChallengeDetails({
        id: board.id,
        title,
        endsOn: endDraft,
        card: cardFile,
        teams: teamDrafts.map((team, index) => ({
          id: team.id,
          name: names[index] ?? '',
          link: links[index]?.url ?? '',
          photo: team.file,
        })),
      })
      stopEdit()
      setAttempt((count) => count + 1)
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
  const leadText = shareLine.split('\n')[0]
  const soFarPrefix = t('challenge.line.soFar', { line: '' }).trim()
  const leadBare =
    board.scorePhase === 'so_far' && leadText.startsWith(soFarPrefix)
      ? leadText.slice(soFarPrefix.length).trim()
      : leadText

  const joining = !board.isOwner && !board.myTeamId
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
      <div className={editing ? 'challenge-detail-head is-editing' : 'challenge-detail-head'}>
        {editing ? (
          <label className="challenge-picture">
            <img
              className="challenge-detail-mark"
              src={cardPreview ?? challengePhotoUrl(board.cardPhoto) ?? challengeCardSrc(board.kind)}
              alt=""
            />
            <span className="challenge-picture-badge" aria-hidden="true">
              <Icon name="photo" />
            </span>
            <input
              className="challenge-file"
              type="file"
              accept="image/*"
              aria-label={t('challenge.changePicture')}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (!file) return
                setCardFile(file)
                setCardPreview((current) => {
                  if (current) URL.revokeObjectURL(current)
                  return URL.createObjectURL(file)
                })
              }}
            />
          </label>
        ) : (
          <img
            className="challenge-detail-mark"
            src={challengePhotoUrl(board.cardPhoto) ?? challengeCardSrc(board.kind)}
            alt=""
          />
        )}
        <div className="shared-event-body">
          <p className="shared-event-intro">
            {t(board.kind === 'meditate' ? 'challenge.pageIntroSit' : 'challenge.pageIntro')}
          </p>
          {editing ? (
            <>
              <label className="field">
                <span className="field-label">{t('challenge.name')}</span>
                <input
                  className="field-input"
                  value={titleDraft}
                  maxLength={60}
                  onChange={(event) => setTitleDraft(event.target.value)}
                />
              </label>
              <div className="challenge-dates">
                <label className="field">
                  <span className="field-label">{t('challenge.startDate')}</span>
                  <input className="field-input" value={startsLabel} disabled />
                </label>
                <label className="field">
                  <span className="field-label">{t('challenge.endDate')}</span>
                  <input
                    className="field-input"
                    type="date"
                    value={endDraft}
                    min={board.startsOn}
                    max={addDays(board.startsOn, 29)}
                    onChange={(event) => setEndDraft(event.target.value)}
                  />
                </label>
              </div>
            </>
          ) : (
            <>
              <h1 className="shared-event-title">{board.title}</h1>
              <p className="shared-event-when">
                {t('challenge.through', {
                  start: dateLabel.format(new Date(`${board.startsOn}T12:00:00`)),
                  end: dateLabel.format(new Date(`${board.endsOn}T12:00:00`)),
                })}
              </p>
            </>
          )}
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
      {!editing && board.scorePhase && leadBare && (
        <p className="challenge-lead">
          {board.scorePhase === 'so_far' && <span className="challenge-lead-kicker">{t('challenge.soFarLabel')}</span>}
          <span className="challenge-lead-line">{leadBare}</span>
        </p>
      )}
      {over && <p className="shared-event-status">{t('challenge.ended')}</p>}
      {board.myLeavingOn && <p className="shared-event-note">{t('challenge.leaving')}</p>}

      {!editing && (
      <ul className="shared-list-items">
        {ranked.map((team) => {
          const pace = team.pace == null ? null : publicChallengeCount(team.pace, measure)
          const width = pace == null || leaderPace === 0 ? 0 : Math.max(8, Math.round((pace / leaderPace) * 100))
          const leaders = ranked.filter(
            (row) => row.pace != null && publicChallengeCount(row.pace, measure) === leaderPace,
          )
          const isLeader = pace != null && pace === leaderPace && leaders.length === 1
          return (
            <li key={team.id} className="shared-list-item">
              <div
                className={team.id === board.myTeamId ? 'challenge-team-card is-mine' : 'challenge-team-card'}
                style={
                  {
                    '--team-ink': teamColor(team.image),
                    ...(isLeader ? { borderColor: teamColor(team.image) } : {}),
                  } as CSSProperties
                }
              >
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
                      src={challengePhotoUrl(team.photoPath) ?? teamImageSrc(team.image, board.kind)}
                      alt=""
                    />
                    <span className="challenge-score-name">
                      <span className="challenge-team-ink" style={{ color: teamColor(team.image) }}>
                        {team.name}
                      </span>
                      <span className="challenge-score-meta">
                        {team.id === board.myTeamId && <span>{t('challenge.myTeam')}</span>}
                        <span>
                          {team.memberCount === 0
                            ? t('challenge.waiting')
                            : t('challenge.members', { count: team.memberCount })}
                        </span>
                        {team.whatsappUrl && (
                          <a
                            className="challenge-whatsapp"
                            href={team.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {t('challenge.whatsappJoin')}
                          </a>
                        )}
                      </span>
                    </span>
                  </span>
                  {pace != null && (
                    <span className="challenge-score-value">
                      {isLeader && <span className="challenge-score-lead">{t('challenge.leadsMark')}</span>}
                      <strong>{countLabel(pace)}</strong>
                      <span>{t(sitting ? 'challenge.scoreUnitMinutes' : 'challenge.scoreUnit')}</span>
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
      )}

      {editing && (
        <div className="challenge-edit-teams">
          {board.teams.map((team) => {
            const draft = teamDrafts.find((item) => item.id === team.id)
            if (!draft) return null
            return (
              <div
                key={team.id}
                className="challenge-edit-team"
                style={{ '--team-ink': teamColor(team.image) } as CSSProperties}
              >
                <label className="challenge-picture challenge-edit-photo">
                  <img
                    className="challenge-team-picture"
                    src={draft.preview ?? challengePhotoUrl(team.photoPath) ?? teamImageSrc(team.image, board.kind)}
                    alt=""
                  />
                  <span className="challenge-picture-badge" aria-hidden="true">
                    <Icon name="photo" />
                  </span>
                  <input
                    className="challenge-file"
                    type="file"
                    accept="image/*"
                    aria-label={t('challenge.changePicture')}
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (!file) return
                      setTeamDrafts((current) =>
                        current.map((item) => {
                          if (item.id !== team.id) return item
                          if (item.preview) URL.revokeObjectURL(item.preview)
                          return { ...item, file, preview: URL.createObjectURL(file) }
                        }),
                      )
                    }}
                  />
                </label>
                <div className="challenge-edit-fields">
                  <input
                    className="field-input challenge-team-name"
                    style={{ '--team-ink': teamColor(team.image) } as CSSProperties}
                    value={draft.name}
                    maxLength={40}
                    aria-label={t('challenge.teams')}
                    onChange={(event) =>
                      setTeamDrafts((current) =>
                        current.map((item) => (item.id === team.id ? { ...item, name: event.target.value } : item)),
                      )
                    }
                  />
                  <input
                    className="field-input"
                    value={draft.link}
                    inputMode="url"
                    placeholder={t('challenge.whatsappPlaceholder')}
                    aria-label={t('challenge.whatsappGroup')}
                    onChange={(event) =>
                      setTeamDrafts((current) =>
                        current.map((item) => (item.id === team.id ? { ...item, link: event.target.value } : item)),
                      )
                    }
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editing && error && <p className="error">{error}</p>}
      {editing && (
        <div className="challenge-edit-actions">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void saveEdits()}>
            {busy ? t('challenge.saving') : t('challenge.save')}
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={stopEdit}>
            {t('challenge.cancel')}
          </button>
        </div>
      )}

      {!editing && new Set(history.teams.map((point) => point.day)).size >= 2 && (
        <section className="challenge-chart-block" aria-label={t('challenge.dayByDay')}>
          <h2 className="today-period-title">{t('challenge.dayByDay')}</h2>
          <ChallengeTrend
            teams={board.teams}
            points={history.teams}
            locale={locale}
            unit={t(board.kind === 'meditate' ? 'challenge.chartMinutes' : 'challenge.chartUnit')}
            totalLabel={t(board.shape === 'together' ? 'challenge.chartDay' : 'challenge.chartTotal')}
            averageLabel={t('challenge.chartEach')}
            goal={board.shape === 'together' ? board.target : null}
            goalLabel={t('challenge.chartGoal')}
            goalMark={t('challenge.chartGoalMark')}
            soFarLabel={t('challenge.soFarLabel')}
            goalOf={(total) =>
              t('challenge.totalOf', {
                total: total.toLocaleString(locale),
                target: (board.target ?? 0).toLocaleString(locale),
              })
            }
          />
        </section>
      )}

      {!editing && (history.mine.length > 0 || board.myRaw != null || board.myDayClosed) && (
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

      {!editing && error && <p className="error">{error}</p>}

      {!editing && !over && board.status === 'active' && !board.myTeamId && gate === 'connect' && (
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void connect()}>
          {t('challenge.connect')}
        </button>
      )}

      {!editing && !over && board.status === 'active' && !board.myTeamId && (gate === 'join' || gate === 'confirm-empty') && (
        <>
          {confirmEmpty && (
            <p className="shared-event-note">
              {t(phone === 'ios' ? 'challenge.emptyWarningApple' : 'challenge.emptyWarning')}
            </p>
          )}
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

      {!editing && !over &&
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

      {!editing && recordUrl && user && (board.isOwner || board.myTeamId) && (
        <a
          className="btn btn-primary"
          href={recordUrl}
          onClick={() => void markChallengeShared(board.id).then(() => setAttempt((count) => count + 1))}
        >
          {t('challenge.cardReady')}
        </a>
      )}

      {!editing && board.isOwner && (
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
              if (!user) return
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
      )}
      {!editing && !joining && !board.isOwner && shareDraftText.trim() && (
        <p className="challenge-share-read">{shareDraftText.trim()}</p>
      )}

      {!editing && !joining && (
      <div className="challenge-share-row">
        <button type="button" className="btn btn-secondary" onClick={() => void copyLink()}>
          {copied ? t('challenge.copied') : t('challenge.copy')}
        </button>
        <a className="btn btn-secondary" href={shareUrl}>
          {t('challenge.share')}
        </a>
      </div>
      )}

      {!editing && !over && board.myTeamId && (board.status === 'active' || board.status === 'switched_off') && (
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

      {!editing && board.isOwner && (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={startEdit}>
          {t('challenge.edit')}
        </button>
      )}

      {!editing && !over && board.isOwner && board.status !== 'ended' && (
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
