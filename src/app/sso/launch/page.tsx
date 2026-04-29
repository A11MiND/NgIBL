'use client'

import { Suspense, useEffect, useState } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

function SsoLaunchContent() {
  const searchParams = useSearchParams()
  const [message, setMessage] = useState('Preparing IBL account...')

  useEffect(() => {
    const token = searchParams.get('token') || ''
    if (!token) {
      setMessage('Missing launch token.')
      return
    }
    signIn('credentials', {
      ssoToken: token,
      redirectTo: '/dashboard',
    }).catch(() => setMessage('IBL SSO launch failed.'))
  }, [searchParams])

  return <CardDescription>{message}</CardDescription>
}

export default function SsoLaunchPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle>IBL SSO</CardTitle>
          <Suspense fallback={<CardDescription>Preparing IBL account...</CardDescription>}>
            <SsoLaunchContent />
          </Suspense>
        </CardHeader>
      </Card>
    </main>
  )
}
