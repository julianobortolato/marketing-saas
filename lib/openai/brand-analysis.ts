import 'server-only'
import OpenAI from 'openai'
import type { Passo4Input } from '@/lib/validators/onboarding'
import type { TomDeVozConfig, PublicoAlvoConfig } from '@/lib/queries/brand-manual'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const FREQ_LABEL: Record<string, string> = {
  diaria:      'postagem diária',
  '3x_semana': '3 vezes por semana',
  semanal:     'postagem semanal',
  quinzenal:   'postagem quinzenal',
}

export interface BrandAnalysisResult {
  tom_de_voz: TomDeVozConfig
  publico_alvo: PublicoAlvoConfig
}

/**
 * Calls GPT-4o to distill the guided form answers into structured brand_manual fields.
 * Cost: ~$0.02 per call.
 */
export async function analyzeBrandForm(input: Passo4Input): Promise<BrandAnalysisResult> {
  const prompt = `
Com base nas respostas do dono desta empresa, crie uma identidade de comunicação para uso por um CMO autônomo.

Respostas do dono:
- Tom de voz desejado: ${input.tom}
- Público-alvo: ${input.publico_descricao}
- Diferencial da empresa: ${input.diferencial}
- Temas preferidos: ${input.temas.join(', ')}
- Frequência: ${FREQ_LABEL[input.frequencia] ?? input.frequencia}
- Palavras que QUER usar: ${input.palavras_preferidas.length ? input.palavras_preferidas.join(', ') : 'nenhuma'}
- Palavras a EVITAR: ${input.palavras_a_evitar.length ? input.palavras_a_evitar.join(', ') : 'nenhuma'}

Responda APENAS com JSON válido:
{
  "tom_de_voz": {
    "descricao": "<descrição clara do tom em 2-3 frases>",
    "tom": "${input.tom}",
    "temas_recorrentes": [<lista dos temas relevantes>],
    "frequencia": "${input.frequencia}",
    "palavras_preferidas": [<lista>],
    "palavras_a_evitar": [<lista>]
  },
  "publico_alvo": {
    "descricao": "<quem é o público, em 1-2 frases objetivas>",
    "diferencial": "<diferencial da empresa em 1 frase>",
  }
}`.trim()

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = response.choices[0]?.message?.content ?? ''
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON')

    const parsed = JSON.parse(jsonMatch[0]) as BrandAnalysisResult
    return parsed
  } catch {
    // Fallback: use raw input directly
    return {
      tom_de_voz: {
        descricao: `Tom ${input.tom}. ${input.diferencial}`,
        tom: input.tom,
        temas_recorrentes: input.temas,
        frequencia: input.frequencia,
        palavras_preferidas: input.palavras_preferidas,
        palavras_a_evitar: input.palavras_a_evitar,
      },
      publico_alvo: {
        descricao: input.publico_descricao,
        diferencial: input.diferencial,
      },
    }
  }
}
