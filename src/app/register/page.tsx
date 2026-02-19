"use client"
 
import { useFormStatus } from 'react-dom'
import { useActionState } from 'react'
import { register } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
 
export default function RegisterPage() {
  const [state, dispatch] = useActionState(register, undefined)
  const router = useRouter()

  useEffect(() => {
    if (state === 'success') {
      router.push('/login')
    }
  }, [state, router])
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Teacher Registration</CardTitle>
          <CardDescription>Create an account to start managing experiments.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={dispatch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" name="name" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" placeholder="m@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" required minLength={6} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <Link href="/login" className="text-blue-600 hover:underline">
                Already have an account? Login
              </Link>
            </div>
            <div className="text-red-500 text-sm h-4">
              {state !== 'success' && state}
            </div>
            <RegisterButton />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
 
function RegisterButton() {
  const { pending } = useFormStatus()
 
  return (
    <Button className="w-full" aria-disabled={pending}>
      {pending ? 'Creating account...' : 'Register'}
    </Button>
  )
}
