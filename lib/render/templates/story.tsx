import type { TemplateSlots } from './types'

function pesoBold(fonte: string): 400 | 700 {
  return fonte === 'Bebas Neue' ? 400 : 700
}

export function TemplateStory(slots: TemplateSlots): JSX.Element {
  const fonte = slots.fonte_familia ?? 'Plus Jakarta Sans'
  const peso = pesoBold(fonte)

  return (
    <div
      style={{
        width: 1080,
        height: 1920,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1A2E4A',
        fontFamily: fonte,
      }}
    >
      {/* Foto — 65% da altura */}
      <div style={{ display: 'flex', width: 1080, height: 1248, overflow: 'hidden' }}>
        <img
          src={slots.foto_url}
          width={1080}
          height={1248}
          style={{ objectFit: 'cover' }}
        />
      </div>

      {/* Área de texto — 35% restante */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flex: 1,
          padding: '60px 72px',
        }}
      >
        {/* Copy principal */}
        <div
          style={{
            color: '#F0EEE8',
            fontSize: 64,
            fontWeight: peso,
            lineHeight: 1.2,
          }}
        >
          {slots.copy_principal}
        </div>

        {/* Rodapé */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Hashtags */}
          {slots.hashtags && slots.hashtags.length > 0 && (
            <div
              style={{
                display: 'flex',
                color: '#F0EEE8',
                fontSize: 28,
                marginBottom: 20,
                opacity: 0.6,
              }}
            >
              {slots.hashtags.map(h => `#${h}`).join(' ')}
            </div>
          )}
          {/* Logo + CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', width: 200, height: 56, overflow: 'hidden' }}>
              <img
                src={slots.logo_url}
                width={200}
                height={56}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <div
              style={{
                color: slots.cor_primaria,
                fontSize: 36,
                fontWeight: peso,
                letterSpacing: '0.06em',
              }}
            >
              {slots.cta + ' →'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
