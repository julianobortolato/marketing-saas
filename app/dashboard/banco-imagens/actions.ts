'use server'

import { revalidatePath } from 'next/cache'
import { updateImagem, deleteImagens } from '@/lib/queries/banco-imagens'

export async function aprovarImagem(id: string): Promise<{ error?: string }> {
  const { error } = await updateImagem(id, { aprovada: true })
  if (error) return { error }
  revalidatePath('/dashboard/banco-imagens')
  return {}
}

export async function rejeitarImagem(id: string): Promise<{ error?: string }> {
  const { error } = await updateImagem(id, { aprovada: false })
  if (error) return { error }
  revalidatePath('/dashboard/banco-imagens')
  return {}
}

export async function deletarImagens(ids: string[]): Promise<{ error?: string }> {
  const { error } = await deleteImagens(ids)
  if (error) return { error }
  revalidatePath('/dashboard/banco-imagens')
  return {}
}
