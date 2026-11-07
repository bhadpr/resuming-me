import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { addDays } from '../lib/dates'
import { useLocale } from '../hooks/useLocale'
import { saveChallengePictures } from '../lib/challengePhotos'
import {
  challengeIssue,
  challengeIssueKey,
  challengeToday,
  cleanChallengeName,
  createWalkingChallenge,
  goalSpanOk,
  hourTargetOk,
  myChallengeIndex,
  TEAM_IMAGE_COUNT,
  teamImageSrc,
  raceLastDay,
  stepTargetOk,
  teamNamesOk,
  type ChallengeIndexRow,
  type ChallengeShape,
} from '../lib/challenges'
import { Icon } from './Icon'

/** Start a walking challenge. Scoring is a later sprint. */
export function ChallengeForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (code: string) => void
}) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const today = challengeToday()
  const [mine, setMine] = useState<ChallengeIndexRow[]>([])
  const [measure, setMeasure] = useState<'walk' | 'meditate'>(
    params.get('measure') === 'meditate' ? 'meditate' : 'walk',
  )
  const sitting = measure === 'meditate'
  const canJoin = sitting || Capacitor.getPlatform() === 'android'
  const [title, setTitle] = useState('')
  const [shape, setShape] = useState<ChallengeShape>('race')
  const [teams, setTeams] = useState(['Blue', 'Green'])
  const [teamImages, setTeamImages] = useState([1, 2])
  const [teamFiles, setTeamFiles] = useState<(File | null)[]>([null, null])
  const [teamPreviews, setTeamPreviews] = useState<(string | null)[]>([null, null])
  const groupImage = 1
  const [groupFile, setGroupFile] = useState<File | null>(null)
  const [groupPreview, setGroupPreview] = useState<string | null>(null)
  const [cardFile, setCardFile] = useState<File | null>(null)
  const [cardPreview, setCardPreview] = useState<string | null>(null)
  const [groupName, setGroupName] = useState('Everyone')
  const [target, setTarget] = useState(params.get('measure') === 'meditate' ? '1000' : '1000000')
  const [startsOn, setStartsOn] = useState(today)
  const [endsOn, setEndsOn] = useState(raceLastDay(today))
  const [join, setJoin] = useState(false)
  const [joinTeam, setJoinTeam] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const names = shape === 'race' ? teams : [groupName]

  useEffect(() => {
    let live = true
    void myChallengeIndex()
      .then((rows) => {
        if (live) setMine(rows)
      })
      .catch(() => {
        if (live) setMine([])
      })
    return () => {
      live = false
    }
  }, [])

  function changeStart(value: string) {
    setStartsOn(value)
    const earliest = raceLastDay(value)
    if (shape === 'race' || endsOn < earliest) setEndsOn(earliest)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const cleanedTitle = cleanChallengeName(title)
    if (!cleanedTitle || cleanedTitle.length > 60) {
      setError(t('challenge.errors.name'))
      return
    }
    if (!teamNamesOk(shape, names)) {
      setError(t(shape === 'race' ? 'challenge.errors.teams' : 'challenge.errors.oneTeam'))
      return
    }
    if (startsOn < today) {
      setError(t('challenge.errors.past'))
      return
    }
    const steps =
      shape === 'together' ? (sitting ? hourTargetOk(target) : stepTargetOk(target)) : null
    if (shape === 'together' && steps == null) {
      setError(t(sitting ? 'challenge.errors.targetHours' : 'challenge.errors.target'))
      return
    }
    const lastDay = shape === 'race' ? raceLastDay(startsOn) : endsOn
    if (shape === 'together' && !goalSpanOk(startsOn, lastDay)) {
      setError(t('challenge.errors.dates'))
      return
    }
    setBusy(true)
    setError(null)
    try {
      const created = await createWalkingChallenge({
        title: cleanedTitle,
        kind: measure,
        shape,
        startsOn,
        endsOn: lastDay,
        target: steps,
        teamNames: names,
        teamImages: shape === 'race' ? teamImages.slice(0, names.length) : [groupImage],
        join: canJoin && join,
        joinTeam: shape === 'race' ? joinTeam : 0,
      })
      const pictures = shape === 'race' ? teamFiles.slice(0, names.length) : [groupFile]
      if (cardFile || pictures.some((file) => file != null)) {
        try {
          await saveChallengePictures(created.id, cardFile, pictures)
        } catch {
          sessionStorage.setItem('resuming-challenge-photo-note', created.code)
        }
      }
      onCreated(created.code)
    } catch (err) {
      setError(t(challengeIssueKey(challengeIssue(err as { message?: string }))))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="screen challenge-form" onSubmit={(event) => void submit(event)}>
      <button type="button" className="btn btn-ghost btn-sm back-btn" disabled={busy} onClick={onCancel}>
        <Icon name="back" />
        {t('challenge.back')}
      </button>
      <h2>{t(sitting ? 'challenge.titleSit' : 'challenge.title')}</h2>
      <p className="screen-sub">{t(sitting ? 'challenge.introSit' : 'challenge.intro')}</p>
      <fieldset className="challenge-choice">
        <label>
          <input
            type="radio"
            name="measure"
            checked={measure === 'walk'}
            onChange={() => {
              setMeasure('walk')
              setTarget('1000000')
              if (Capacitor.getPlatform() !== 'android') setJoin(false)
            }}
          />
          <span>{t('challenge.measureWalk')}</span>
          <span className="activity-desc">{t('challenge.measureWalkHint')}</span>
        </label>
        <label>
          <input
            type="radio"
            name="measure"
            checked={measure === 'meditate'}
            onChange={() => {
              setMeasure('meditate')
              setTarget('1000')
            }}
          />
          <span>{t('challenge.measureSit')}</span>
          <span className="activity-desc">{t('challenge.measureSitHint')}</span>
        </label>
      </fieldset>
      {mine.some((row) => row.phase !== 'past') && (
        <div className="challenge-yours">
          <span className="field-label">{t('challenge.yours')}</span>
          {mine.filter((row) => row.phase !== 'past').map((row) => (
            <button
              key={row.code}
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate(`/t/${row.code}`)}
            >
              {row.title}
            </button>
          ))}
        </div>
      )}
      <label className="challenge-team-picture-btn">
        <img className="challenge-card-picture" src={cardPreview ?? '/og-walk.jpg'} alt="" />
        <input
          className="challenge-file"
          type="file"
          accept="image/*"
          aria-label={t('challenge.cardPicture')}
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
      <p className="activity-desc">{t('challenge.cardPicture')}</p>

      <label className="field">
        <span className="field-label">{t('challenge.name')}</span>
        <input
          className="field-input"
          value={title}
          maxLength={60}
          placeholder={t('challenge.namePlaceholder')}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <fieldset className="challenge-choice">
        <label>
          <input
            type="radio"
            name="shape"
            checked={shape === 'race'}
            onChange={() => setShape('race')}
          />
          <span>{t('challenge.race')}</span>
          <span className="activity-desc">{t('challenge.raceHint')}</span>
        </label>
        <label>
          <input
            type="radio"
            name="shape"
            checked={shape === 'together'}
            onChange={() => setShape('together')}
          />
          <span>{t('challenge.together')}</span>
          <span className="activity-desc">
            {t(sitting ? 'challenge.togetherHintSit' : 'challenge.togetherHint')}
          </span>
        </label>
      </fieldset>

      {shape === 'race' ? (
        <div className="field">
          <span className="field-label">{t('challenge.teams')}</span>
          {teams.map((name, index) => (
            <div className="challenge-team-row" key={index}>
              <label className="challenge-team-picture-btn">
                <img
                  className="challenge-team-picture"
                  src={teamPreviews[index] ?? teamImageSrc(teamImages[index] ?? index + 1)}
                  alt=""
                />
                <input
                  className="challenge-file"
                  type="file"
                  accept="image/*"
                  aria-label={t('challenge.teamPicture')}
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setTeamFiles((current) => current.map((item, i) => (i === index ? file : item)))
                    setTeamPreviews((current) =>
                      current.map((item, i) => {
                        if (i !== index) return item
                        if (item) URL.revokeObjectURL(item)
                        return URL.createObjectURL(file)
                      }),
                    )
                  }}
                />
              </label>
              <input
                className="field-input"
                value={name}
                maxLength={40}
                aria-label={t('challenge.teams')}
                onChange={(event) =>
                  setTeams((current) => current.map((item, i) => (i === index ? event.target.value : item)))
                }
              />
              {teams.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setTeams((current) => current.filter((_, i) => i !== index))
                    setTeamImages((current) => current.filter((_, i) => i !== index))
                    setTeamFiles((current) => current.filter((_, i) => i !== index))
                    setTeamPreviews((current) => {
                      const removed = current[index]
                      if (removed) URL.revokeObjectURL(removed)
                      return current.filter((_, i) => i !== index)
                    })
                    setJoinTeam(0)
                  }}
                >
                  {t('challenge.removeTeam')}
                </button>
              )}
            </div>
          ))}
          {teams.length < 4 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                setTeams((current) => [...current, ''])
                setTeamImages((current) => [...current, (current.length % TEAM_IMAGE_COUNT) + 1])
                setTeamFiles((current) => [...current, null])
                setTeamPreviews((current) => [...current, null])
              }}
            >
              {t('challenge.addTeam')}
            </button>
          )}
        </div>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{t('challenge.oneTeam')}</span>
            <label className="challenge-team-picture-btn">
              <img className="challenge-team-picture" src={groupPreview ?? teamImageSrc(groupImage)} alt="" />
              <input
                className="challenge-file"
                type="file"
                accept="image/*"
                aria-label={t('challenge.teamPicture')}
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (!file) return
                  setGroupFile(file)
                  setGroupPreview((current) => {
                    if (current) URL.revokeObjectURL(current)
                    return URL.createObjectURL(file)
                  })
                }}
              />
            </label>
            <input
              className="field-input"
              value={groupName}
              maxLength={40}
              onChange={(event) => setGroupName(event.target.value)}
            />
          </label>
          <label className="field">
            <span className="field-label">{t(sitting ? 'challenge.targetHours' : 'challenge.target')}</span>
            <input
              className="field-input"
              inputMode="numeric"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
            />
          </label>
        </>
      )}

      <label className="field">
        <span className="field-label">{t('challenge.startDate')}</span>
        <input
          className="field-input"
          type="date"
          value={startsOn}
          min={today}
          onChange={(event) => changeStart(event.target.value)}
        />
      </label>

      <label className="field">
        <span className="field-label">{t('challenge.endDate')}</span>
        <input
          className="field-input"
          type="date"
          value={shape === 'race' ? raceLastDay(startsOn) : endsOn}
          min={raceLastDay(startsOn)}
          max={addDays(startsOn, 365)}
          disabled={shape === 'race'}
          onChange={(event) => setEndsOn(event.target.value)}
        />
      </label>

      {canJoin ? (
        <label className="challenge-join">
          <input type="checkbox" checked={join} onChange={(event) => setJoin(event.target.checked)} />
          <span>{t('challenge.joinToo')}</span>
        </label>
      ) : (
        <p className="activity-desc">{t('challenge.viewOnly')}</p>
      )}

      {canJoin && join && shape === 'race' && (
        <label className="field">
          <span className="field-label">{t('challenge.whichTeam')}</span>
          <select
            className="field-input"
            value={joinTeam}
            onChange={(event) => setJoinTeam(Number(event.target.value))}
          >
            {teams.map((name, index) => (
              <option key={index} value={index}>
                {cleanChallengeName(name) || t('challenge.teams')}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="error">{error}</p>}

      <div className="today-pop-actions">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? t('challenge.creating') : t('challenge.create')}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          {t('challenge.cancel')}
        </button>
      </div>
    </form>
  )
}
