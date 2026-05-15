"use client"

import { useEffect, useState, useCallback } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from "recharts"
import { Cpu, MemoryStick, Wifi, HardDrive, RefreshCw, AlertCircle } from "lucide-react"
import type { HardwareMetric } from "@/lib/api"

// ── Time windows ──────────────────────────────────────────────────────────────

const WINDOWS = [
  { label: "1h",  minutes: 60 },
  { label: "6h",  minutes: 360 },
  { label: "24h", minutes: 1440 },
  { label: "7d",  minutes: 10080 },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string, minutes: number) {
  const d = new Date(iso)
  if (minutes <= 60) {
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
  }
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

function avg(arr: number[]) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}

function peak(arr: number[]) {
  return arr.length ? Math.max(...arr) : 0
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col items-center bg-zinc-50 border rounded-lg px-4 py-2 min-w-[90px]">
      <span className="text-xs text-zinc-400">{label}</span>
      <span className={`text-sm font-bold mt-0.5 ${color}`}>{value}</span>
    </div>
  )
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label, minutes }: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; unit: string }>
  label?: string
  minutes: number
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="bg-white border border-zinc-200 rounded-xl shadow-lg px-4 py-3 text-xs space-y-1.5 min-w-[160px]">
      <p className="font-mono text-zinc-400 text-[11px] mb-2">{fmtTime(label, minutes)}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-zinc-500">{p.name}</span>
          </span>
          <span className="font-semibold text-zinc-800">{p.value?.toFixed(1)}{p.unit}</span>
        </div>
      ))}
    </div>
  )
}

// ── Mini chart section ────────────────────────────────────────────────────────

