'use client'

import dynamic from 'next/dynamic'

const MyAttendanceFlow = dynamic(() => import('@/components/my-attendance-flow').then((m) => m.MyAttendanceFlow), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 rounded-2xl bg-emerald-600 animate-pulse mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading…</p>
      </div>
    </div>
  ),
})

export default function MyAttendancePage() {
  return <MyAttendanceFlow />
}
