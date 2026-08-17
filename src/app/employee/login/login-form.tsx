'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Building2, Shield } from 'lucide-react'
import { toast } from 'sonner'

const loginSchema = z.object({
  employeeId: z.string().min(1, 'Employee ID is required'),
  pin: z.string().min(6, 'PIN must be 6 digits').max(6, 'PIN must be 6 digits').regex(/^\d{6}$/, 'PIN must be 6 digits'),
})

type LoginForm = z.infer<typeof loginSchema>

export function EmployeeLoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/employee/dashboard'
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { employeeId: '', pin: '' },
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const res = await fetch('/api/employee-auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Login failed')
        return
      }
      if (result.employee.mustChangePin) {
        router.push(`/employee/change-pin?redirect=${encodeURIComponent(redirectTo)}`)
      } else {
        router.push(redirectTo)
      }
    } catch {
      toast.error('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Building2 className="h-10 w-10 text-emerald-600" />
            <Shield className="h-10 w-10 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Employee Portal</CardTitle>
          <CardDescription>Realize Group Attendance System</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="employeeId">Employee ID</Label>
              <Input
                id="employeeId"
                placeholder="EMP-001"
                autoComplete="username"
                {...register('employeeId')}
                disabled={loading}
              />
              {errors.employeeId && (
                <p className="text-sm text-red-600">{errors.employeeId.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin">6-Digit PIN</Label>
              <Input
                id="pin"
                type="password"
                placeholder="••••••"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                {...register('pin')}
                disabled={loading}
              />
              {errors.pin && (
                <p className="text-sm text-red-600">{errors.pin.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-xs text-slate-500">
            Contact your administrator if you don&apos;t have a PIN or need to reset it.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}