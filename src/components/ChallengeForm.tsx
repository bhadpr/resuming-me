import { useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { addDays, daysBetween } from '../lib/dates'
import { useLocale } from '../hooks/useLocale'
import { saveChallengePictures } from '../lib/challengePhotos'
import {
  challengeIssue,
  challengeIssueKey,
  challengeToday,
  challengeCardSrc,
  challengeUrl,
  cleanChallengeName,
  cleanWhatsAppGroupLink,
  challengePhone,
  createWalkingChallenge,
  defaultChallengeShare,
  goalSpanOk,
  hourTargetOk,
  TEAM_IMAGE_COUNT,
  teamImageSrc,
  raceLastDay,
  stepTargetOk,
  setChallengeShareMessage,
  teamNamesOk,
  type ChallengeShape,
} from '../lib/challenges'
import { teamColor } from './ChallengeTrend'
import { Icon } from './Icon'

/** Start a walking challenge. Scoring is a later sprint. */
export function ChallengeForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void
  onCreated: (code: string) => void
}) {
  const { t, locale } = useLocale()
  const [params] = useSearchParams()
  const today = challengeToday()
  const [measure, setMeasure] = useState<'walk' | 'meditate'>(
    params.get('measure') === 'meditate' ? 'meditate' : 'walk',
  )
  const sitting = measure === 'meditate'
  const canJoin = sitting || challengePhone() !== 'web'
  const [title, setTitle] = useState('')
  const [shape, setShape] = useState<ChallengeShape>('race')
  const [teams, setTeams] = useState(['Blue', 'Green'])
  const [teamLinks, setTeamLinks] = useState(['', ''])
  const [groupLink, setGroupLink] = useState('')
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [created, setCreated] = useState<{ id: string; code: string } | null>(null)
  const [shareDraft, setShareDraft] = useState('')
  const [copied, setCopied] = useState(false)

  const names = shape === 'race' ? teams : [groupName]
  const links = shape === 'race' ? teamLinks : [groupLink]

  function changeStart(value: string) {
    setStartsOn(value)
    const span = daysBetween(startsOn, endsOn)
    const kept = span >= 0 && span <= 29 ? span : 6
    setEndsOn(addDays(value, kept))
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
    const cleanedLinks = names.map((name, index) => ({
      name: cleanChallengeName(name),
      link: cleanWhatsAppGroupLink(links[index] ?? ''),
    }))
    if (cleanedLinks.some((row) => row.name && !row.link.ok)) {
      setError(t('challenge.errors.whatsapp'))
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
    if (!goalSpanOk(startsOn, endsOn)) {
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
        endsOn,
        target: steps,
        teamNames: cleanedLinks.filter((row) => row.name).map((row) => row.name),
        teamLinks: cleanedLinks.filter((row) => row.name).map((row) => row.link.url),
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
      setCreated(created)
      setShareDraft(
        defaultChallengeShare({ title: cleanedTitle, shape, kind: measure, locale }),
      )
      setStep(3)
    } catch (err) {
      setError(t(challengeIssueKey(challengeIssue(err as { message?: string }))))
    } finally {
      setBusy(false)
    }
  }

  if (step === 1) {
    return (
      <section className="screen challenge-form">
        <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onCancel}>
          <Icon name="back" />
          {t('challenge.back')}
        </button>
        <p className="challenge-step">{t('challenge.stepOf', { step: 1 })}</p>
        <h2>{t('challenge.kindTitle')}</h2>
        <p className="screen-sub">{t('challenge.kindIntro')}</p>
        <fieldset className="challenge-choice">
          <label>
            <input
              type="radio"
              name="measure"
              checked={measure === 'walk'}
              onChange={() => {
                setMeasure('walk')
                setTarget('1000000')
                if (challengePhone() === 'web') setJoin(false)
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
        <div className="today-pop-actions">
          <button type="button" className="btn btn-primary" onClick={() => setStep(2)}>
            {t('challenge.next')}
          </button>
        </div>
      </section>
    )
  }

  if (step === 3 && created) {
    const link = challengeUrl(created.code)
    const shareUrl = `https://wa.me/?text=${encodeURIComponent(`${shareDraft.trim()}\n${link}`)}`
    return (
      <section className="screen challenge-form">
        <p className="challenge-step">{t('challenge.stepOf', { step: 3 })}</p>
        <h2>{t('challenge.linkTitle')}</h2>
        <p className="screen-sub">{t('challenge.linkIntro')}</p>
        <p className="field-label">{t('challenge.preview')}</p>
        <div className="challenge-preview">
          <img src={cardPreview ?? challengeCardSrc(measure)} alt="" />
          <div className="challenge-preview-body">
            <p className="challenge-preview-title">{cleanChallengeName(title)}</p>
            <p className="challenge-preview-message">{shareDraft.trim()}</p>
            <p className="challenge-preview-link">{link.replace('https://', '')}</p>
          </div>
        </div>
        <label className="challenge-share-message">
          <span className="field-label">{t('challenge.shareEdit')}</span>
          <textarea
            className="field-input"
            maxLength={280}
            rows={3}
            value={shareDraft}
            onChange={(event) => {
              setShareDraft(event.target.value)
              setCopied(false)
            }}
            onBlur={() => {
              const next = shareDraft.trim()
              const fallback = defaultChallengeShare({
                title: cleanChallengeName(title),
                shape,
                kind: measure,
                locale,
              })
              const writing = !next || next === fallback ? '' : next
              if (!next) setShareDraft(fallback)
              void setChallengeShareMessage(created.id, writing).catch((err) =>
                setError(t(challengeIssueKey(challengeIssue(err as { message?: string })))),
              )
            }}
          />
          <span className="shared-event-note">{t('challenge.shareHint')}</span>
        </label>
        {error && <p className="error">{error}</p>}
        <div className="challenge-share-row">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              void navigator.clipboard.writeText(link).then(
                () => setCopied(true),
                () => setCopied(false),
              )
            }}
          >
            {copied ? t('challenge.copied') : t('challenge.copy')}
          </button>
          <a className="btn btn-secondary" href={shareUrl}>
            {t('challenge.share')}
          </a>
        </div>
        <div className="today-pop-actions">
          <button type="button" className="btn btn-primary" onClick={() => onCreated(created.code)}>
            {t('challenge.openChallenge')}
          </button>
        </div>
      </section>
    )
  }

  return (
    <form className="screen challenge-form" onSubmit={(event) => void submit(event)}>
      <button type="button" className="btn btn-ghost btn-sm back-btn" disabled={busy} onClick={() => setStep(1)}>
        <Icon name="back" />
        {t('challenge.back')}
      </button>
      <p className="challenge-step">{t('challenge.stepOf', { step: 2 })}</p>
      <h2>{t(sitting ? 'challenge.titleSit' : 'challenge.title')}</h2>
      <p className="screen-sub">{t(sitting ? 'challenge.introSit' : 'challenge.intro')}</p>
      <label className="challenge-picture">
        <img className="challenge-card-picture" src={cardPreview ?? challengeCardSrc(measure)} alt="" />
        <span className="challenge-picture-change">
          <Icon name="photo" />
          {t('challenge.changePicture')}
        </span>
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
        <legend className="field-label">{t('challenge.shapeTitle')}</legend>
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
          <span className="field-label">{t('challenge.teamsAndLinks')}</span>
          {teams.map((name, index) => (
            <div className="challenge-team-row" key={index}>
              <label className="challenge-picture challenge-picture-team">
                <img
                  className="challenge-team-picture"
                  src={teamPreviews[index] ?? teamImageSrc(teamImages[index] ?? index + 1, measure)}
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
              <span className="challenge-team-fields">
                <input
                  className="field-input challenge-team-name"
                  style={{ '--team-ink': teamColor(teamImages[index] ?? index + 1) } as CSSProperties}
                  value={name}
                  maxLength={40}
                  aria-label={t('challenge.teams')}
                  onChange={(event) =>
                    setTeams((current) => current.map((item, i) => (i === index ? event.target.value : item)))
                  }
                />
                <input
                  className="field-input"
                  value={teamLinks[index] ?? ''}
                  inputMode="url"
                  placeholder={t('challenge.whatsappPlaceholder')}
                  aria-label={t('challenge.whatsappGroup')}
                  onChange={(event) =>
                    setTeamLinks((current) =>
                      current.map((item, i) => (i === index ? event.target.value : item)),
                    )
                  }
                />
              </span>
              {teams.length > 2 && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setTeams((current) => current.filter((_, i) => i !== index))
                    setTeamLinks((current) => current.filter((_, i) => i !== index))
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
              className="challenge-add-team"
              onClick={() => {
                setTeams((current) => [...current, ''])
                setTeamLinks((current) => [...current, ''])
                setTeamImages((current) => [...current, (current.length % TEAM_IMAGE_COUNT) + 1])
                setTeamFiles((current) => [...current, null])
                setTeamPreviews((current) => [...current, null])
              }}
            >
              <span className="challenge-add-team-plus" aria-hidden="true">+</span>
              <span>{t('challenge.addTeam')}</span>
            </button>
          )}
          <p className="activity-desc">{t('challenge.whatsappOptional')}</p>
        </div>
      ) : (
        <>
          <label className="field">
            <span className="field-label">{t('challenge.oneTeam')}</span>
            <label className="challenge-picture challenge-picture-team">
              <img className="challenge-team-picture" src={groupPreview ?? teamImageSrc(groupImage, measure)} alt="" />
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
            <input
              className="field-input"
              value={groupLink}
              inputMode="url"
              placeholder={t('challenge.whatsappPlaceholder')}
              aria-label={t('challenge.whatsappGroup')}
              onChange={(event) => setGroupLink(event.target.value)}
            />
            <span className="activity-desc">{t('challenge.whatsappOptional')}</span>
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

      <div className="challenge-dates">
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
            value={endsOn}
            min={startsOn}
            max={addDays(startsOn, 29)}
            onChange={(event) => setEndsOn(event.target.value)}
          />
        </label>
      </div>

      {canJoin && (
        <label className="challenge-join">
          <input type="checkbox" checked={join} onChange={(event) => setJoin(event.target.checked)} />
          <span>{t('challenge.joinToo')}</span>
        </label>
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
          {busy ? t('challenge.creating') : t('challenge.next')}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onCancel}>
          {t('challenge.cancel')}
        </button>
      </div>
    </form>
  )
}
