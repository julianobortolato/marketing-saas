import type { TemplateSlots } from './types'

// Bebas Neue não tem bold oficial — solicitando 700 cai silenciosamente para 400
function pesoBold(fonte: string): 400 | 700 {
  return fonte === 'Bebas Neue' ? 400 : 700
}

export function TemplateFeed(slots: TemplateSlots): JSX.Element {
  const fonte = slots.fonte_familia ?? 'Plus Jakarta Sans'
  const peso = pesoBold(fonte)

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1A2E4A',
        fontFamily: fonte,
      }}
    >
      {/* Foto — 60% da altura */}
      <div style={{ display: 'flex', width: 1080, height: 648, overflow: 'hidden' }}>
        <img
          src={slots.foto_url}
          width={1080}
          height={648}
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Área de texto — 40% restante */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          padding: '48px 60px',
        }}
      >
        {/* Copy principal */}
        <div
          style={{
            color: '#F0EEE8',
            fontSize: 52,
            fontWeight: peso,
            lineHeight: 1.2,
            maxWidth: 900,
          }}
        >
          {slots.copy_principal}
        </div>

        {/* Rodapé: logo + CTA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', width: 200, height: 48, overflow: 'hidden' }}>
            <img
              src={slots.logo_url}
              width={200}
              height={48}
              style={{ objectFit: 'contain' }}
            />
          </div>
          <div
            style={{
              color: slots.cor_primaria,
              fontSize: 32,
              fontWeight: peso,
              letterSpacing: '0.06em',
            }}
          >
            {slots.cta + ' →'}
          </div>
        </div>
      </div>
    </div>
  )
}
