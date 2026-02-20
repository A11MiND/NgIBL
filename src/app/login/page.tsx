"use client"
 
import { useFormStatus } from 'react-dom'
import { useActionState } from 'react'
import { authenticate } from '@/lib/actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'

function RainingSymbols() {
  const symbols = ['🧪', '🔬', '🧫', '⚛️','🧲','E=mc2','📚']
  const [drops, setDrops] = useState<{ id: number; left: number; delay: number; symbol: string; duration: number }[]>([])

  useEffect(() => {
    const count = 20
    const newDrops = Array.from({ length: count }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 5,
      symbol: symbols[Math.floor(Math.random() * symbols.length)],
      duration: 3 + Math.random() * 4
    }))
    setDrops(newDrops)
  }, [])

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {drops.map((drop) => (
        <div
          key={drop.id}
          className="absolute top-[-50px] text-4xl opacity-20 animate-fall"
          style={{
            left: `${drop.left}%`,
            animation: `fall ${drop.duration}s linear infinite`,
            animationDelay: `${drop.delay}s`
          }}
        >
          {drop.symbol}
        </div>
      ))}
      <style jsx global>{`
        @keyframes fall {
          0% { transform: translateY(-50px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(100vh) rotate(360deg); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
 
export default function LoginPage() {
  const [errorMessage, dispatch] = useActionState(authenticate, undefined)
 
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 relative overflow-hidden px-4">
      <RainingSymbols />
      <Card className="w-full max-w-md z-10 bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <CardTitle>Teacher Login</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={dispatch} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" name="email" placeholder="m@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            <div className="flex items-center justify-between text-sm">
              <Link href="/register" className="text-blue-600 hover:underline">
                Don't have an account? Register
              </Link>
            </div>
            <div className="text-red-500 text-sm h-4">{errorMessage}</div>
            <LoginButton />
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
 
function LoginButton() {
  const { pending } = useFormStatus()
 
  return (
    <Button className="w-full" aria-disabled={pending}>
      {pending ? 'Logging in...' : 'Log in'}
    </Button>
  )
}
