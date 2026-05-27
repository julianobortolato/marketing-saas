import type { TemplateSlots } from './types'

function pesoBold(fonte: string): 400 | 700 {
  return fonte === 'Bebas Neue' ? 400 : 700
}

export function TemplateCarousel(slots: TemplateSlots): JSX.Element {
  const fonte = slots.fonte_familia ?? 'Plus Jakarta Sans'
  const peso = pesoBold(fonte)

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: '#1A2E4A',
        fontFamily: fonte,
      }}
    >
      {/* Foto — 50% da largura */}
      <div style={{ display: 'flex', width: 540, height: 1080, overflow: 'hidden' }}>
        <img
          src={slots.foto_url}
          width={540}
          height={1080}
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Área de texto — 50% restante */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          padding: '64px 56px',
        }}
      >
        {/* Copy principal */}
        <div
          style={{
            color: '#F0EEE8',
            fontSize: 52,
            fontWeight: peso,
            lineHeight: 1.25,
          }}
        >
          {slots.copy_principal}
        </div>

        {/* Rodapé: CTA + logo */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              color: slots.cor_primaria,
              fontSize: 30,
              fontWeight: peso,
              letterSpacing: '0.05em',
              marginBottom: 24,
            }}
          >
            {slots.cta} →
          </div>
          <div style={{ display: 'flex', width: 180, height: 44, overflow: 'hidden' }}>
            <img
              src={slots.logo_url}
              width={180}
              height={44}
              style={{ objectFit: 'contain' }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
