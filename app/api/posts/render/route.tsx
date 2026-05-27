import { ImageResponse } from '@vercel/og';
import { type NextRequest } from 'next/server';
import { z } from 'zod';
import { carregarFontes, FONTS_DISPONIVEIS, type FontFamily, type FontEntry } from '@/lib/render/fonts';

export const runtime = 'edge';

const RenderSchema = z.object({
  html:    z.string().min(1).max(50_000),
  largura: z.number().int().min(100).max(2160).default(1080),
  altura:  z.number().int().min(100).max(2160).default(1080),
  fontes:  z.array(z.enum(FONTS_DISPONIVEIS)).default(['Plus Jakarta Sans', 'Inter']),
});

export async function POST(req: NextRequest) {
  const inicio = Date.now();

  let body: z.infer<typeof RenderSchema>;
  try {
    body = RenderSchema.parse(await req.json());
  } catch (e: unknown) {
    const err = e as { errors?: unknown; message?: string };
    return Response.json(
      { erro: 'payload_invalido', detalhe: err?.errors ?? err?.message },
      { status: 400 },
    );
  }

  const origem = new URL(req.url).origin;

  try {
    const renderPromise = (async () => {
      const fontes: FontEntry[] = await carregarFontes(origem, body.fontes as FontFamily[]);

      // MVP: body.html é texto simples renderizado centralizado.
      // Templates JSX completos com slots chegam na Fase 5.2.
      const img = new ImageResponse(
        (
          <div
            style={{
              width: body.largura,
              height: body.altura,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#F0EEE8',
              fontFamily: body.fontes[0],
              fontSize: 48,
              color: '#1A2E4A',
            }}
          >
            {body.html}
          </div>
        ),
        {
          width: body.largura,
          height: body.altura,
          fonts: fontes,
        },
      );

      return img.arrayBuffer();
    })();

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout_10s')), 10_000),
    );

    const png = await Promise.race([renderPromise, timeoutPromise]);
    const duracaoMs = Date.now() - inicio;

    return new Response(png, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'X-Render-Duration-Ms': String(duracaoMs),
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    const duracaoMs = Date.now() - inicio;
    return Response.json(
      { erro: 'render_falhou', motivo: err?.message ?? 'desconhecido', duracao_ms: duracaoMs },
      { status: 500 },
    );
  }
}
