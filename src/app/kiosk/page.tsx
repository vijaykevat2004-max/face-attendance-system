'use client'

import dynamic from 'next/dynamic'

const KioskView = dynamic(() => import('@/components/kiosk-view').then((m) => m.KioskView), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-950">
      <div className="text-center">
        <div className="h-12 w-12 rounded-2xl bg-emerald-600 animate-pulse mx-auto mb-3" />
        <p className="text-sm text-slate-400">Loading Kiosk…</p>
      </div>
    </div>
  ),
})

export default function KioskPage() {
  return <KioskView />
}
