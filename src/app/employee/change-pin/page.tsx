'use client'

import { Suspense } from 'react'
import { EmployeeChangePinForm } from './change-pin-form'

export default function EmployeeChangePinPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-10 w-10 animate-spin border-4 border-emerald-600 border-t-transparent rounded-full" /></div>}>
      <EmployeeChangePinForm />
    </Suspense>
  )
}