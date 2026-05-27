import 'server-only'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export interface LogoAnalysis {
  cores_nomeadas: { hex: string; nome: string }[]
  fonte_sugerida: string
  estilo: string
  raw_palette: string[]  // hex values from colorthief
}

/** Calls GPT-4o Vision on a signed logo URL to name colors and suggest typography. */
export async function analyzeLogoVision(
  signedUrl: string,
  paletteHex: string[]
): Promise<LogoAnalysis> {
  const paletteList = paletteHex.map((h, i) => `${i + 1}. ${h}`).join('\n')

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 300,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: { url: signedUrl, detail: 'low' },
          },
          {
            type: 'text',
            text: `Esta é a logo de uma empresa. As cores dominantes extraídas (hex) são:\n${paletteList}\n\nPor favor responda APENAS com JSON válido no formato:\n{"cores_nomeadas":[{"hex":"#RRGGBB","nome":"<nome em português>"}...],"fonte_sugerida":"<nome da fonte Google>","estilo":"<1-3 palavras: moderno/elegante/energético/etc>"}`,
          },
        ],
      },
    ],
  })

  const content = response.choices[0]?.message?.content ?? ''

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('no JSON in response')
    const parsed = JSON.parse(jsonMatch[0]) as {
      cores_nomeadas: { hex: string; nome: string }[]
      fonte_sugerida: string
      estilo: string
    }
    return { ...parsed, raw_palette: paletteHex }
  } catch {
    // Fallback: return hex values without names
    return {
      cores_nomeadas: paletteHex.map((h) => ({ hex: h, nome: h })),
      fonte_sugerida: 'Inter',
      estilo: 'moderno',
      raw_palette: paletteHex,
    }
  }
}
