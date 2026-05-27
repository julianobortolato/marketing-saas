// Carrega fontes do filesystem para ImageResponse (@vercel/og / Satori).
// Edge Runtime não tem fs — usa fetch com URL absoluta a partir de public/fonts/.
//
// Todos os fonts são estáticos (não-variable) — WOFF latin-subset por peso.
// BebasNeue: apenas regular (400), sem bold oficial.
//
// ENGINE: não conhece tenant. Tenant escolhe família via brand_manual.tipografia.

export const FONTS_DISPONIVEIS = [
  'Plus Jakarta Sans',
  'Inter',
  'Playfair Display',
  'Bebas Neue',
  'Lora',
] as const;

export type FontFamily = (typeof FONTS_DISPONIVEIS)[number];

export type FontEntry = {
  name: FontFamily;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: 'normal';
};

type FontDef = { regular: string; bold?: string };

const FONT_FILES: Record<FontFamily, FontDef> = {
  'Plus Jakarta Sans': { regular: 'PlusJakartaSans-400.woff', bold: 'PlusJakartaSans-700.woff' },
  'Inter':             { regular: 'Inter-400.woff',           bold: 'Inter-700.woff' },
  'Playfair Display':  { regular: 'PlayfairDisplay-400.woff', bold: 'PlayfairDisplay-700.woff' },
  'Bebas Neue':        { regular: 'BebasNeue-Regular.ttf' },
  'Lora':              { regular: 'Lora-400.woff',            bold: 'Lora-700.woff' },
};

export async function carregarFontes(
  origem: string,
  familias: FontFamily[] = ['Plus Jakarta Sans', 'Inter'],
): Promise<FontEntry[]> {
  const entries: FontEntry[] = [];
  for (const fam of familias) {
    const def = FONT_FILES[fam];
    if (!def) continue;
    const regular = await fetch(`${origem}/fonts/${def.regular}`).then(r => r.arrayBuffer());
    entries.push({ name: fam, data: regular, weight: 400, style: 'normal' });
    if (def.bold) {
      const bold = await fetch(`${origem}/fonts/${def.bold}`).then(r => r.arrayBuffer());
      entries.push({ name: fam, data: bold, weight: 700, style: 'normal' });
    }
  }
  return entries;
}
