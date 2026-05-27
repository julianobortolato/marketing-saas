import { createClient } from '@/lib/supabase/server'

export interface VerticalPreset {
  vertical: string
  categorias: string[]
}

export const VERTICAL_LABELS: Record<string, string> = {
  fitness:     'Fitness',
  gastronomia: 'Gastronomia',
  beleza:      'Beleza',
  generico:    'Outro',
}

export async function getVerticalPresets(): Promise<VerticalPreset[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vertical_presets')
    .select('vertical, categorias')
    .order('vertical')

  if (error) {
    console.error('[getVerticalPresets]', error.message)
    return []
  }
  return data as VerticalPreset[]
}

export async function getCategoriasForVertical(vertical: string): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('vertical_presets')
    .select('categorias')
    .eq('vertical', vertical)
    .single()
  return data?.categorias ?? []
}
