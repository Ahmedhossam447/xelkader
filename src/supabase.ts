import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL =
  (import.meta.env.VITE_SUPABASE_URL as string) || 'https://inbsqtlddkgbpcvtepux.supabase.co'
export const SUPABASE_ANON_KEY =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || 'sb_publishable_G20CgKpmkhppMaTgTTMc7A_ayTjY_yk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface PersonRecord {
  id?: number
  created_at?: string
  name: string
  PhoneNumber: string
  Gifts?: string | null
  gift?: string | null
  Gift?: string | null
}

export async function findParticipantByPhone(phone: string): Promise<PersonRecord | null> {
  try {
    const { data, error } = await supabase
      .from('People')
      .select('*')
      .eq('PhoneNumber', phone)
      .order('id', { ascending: false })
      .limit(1)

    if (error || !data || data.length === 0) {
      return null
    }
    return data[0] as PersonRecord
  } catch (err) {
    console.error('Error finding participant by phone:', err)
    return null
  }
}

export async function insertParticipantWithGift(name: string, phone: string, giftName: string) {
  // First attempt: try with Gifts column (standard in current DB)
  let { data, error } = await supabase
    .from('People')
    .insert({
      name: name || 'زائر',
      PhoneNumber: phone,
      Gifts: giftName,
    })
    .select()

  // If column Gifts doesn't exist (error code 42703), try lowercase gift
  if (error && (error.code === '42703' || error.message?.toLowerCase().includes('gifts'))) {
    const fallback = await supabase
      .from('People')
      .insert({
        name: name || 'زائر',
        PhoneNumber: phone,
        gift: giftName,
      })
      .select()
    data = fallback.data
    error = fallback.error
  }

  // If still error because of column, fallback to without gift column
  if (error && (error.code === '42703' || error.message?.toLowerCase().includes('gift'))) {
    const basic = await supabase
      .from('People')
      .insert({
        name: name || 'زائر',
        PhoneNumber: phone,
      })
      .select()
    data = basic.data
    error = basic.error
  }

  return { data, error }
}

export async function saveParticipantGift(name: string, phone: string, giftName: string, userId?: number) {
  if (userId) {
    try {
      const upRes = await supabase
        .from('People')
        .update({ Gifts: giftName })
        .eq('id', userId)
        .select()

      if (!upRes.error && upRes.data && upRes.data.length > 0) {
        return upRes
      }

      if (upRes.error && (upRes.error.code === '42703' || upRes.error.message?.toLowerCase().includes('gifts'))) {
        const fallbackUp = await supabase
          .from('People')
          .update({ gift: giftName })
          .eq('id', userId)
          .select()
        if (!fallbackUp.error && fallbackUp.data && fallbackUp.data.length > 0) {
          return fallbackUp
        }
      }
    } catch (e) {
      console.warn('Update failed, falling back to insert:', e)
    }
  }

  return insertParticipantWithGift(name, phone, giftName)
}


