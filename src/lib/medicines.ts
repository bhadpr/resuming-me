import { createSupabaseClient } from './supabase'
import type { ClockTime, DoseMark, MedicineSchedule, MedicineSystem } from './medicineSchedule'
import { medicineSystemOf, normalizeTimes, normalizeWeekdays } from './medicineSchedule'

const BUCKET = 'medicine-photos'

export interface MedicineRecord extends MedicineSchedule {
  photoPath: string | null
}

export interface MedicineInput {
  name: string
  weekdays: number[]
  times: ClockTime[]
  system?: MedicineSystem | null
  photo?: Blob | null
}

function photoPathFor(userId: string, medicineId: string): string {
  return `${userId}/${medicineId}.jpg`
}

async function signedPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null
  const client = createSupabaseClient()
  const { data, error } = await client.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return null
  return data.signedUrl
}

export async function listMedicines(): Promise<MedicineRecord[]> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('medicines')
    .select('*')
    .eq('archived', false)
    .order('name', { ascending: true })
  if (error) throw error
  const rows = data ?? []
  if (rows.length === 0) return []
  const ids = rows.map((row) => row.id)
  const { data: times, error: timesError } = await client
    .from('medicine_times')
    .select('*')
    .in('medicine_id', ids)
  if (timesError) throw timesError
  const byMedicine = new Map<string, ClockTime[]>()
  for (const time of times ?? []) {
    const list = byMedicine.get(time.medicine_id) ?? []
    const meal = time.meal === 'before' || time.meal === 'after' || time.meal === 'with' ? time.meal : null
    list.push(meal ? { hour: time.hour, minute: time.minute, meal } : { hour: time.hour, minute: time.minute })
    byMedicine.set(time.medicine_id, list)
  }
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      name: row.name,
      photoPath: row.photo_path,
      photoUrl: await signedPhotoUrl(row.photo_path),
      weekdays: normalizeWeekdays(row.weekdays),
      times: normalizeTimes(byMedicine.get(row.id) ?? []),
      system: medicineSystemOf(row.system),
    })),
  )
}

export async function listDoseMarks(date: string): Promise<DoseMark[]> {
  const client = createSupabaseClient()
  const { data, error } = await client.from('medicine_doses').select('*').eq('date', date)
  if (error) throw error
  return (data ?? []).map((row) => ({
    medicineId: row.medicine_id,
    date: row.date,
    hour: row.hour,
    minute: row.minute,
  }))
}

export async function saveMedicine(
  userId: string,
  input: MedicineInput,
  existingId?: string,
): Promise<string> {
  const client = createSupabaseClient()
  const name = input.name.trim()
  const weekdays = normalizeWeekdays(input.weekdays)
  const times = normalizeTimes(input.times)
  const system = medicineSystemOf(input.system)
  let medicineId = existingId ?? ''

  if (existingId) {
    const { error } = await client
      .from('medicines')
      .update({ name, weekdays, system })
      .eq('id', existingId)
    if (error) throw error
    const { error: deleteError } = await client
      .from('medicine_times')
      .delete()
      .eq('medicine_id', existingId)
    if (deleteError) throw deleteError
  } else {
    const { data, error } = await client
      .from('medicines')
      .insert({ user_id: userId, name, weekdays, archived: false, system })
      .select('id')
      .single()
    if (error) throw error
    medicineId = data.id
  }

  const { error: timesError } = await client.from('medicine_times').insert(
    times.map((time) => ({
      medicine_id: medicineId,
      user_id: userId,
      hour: time.hour,
      minute: time.minute,
      ...(time.meal ? { meal: time.meal } : {}),
    })),
  )
  if (timesError) throw timesError

  if (input.photo) {
    const path = photoPathFor(userId, medicineId)
    const { error: uploadError } = await client.storage.from(BUCKET).upload(path, input.photo, {
      upsert: true,
      contentType: 'image/jpeg',
    })
    if (uploadError) throw uploadError
    const { error: photoError } = await client
      .from('medicines')
      .update({ photo_path: path })
      .eq('id', medicineId)
    if (photoError) throw photoError
  }

  return medicineId
}

export async function deleteMedicine(userId: string, medicine: MedicineRecord): Promise<void> {
  const client = createSupabaseClient()
  if (medicine.photoPath) {
    await client.storage.from(BUCKET).remove([medicine.photoPath])
  }
  const { error } = await client.from('medicines').delete().eq('id', medicine.id).eq('user_id', userId)
  if (error) throw error
}

export async function markDoseTaken(
  userId: string,
  dose: { medicineId: string; date: string; hour: number; minute: number },
): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('medicine_doses').insert({
    user_id: userId,
    medicine_id: dose.medicineId,
    date: dose.date,
    hour: dose.hour,
    minute: dose.minute,
  })
  if (error && error.code !== '23505') throw error
}

export async function clearDoseTaken(dose: {
  medicineId: string
  date: string
  hour: number
  minute: number
}): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('medicine_doses')
    .delete()
    .eq('medicine_id', dose.medicineId)
    .eq('date', dose.date)
    .eq('hour', dose.hour)
    .eq('minute', dose.minute)
  if (error) throw error
}

export async function compressBottlePhoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const maxSide = 1024
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read that photo')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.72))
  if (!blob) throw new Error('Could not read that photo')
  return blob
}