function MetricArea({
  data,
  dataKeys,
  minutes,
  height = 140,
  refLine,
}: {
  data: Record<string, unknown>[]
  dataKeys: Array<{ key: string; name: string; color: string; unit: string }>
  minutes: number
  height?: number
  refLine?: { value: number; label: string }
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
        <defs>
          {dataKeys.map(({ key, color }) => (
            <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
              <stop offset="95%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={(v) => fmtTime(v as string, minutes)}
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "#a1a1aa" }}
          tickLine={false}
          axisLine={false}
          width={36}
          tickFormatter={(v) => `${v}`}
        />
        <Tooltip
          content={<CustomTooltip minutes={minutes} />}
          cursor={{ stroke: "#e4e4e7", strokeWidth: 1 }}
        />
        <Legend
          iconType="circle"
          iconSize={7}
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
        />
        {refLine && (
          <ReferenceLine
            y={refLine.value}
            stroke="#ef4444"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{ value: refLine.label, position: "insideTopRight", fontSize: 10, fill: "#ef4444" }}
          />
        )}
        {dataKeys.map(({ key, name, color, unit }) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            name={name}
            stroke={color}
            strokeWidth={1.8}
            fill={`url(#grad-${key})`}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            unit={unit}
            isAnimationActive={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface HardwareChartProps {
  serviceId: string
  serviceName: string
  maxRamMb?: number
}

export function HardwareChart({ serviceId, serviceName, maxRamMb }: HardwareChartProps) {
  const [window, setWindow] = useState<typeof WINDOWS[number]>(WINDOWS[1]) // 1h default
  const [data, setData] = useState<HardwareMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<Date | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const to = new Date()
      const from = new Date(to.getTime() - window.minutes * 60 * 1000)
      const res = await fetch(
        `/api/metrics/hardware/${serviceId}?from=${from.toISOString()}&to=${to.toISOString()}`
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: HardwareMetric[] = await res.json()
      setData(json ?? [])
      setLastFetched(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido")
    } finally {
      setLoading(false)
    }
  }, [serviceId, window])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Derived stats ──────────────────────────────────────────────────────────

  const cpuValues   = data.map((d) => d.cpu_pct)
  const ramValues   = data.map((d) => d.ram_mb)
  const rxValues    = data.map((d) => d.net_rx_kb)
  const txValues    = data.map((d) => d.net_tx_kb)
  const diskRValues = data.map((d) => d.disk_read_kb)
  const diskWValues = data.map((d) => d.disk_write_kb)

  const avgCpu   = avg(cpuValues)
  const peakCpu  = peak(cpuValues)
  const avgRam   = avg(ramValues)
  const peakRam  = peak(ramValues)
  const avgRx    = avg(rxValues)
  const avgTx    = avg(txValues)
  const avgDiskR = avg(diskRValues)
  const avgDiskW = avg(diskWValues)

  // Recharts needs plain objects with known keys
  const chartData = data.map((d) => ({
    time:          d.time,
    cpu_pct:       +d.cpu_pct.toFixed(2),
    ram_mb:        +d.ram_mb.toFixed(1),
    net_rx_kb:     +d.net_rx_kb.toFixed(1),
    net_tx_kb:     +d.net_tx_kb.toFixed(1),
    disk_read_kb:  +d.disk_read_kb.toFixed(1),
    disk_write_kb: +d.disk_write_kb.toFixed(1),
  }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b bg-zinc-50/60">
        <div className="flex items-center gap-2">
          <Cpu className="w-4 h-4 text-zinc-500" />
          <span className="font-semibold text-sm text-zinc-800">{serviceName}</span>
          {data.length > 0 && (
            <span className="text-xs text-zinc-400 font-mono">{data.length} amostras</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Window selector */}
          <div className="flex gap-1 bg-zinc-100 rounded-lg p-1">
            {WINDOWS.map((w) => (
              <button
                key={w.label}
                onClick={() => setWindow(w)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all ${
                  window.label === w.label
                    ? "bg-white shadow-sm text-zinc-800"
                    : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          {/* Refresh */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-2 px-5 py-4 bg-red-50 text-red-600 text-sm border-b">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>Erro ao carregar métricas: {error}</span>
        </div>
      )}

      {/* No data */}
      {!loading && !error && data.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
          <Cpu className="w-8 h-8 mb-2 opacity-30" />
          <p className="text-sm">Sem dados de hardware para a janela selecionada.</p>
          <p className="text-xs mt-1 text-zinc-300">O worker coleta métricas a cada 15s enquanto o serviço está ativo.</p>
        </div>
      )}

      {/* Stats summary */}
      {data.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 px-5 py-3 border-b bg-white">
            <StatPill label="CPU médio"  value={`${avgCpu.toFixed(1)}%`}  color={avgCpu > 80 ? "text-red-600" : avgCpu > 60 ? "text-yellow-600" : "text-green-600"} />
            <StatPill label="CPU pico"   value={`${peakCpu.toFixed(1)}%`} color={peakCpu > 90 ? "text-red-600" : "text-zinc-700"} />
            <StatPill label="RAM média"  value={`${avgRam.toFixed(0)} MB`} color="text-indigo-600" />
            <StatPill label="RAM pico"   value={`${peakRam.toFixed(0)} MB`} color="text-zinc-700" />
            <StatPill label="RX médio"    value={`${avgRx.toFixed(0)} KB/s`}    color="text-cyan-600" />
            <StatPill label="TX médio"    value={`${avgTx.toFixed(0)} KB/s`}    color="text-violet-600" />
            <StatPill label="Disco leit." value={`${avgDiskR.toFixed(0)} KB/s`} color="text-emerald-600" />
            <StatPill label="Disco escr." value={`${avgDiskW.toFixed(0)} KB/s`} color="text-amber-600" />
            {lastFetched && (
              <span className="ml-auto self-center text-xs text-zinc-300 font-mono">
                atualizado {lastFetched.toLocaleTimeString("pt-BR")}
              </span>
            )}
          </div>

          {/* CPU chart */}
          <div className="px-5 pt-5">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">CPU</span>
              <span className="text-xs text-zinc-400">(%)</span>
            </div>
            <MetricArea
              data={chartData}
              minutes={window.minutes}
              dataKeys={[{ key: "cpu_pct", name: "CPU %", color: "#f97316", unit: "%" }]}
              height={130}
            />
          </div>

          {/* RAM chart */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <MemoryStick className="w-3.5 h-3.5 text-indigo-400" />
              <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">RAM</span>
              <span className="text-xs text-zinc-400">(MB)</span>
              {maxRamMb != null && maxRamMb > 0 && (
                <span className="ml-1 text-xs text-red-400 font-mono">limite: {maxRamMb} MB</span>
              )}
            </div>
            <MetricArea
              data={chartData}
              minutes={window.minutes}
              dataKeys={[{ key: "ram_mb", name: "RAM MB", color: "#6366f1", unit: " MB" }]}
              height={130}
              refLine={maxRamMb != null && maxRamMb > 0 ? { value: maxRamMb, label: `Quota ${maxRamMb} MB` } : undefined}
            />
          </div>

          {/* Network chart */}
          <div className="px-5 pt-4">
            <div className="flex items-center gap-2 mb-3">
              <Wifi className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Rede</span>
              <span className="text-xs text-zinc-400">(KB/s)</span>
            </div>
            <MetricArea
              data={chartData}
              minutes={window.minutes}
              dataKeys={[
                { key: "net_rx_kb", name: "RX (download)", color: "#06b6d4", unit: " KB/s" },
                { key: "net_tx_kb", name: "TX (upload)",   color: "#8b5cf6", unit: " KB/s" },
              ]}
              height={130}
            />
          </div>

          {/* Disk chart */}
          <div className="px-5 pt-4 pb-5">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-zinc-600 uppercase tracking-wide">Disco</span>
              <span className="text-xs text-zinc-400">(KB/s)</span>
            </div>
            <MetricArea
              data={chartData}
              minutes={window.minutes}
              dataKeys={[
                { key: "disk_read_kb",  name: "Leitura",  color: "#10b981", unit: " KB/s" },
                { key: "disk_write_kb", name: "Escrita",   color: "#f59e0b", unit: " KB/s" },
              ]}
              height={130}
            />
          </div>
        </>
      )}

      {/* Loading skeleton */}
      {loading && data.length === 0 && (
        <div className="px-5 py-8 space-y-4 animate-pulse">
          <div className="h-3 bg-zinc-100 rounded w-1/4" />
          <div className="h-32 bg-zinc-50 rounded-lg" />
          <div className="h-3 bg-zinc-100 rounded w-1/4" />
          <div className="h-32 bg-zinc-50 rounded-lg" />
          <div className="h-3 bg-zinc-100 rounded w-1/4" />
          <div className="h-32 bg-zinc-50 rounded-lg" />
        </div>
      )}
    </div>
  )
}
