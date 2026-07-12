'use client'

import dynamic from 'next/dynamic'

// Load app shell on client only — it uses camera / face-api which require browser APIs
const AppShell = dynamic(() => import('@/components/app-shell').then((m) => m.AppShell), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="h-12 w-12 rounded-2xl bg-emerald-600 animate-pulse mx-auto mb-3" />
        <p className="text-sm text-slate-500">Loading Realize Group Attendance System…</p>
      </div>
    </div>
  ),
})

export default function Home() {
  return <AppShell />
}
