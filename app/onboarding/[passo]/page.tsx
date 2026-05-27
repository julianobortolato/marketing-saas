import { redirect } from 'next/navigation'
import { getTenant } from '@/lib/queries/tenant'
import { getBrandManual } from '@/lib/queries/brand-manual'
import { getVerticalPresets } from '@/lib/queries/vertical-presets'
import { Stepper } from './stepper'
import { Step1 } from './step1'
import { Step2 } from './step2'
import { Step3 } from './step3'
import { Step4 } from './step4'
import { Step5 } from './step5'
import { Step6 } from './step6'
import { Step7 } from './step7'
import { Step8 } from './step8'

export default async function OnboardingPage({
  params,
}: {
  params: { passo: string }
}) {
  const passo = parseInt(params.passo, 10)
  if (isNaN(passo) || passo < 1 || passo > 8) redirect('/onboarding/1')

  const tenant = await getTenant()
  if (!tenant) redirect('/login')

  if (tenant.onboarding_passo >= 9) redirect('/dashboard/overview')
  if (passo > tenant.onboarding_passo) redirect(`/onboarding/${tenant.onboarding_passo}`)

  const [brandManual, presets] = await Promise.all([
    getBrandManual(),
    passo === 2 ? getVerticalPresets() : ([] as Awaited<ReturnType<typeof getVerticalPresets>>),
  ])

  const StepMap: Record<number, React.ReactNode> = {
    1: <Step1 tenant={tenant} />,
    2: <Step2 presets={presets} current={brandManual.vertical} />,
    3: <Step3 brandManual={brandManual} />,
    4: <Step4 brandManual={brandManual} />,
    5: <Step5 vertical={brandManual.vertical ?? 'generico'} />,
    6: <Step6 />,
    7: <Step7 tenantSlug={tenant.slug} />,
    8: <Step8 nomeEmpresa={brandManual.identidade?.nome_empresa ?? tenant.nome} />,
  }

  return (
    <div className="flex min-h-screen flex-col items-center px-4 py-8">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <span className="text-lg font-bold uppercase tracking-widest text-[#1A2E4A]">Prisma</span>
          <p className="mt-1 text-sm text-[#64748B]">Configure sua conta em minutos</p>
        </div>

        {/* Stepper */}
        <div className="mb-8">
          <Stepper current={passo} completed={tenant.onboarding_passo - 1} />
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
          {StepMap[passo]}
        </div>
      </div>
    </div>
  )
}
