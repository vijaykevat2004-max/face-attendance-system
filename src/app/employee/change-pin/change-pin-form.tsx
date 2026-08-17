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
import { Loader2, Building2, Key } from 'lucide-react'
import { toast } from 'sonner'

const changePinSchema = z.object({
  currentPin: z.string().min(6, 'Current PIN must be 6 digits').max(6, 'Current PIN must be 6 digits').regex(/^\d{6}$/, 'Current PIN must be 6 digits'),
  newPin: z.string().min(6, 'New PIN must be 6 digits').max(6, 'New PIN must be 6 digits').regex(/^\d{6}$/, 'New PIN must be 6 digits'),
  confirmPin: z.string().min(6, 'Confirm PIN must be 6 digits').max(6, 'Confirm PIN must be 6 digits').regex(/^\d{6}$/, 'Confirm PIN must be 6 digits'),
}).refine(data => data.newPin === data.confirmPin, {
  message: 'PINs do not match',
  path: ['confirmPin'],
})

type ChangePinForm = z.infer<typeof changePinSchema>

export function EmployeeChangePinForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/employee/dashboard'
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, watch, formState: { errors } } = useForm<ChangePinForm>({
    resolver: zodResolver(changePinSchema),
    defaultValues: { currentPin: '', newPin: '', confirmPin: '' },
  })

  const newPin = watch('newPin')

  const isWeakPin = (pin: string) => {
    if (pin.length !== 6 || !/^\d{6}$/.test(pin)) return true
    const weakPins = ['000000', '111111', '222222', '333333', '444444', '555555', '666666', '777777', '888888', '999999', '123456', '654321', '123123', '000001']
    return weakPins.includes(pin)
  }

  const onSubmit = async (data: ChangePinForm) => {
    if (isWeakPin(data.newPin)) {
      toast.error('PIN is too weak. Avoid patterns like 123456, 111111, etc.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/employee-auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      const result = await res.json()
      if (!res.ok) {
        toast.error(result.error || 'Failed to change PIN')
        return
      }
      toast.success('PIN changed successfully')
      router.push(redirectTo)
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
            <Key className="h-10 w-10 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Set Your PIN</CardTitle>
          <CardDescription>Create a secure 6-digit PIN for future logins</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="currentPin">Current PIN</Label>
              <Input
                id="currentPin"
                type="password"
                placeholder="••••••"
                autoComplete="current-password"
                inputMode="numeric"
                maxLength={6}
                {...register('currentPin')}
                disabled={loading}
              />
              {errors.currentPin && (
                <p className="text-sm text-red-600">{errors.currentPin.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newPin">New PIN</Label>
              <Input
                id="newPin"
                type="password"
                placeholder="••••••"
                autoComplete="new-password"
                inputMode="numeric"
                maxLength={6}
                {...register('newPin')}
                disabled={loading}
              />
              {errors.newPin && (
                <p className="text-sm text-red-600">{errors.newPin.message}</p>
              )}
              {newPin && isWeakPin(newPin) && (
                <p className="text-sm text-amber-600">This PIN is too weak. Choose a different one.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPin">Confirm New PIN</Label>
              <Input
                id="confirmPin"
                type="password"
                placeholder="••••••"
                autoComplete="new-password"
                inputMode="numeric"
                maxLength={6}
                {...register('confirmPin')}
                disabled={loading}
              />
              {errors.confirmPin && (
                <p className="text-sm text-red-600">{errors.confirmPin.message}</p>
              )}
            </div>
            <div className="text-xs text-slate-500 space-y-1">
              <p>• Must be exactly 6 digits</p>
              <p>• Avoid obvious patterns (123456, 111111, 654321, etc.)</p>
              <p>• Do not share your PIN with anyone</p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save PIN'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}