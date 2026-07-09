'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScanFace, LogIn, Loader2, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

interface AdminInfo {
  id: string
  username: string
  name: string
}

export function AdminLogin({ onLogin }: { onLogin: (admin: AdminInfo) => void }) {
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Login failed')
        return
      }
      toast.success(`Welcome back, ${data.admin.name}`)
      onLogin(data.admin)
    } catch (e: any) {
      toast.error(e?.message || 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-emerald-50/40 to-slate-100 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-600/30">
            <ScanFace className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Face Attendance</h1>
            <p className="text-sm text-slate-500">AI-powered attendance & salary management</p>
          </div>
        </div>

        <Card className="shadow-xl border-slate-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-emerald-600" /> Administrator Login
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />}
                {loading ? 'Signing in…' : 'Sign In'}
              </Button>
              <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                <p className="font-medium text-slate-700 mb-1">Default credentials</p>
                <p>Username: <code className="bg-white px-1.5 py-0.5 rounded">admin</code></p>
                <p>Password: <code className="bg-white px-1.5 py-0.5 rounded">admin123</code></p>
              </div>
            </form>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Face Attendance System. Built with Next.js + face-api.js
        </p>
      </div>
    </div>
  )
}
