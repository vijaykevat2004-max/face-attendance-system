'use client'

import { formatTime } from '@/lib/salary'

export interface CalendarDayData {
  date: string
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'LEAVE' | 'SUNDAY' | 'FUTURE' | 'NO_DATA'
  checkIn?: string | null
  checkOut?: string | null
  overtimeHours?: number
}

const STATUS_STYLE: Record<CalendarDayData['status'], { bg: string; text: string; label: string }> = {
  PRESENT: { bg: 'bg-emerald-500', text: 'text-white', label: 'Present' },
  LATE: { bg: 'bg-amber-400', text: 'text-white', label: 'Late' },
  HALF_DAY: { bg: 'bg-amber-400', text: 'text-white', label: 'Half Day' },
  ABSENT: { bg: 'bg-red-500', text: 'text-white', label: 'Absent' },
  LEAVE: { bg: 'bg-blue-400', text: 'text-white', label: 'Leave' },
  SUNDAY: { bg: 'bg-slate-100', text: 'text-slate-400', label: 'Sunday' },
  FUTURE: { bg: 'bg-slate-50', text: 'text-slate-300', label: 'Upcoming' },
  NO_DATA: { bg: 'bg-slate-50', text: 'text-slate-300', label: 'Not yet joined' },
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export function AttendanceCalendar({ year, month, days }: { year: number; month: number; days: CalendarDayData[] }) {
  const firstDow = new Date(year, month - 1, 1).getDay()
  const leadingBlanks = Array.from({ length: firstDow })
  const dayNumber = (dateStr: string) => Number(dateStr.split('-')[2])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((w, i) => (
          <div key={i} className="text-center text-xs font-medium text-slate-400 pb-1">{w}</div>
        ))}
        {leadingBlanks.map((_, i) => <div key={`b${i}`} />)}
        {days.map((d) => {
          const style = STATUS_STYLE[d.status]
          const hasTimes = d.checkIn || d.checkOut
          const title = hasTimes
            ? `${style.label}${d.checkIn ? ` · In: ${formatTime(d.checkIn)}` : ''}${d.checkOut ? ` · Out: ${formatTime(d.checkOut)}` : ''}${d.overtimeHours ? ` · OT: ${d.overtimeHours.toFixed(1)}h` : ''}`
            : style.label
          return (
            <div
              key={d.date}
              title={title}
              className={`aspect-square rounded-md flex items-center justify-center text-xs font-semibold ${style.bg} ${style.text}`}
            >
              {dayNumber(d.date)}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-500 pt-1">
        <LegendDot color="bg-emerald-500" label="Present" />
        <LegendDot color="bg-amber-400" label="Late / Half Day" />
        <LegendDot color="bg-red-500" label="Absent" />
        <LegendDot color="bg-blue-400" label="Leave" />
        <LegendDot color="bg-slate-100" label="Sunday / Upcoming" />
      </div>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${color}`} /> {label}
    </span>
  )
}
