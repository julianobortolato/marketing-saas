import { z } from 'zod'

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Campo obrigatório.')
    .email('Informe um e-mail válido.'),
  password: z.string().min(1, 'Campo obrigatório.'),
})

export const signupSchema = z.object({
  email: z
    .string()
    .min(1, 'Campo obrigatório.')
    .email('Informe um e-mail válido.'),
  password: z
    .string()
    .min(1, 'Campo obrigatório.')
    .min(8, 'A senha deve ter pelo menos 8 caracteres.'),
})

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
