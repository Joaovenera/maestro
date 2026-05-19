"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, Users, Globe, ListOrdered, Server, KeyRound } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { href: "/dashboard",      label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients",        label: "Clientes",  icon: Users },
  { href: "/domains",        label: "Domínios",  icon: Globe },
  { href: "/deploys",        label: "Deploys",   icon: ListOrdered },
  { href: "/admin/api-keys", label: "API Keys",  icon: KeyRound },
]

export function Sidebar() {
  const path = usePathname()
  return (
    <aside className="w-56 min-h-screen bg-zinc-950 text-zinc-100 flex flex-col border-r border-zinc-800">
      <div className="px-5 py-4 border-b border-zinc-800 flex items-center gap-2">
        <Server className="w-5 h-5 text-indigo-400" />
        <span className="font-semibold tracking-tight">Maestro</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              path.startsWith(href)
                ? "bg-indigo-600 text-white"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="px-4 py-3 border-t border-zinc-800 text-xs text-zinc-600">
        VeneraHost Maestro v1
      </div>
    </aside>
  )
}
