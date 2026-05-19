'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'

import { loginSchema, type LoginInput } from '@/lib/validators/auth'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PasswordInput } from '@/components/password-input'

export default function LoginPage() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isValid, isDirty },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  })

  async function onSubmit(data: LoginInput) {
    setFormError(null)

    // createClient() called inside handler — browser-only, not during SSR/prerender
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      setFormError('E-mail ou senha incorretos. Verifique e tente novamente.')
      return
    }

    router.push('/dashboard/overview')
  }

  const isButtonDisabled = isSubmitting || (!isDirty && !isValid)

  return (
    <main className="min-h-screen bg-[#F8FAFC] flex items-center justify-center py-12 px-4">
      <Card className="w-full max-w-[400px] bg-white shadow-sm border border-border">
        <CardHeader className="text-center pb-0 pt-8">
          {/* Logo wordmark */}
          <div className="flex justify-center mb-6">
            <span className="text-2xl font-bold uppercase tracking-wider text-[#0F172A]">
              FITNESS UNIC
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-xl font-bold uppercase tracking-wider text-[#0F172A] leading-tight">
            Bem-vindo de volta
          </h1>
        </CardHeader>

        <CardContent className="pt-6 pb-8 px-6">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email field */}
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="voce@academia.com.br"
                aria-describedby={errors.email ? 'email-error' : undefined}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && (
                <p id="email-error" className="text-sm text-destructive" role="alert">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Senha</Label>
                <Link
                  href="#"
                  className="text-sm text-[#64748B] hover:text-[#0F172A]"
                  tabIndex={-1}
                >
                  Esqueceu sua senha?
                </Link>
              </div>
              <PasswordInput
                id="password"
                placeholder="Sua senha"
                aria-describedby={errors.password ? 'password-error' : undefined}
                aria-invalid={!!errors.password}
                {...register('password')}
              />
              {errors.password && (
                <p id="password-error" className="text-sm text-destructive" role="alert">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Form-level error — inline, not toast, single generic message */}
            {formError && (
              <p className="text-sm text-destructive" role="alert">
                {formError}
              </p>
            )}

            {/* CTA button */}
            <Button
              type="submit"
              className="w-full min-h-[44px] text-base font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={isButtonDisabled}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                'Entrar na conta'
              )}
            </Button>
          </form>

          {/* Divider */}
          <div className="mt-6">
            <Separator className="mb-4" />
            <p className="text-center text-sm text-[#64748B]">
              Ainda não tem conta?{' '}
              <Link
                href="/signup"
                className="font-medium text-[#0F172A] hover:text-primary underline-offset-4 hover:underline"
              >
                Criar conta
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </main>
  )
}
