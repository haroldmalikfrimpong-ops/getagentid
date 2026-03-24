import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://jabesqvkhgyhimamiwmg.supabase.co'
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseKey)

// Auth helpers
export async function signUp(email: string, password: string, metadata?: { company?: string }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: metadata ? { data: metadata } : undefined,
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function getUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function resetPasswordForEmail(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${typeof window !== 'undefined' ? window.location.origin : ''}/reset-password`,
  })
  if (error) throw error
  return data
}

export async function updateUserPassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password })
  if (error) throw error
  return data
}

export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/dashboard`,
    },
  })
  if (error) throw error
  return data
}
