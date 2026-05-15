import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ServiceStatus, ClientStatus, DeployStatus } from "./api"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function statusColor(status: ServiceStatus | ClientStatus | DeployStatus): string {
  const map: Record<string, string> = {
    running:     "bg-green-500/15 text-green-700 border-green-200",
    active:      "bg-green-500/15 text-green-700 border-green-200",
    success:     "bg-green-500/15 text-green-700 border-green-200",
    stopped:     "bg-zinc-500/15 text-zinc-600 border-zinc-200",
    cancelled:   "bg-zinc-500/15 text-zinc-600 border-zinc-200",
    error:       "bg-red-500/15 text-red-700 border-red-200",
    failed:      "bg-red-500/15 text-red-700 border-red-200",
    unreachable: "bg-red-500/15 text-red-700 border-red-200",
    suspended:   "bg-yellow-500/15 text-yellow-700 border-yellow-200",
    deploying:   "bg-blue-500/15 text-blue-700 border-blue-200",
    queued:      "bg-sky-500/15 text-sky-700 border-sky-200",
    unknown:     "bg-zinc-400/15 text-zinc-500 border-zinc-200",
  }
  return map[status] ?? "bg-zinc-400/15 text-zinc-500 border-zinc-200"
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
    timeZone: "UTC",
  })
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return "agora"
  if (m < 60) return `${m}min atrás`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h atrás`
  return `${Math.floor(h / 24)}d atrás`
}
