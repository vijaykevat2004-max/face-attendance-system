'use client'

import dynamic from 'next/dynamic'

const SiteCheckinFlow = dynamic(() => import('@/components/site-checkin-flow').then((m) => m.SiteCheckinFlow), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 rounded-2xl bg-emerald-600 animate-pulse mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading Site Attendance…</p>
      </div>
    </div>
  ),
})

export default function SiteCheckinPage() {
  return <SiteCheckinFlow />
}
