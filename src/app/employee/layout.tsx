'use client'

import { ReactNode, useEffect } from 'react'

export default function EmployeeLayout({ children }: { children: ReactNode }) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error)
    }
  }, [])

  return (
    <>
      <link rel="manifest" href="/manifest.json" />
      <meta name="theme-color" content="#059669" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="Realize Attendance" />
      <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      <div className="min-h-screen bg-slate-50">
        {children}
      </div>
    </>
  )
}