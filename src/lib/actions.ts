'use server'
 
import { signIn } from '@/auth'
import { AuthError } from 'next-auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
 
export async function authenticate(
  prevState: string | undefined,
  formData: FormData,
) {
  try {
    await signIn('credentials', {
      ...Object.fromEntries(formData),
      redirectTo: '/dashboard',
    })
  } catch (error) {
    if (error instanceof AuthError) {
      switch (error.type) {
        case 'CredentialsSignin':
          return 'Invalid credentials.'
        default:
          return 'Something went wrong.'
      }
    }
    throw error
  }
}

export async function register(
  prevState: string | undefined,
  formData: FormData,
) {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
    name: z.string().min(2),
  })

  const parsed = schema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return 'Invalid fields'
  }

  const { email, password, name } = parsed.data

  try {
    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) return 'User already exists'

    const hashedPassword = await bcrypt.hash(password, 10)
    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
      },
    })
    
    return 'success'
  } catch (error) {
    console.error(error)
    return 'Failed to create user'
  }
}
