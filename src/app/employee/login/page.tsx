'use client'

import { Suspense } from 'react'
import { EmployeeLoginForm } from './login-form'

export default function EmployeeLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="h-10 w-10 animate-spin border-4 border-emerald-600 border-t-transparent rounded-full" /></div>}>
      <EmployeeLoginForm />
    </Suspense>
  )
}