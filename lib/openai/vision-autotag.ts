import 'server-only'
import OpenAI from 'openai'
import pLimit from 'p-limit'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface AutoTagResult {
  storagePath: string
  categoria: string
  tags: string[]
}

/** Auto-tags a single image using GPT-4o Vision. */
async function tagOneImage(
  signedUrl: string,
  storagePath: string,
  categoriasDisponiveis: string[]
): Promise<AutoTagResult> {
  const listaCateg = categoriasDisponiveis.join(', ')
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 150,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: signedUrl, detail: 'low' } },
            {
              type: 'text',
              text: `Categorize esta imagem para um negócio. Categorias disponíveis: ${listaCateg}.\n\nResponda APENAS com JSON válido:\n{"categoria":"<uma categoria da lista>","tags":["<tag1>","<tag2>","<tag3>"]}`,
            },
          ],
        },
      ],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')

    const parsed = JSON.parse(jsonMatch[0]) as { categoria: string; tags: string[] }
    const categoria = categoriasDisponiveis.includes(parsed.categoria)
      ? parsed.categoria
      : categoriasDisponiveis[0] ?? 'generico'

    return { storagePath, categoria, tags: parsed.tags?.slice(0, 5) ?? [] }
  } catch {
    return { storagePath, categoria: categoriasDisponiveis[0] ?? 'generico', tags: [] }
  }
}

/**
 * Auto-tags multiple images using GPT-4o Vision.
 * Concurrency limited to 5 simultaneous calls (p-limit) to avoid rate limit spikes.
 */
export async function autoTagImages(
  images: Array<{ signedUrl: string; storagePath: string }>,
  categoriasDisponiveis: string[]
): Promise<AutoTagResult[]> {
  const limit = pLimit(5)
  const tasks = images.map(({ signedUrl, storagePath }) =>
    limit(() => tagOneImage(signedUrl, storagePath, categoriasDisponiveis))
  )
  return Promise.all(tasks)
}
