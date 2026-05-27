import { TemplateFeed }     from './feed'
import { TemplateStory }    from './story'
import { TemplateCarousel } from './carousel'
import type { FormatoTemplate, TemplateSlots } from './types'

export const TEMPLATES: Record<FormatoTemplate, (slots: TemplateSlots) => JSX.Element> = {
  feed:           TemplateFeed,
  story:          TemplateStory,
  carousel_slide: TemplateCarousel,
}

export const DIMENSOES: Record<FormatoTemplate, { largura: number; altura: number }> = {
  feed:           { largura: 1080, altura: 1080 },
  story:          { largura: 1080, altura: 1920 },
  carousel_slide: { largura: 1080, altura: 1080 },
}
