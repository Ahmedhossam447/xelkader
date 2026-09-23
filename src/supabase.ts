import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://inbsqtlddkgbpcvtepux.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_G20CgKpmkhppMaTgTTMc7A_ayTjY_yk'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export interface PersonRecord {
  id?: number
  created_at?: string
  name: string
  PhoneNumber: string
}
