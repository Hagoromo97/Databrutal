import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import bgDark from "../../icon/IMG_8601.jpeg"
import bgLight from "../../icon/IMG_8602.jpeg"
import { List, Info, Plus, Check, X, Edit2, Trash2, Search, Save, ArrowUp, ArrowDown, Truck, Loader2, SlidersHorizontal, CheckCircle2, MapPin, Route, AlertCircle, History, MapPinned, TableProperties, Shrink, Expand, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { RowInfoModal } from "./RowInfoModal"
import { DeliveryMap } from "@/components/DeliveryMap"
import { useEditMode } from "@/contexts/EditModeContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface RouteChangelog {
  id: string
  text: string
  created_at: string
}

async function appendChangelog(routeId: string, description: string): Promise<void> {
  try {
    await fetch('/api/route-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: crypto.randomUUID(),
        routeId,
        type: 'changelog',
        text: description,
      }),
    })
  } catch {
    // silently fail
  }
}

interface DeliveryPoint {
  code: string
  name: string
  delivery: string
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
  qrCodeImageUrl?: string
  qrCodeDestinationUrl?: string
  avatarImageUrl?: string
  avatarImages?: string[]
}

interface Route {
  id: string
  name: string
  code: string
  shift: string
  color?: string
  deliveryPoints: DeliveryPoint[]
  labels?: string[]
  updatedAt?: string
}

// Returns true if the delivery point is active on the given date
function isDeliveryActive(delivery: string, date: Date = new Date()): boolean {
  const dayOfWeek = date.getDay()   // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
  // Epoch day: stable across month/year boundaries (use local noon to avoid DST issues)
  const localNoon = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0)
  const epochDay  = Math.floor(localNoon.getTime() / 86400000)
  switch (delivery) {
    case 'Daily':     return true
    case 'Alt 1':     return epochDay % 2 !== 0                         // truly alternating day 1
    case 'Alt 2':     return epochDay % 2 === 0                         // truly alternating day 2
    case 'Weekday':   return dayOfWeek >= 0 && dayOfWeek <= 4           // Sun–Thu
    case 'Weekday 2': return dayOfWeek >= 1 && dayOfWeek <= 5           // Mon–Fri
    case 'Weekday 3': return [0, 2, 5].includes(dayOfWeek)             // Sun, Tue, Fri
    default:          return true
  }
}

// ── Distance helpers ──────────────────────────────────────────────
const DEFAULT_MAP_CENTER = { lat: 3.0695500, lng: 101.5469179 }

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function formatKm(km: number): string {
  const rounded = Math.round(km * 10) / 10
  return `${rounded % 1 === 0 ? rounded.toFixed(0) : rounded.toFixed(1)} Km`
}

const DEFAULT_ROUTES: Route[] = [
  {
    id: "route-1",
    name: "Route KL 7",
    code: "3PVK04",
    shift: "PM",
    deliveryPoints: [
      {
        code: "32",
        name: "KPJ Klang",
        delivery: "Daily",
        latitude: 3.0333,
        longitude: 101.4500,
        descriptions: [
          { key: "Bank", value: "CIMB" },
          { key: "Fuel", value: "Petrol" }
        ]
      },
      {
        code: "45",
        name: "Sunway Medical Centre",
        delivery: "Weekday",
        latitude: 3.0738,
        longitude: 101.6057,
        descriptions: []
      },
      {
        code: "78",
        name: "Gleneagles KL",
        delivery: "Alt 1",
        latitude: 3.1493,
        longitude: 101.7055,
        descriptions: [
          { key: "Contact", value: "03-42571300" }
        ]
      },
    ]
  },
  {
    id: "route-2",
    name: "Route KL 3",
    code: "3PVK08",
    shift: "AM",
    deliveryPoints: [
      {
        code: "11",
        name: "Hospital Kuala Lumpur",
        delivery: "Daily",
        latitude: 3.1691,
        longitude: 101.6974,
        descriptions: []
      },
      {
        code: "22",
        name: "Pantai Hospital KL",
        delivery: "Alt 2",
        latitude: 3.1102,
        longitude: 101.6629,
        descriptions: []
      },
    ]
  },
  {
    id: "route-3",
    name: "Route Sel 1",
    code: "3PVS02",
    shift: "AM",
    deliveryPoints: [
      {
        code: "51",
        name: "Hospital Shah Alam",
        delivery: "Daily",
        latitude: 3.0733,
        longitude: 101.5185,
        descriptions: []
      },
      {
        code: "52",
        name: "KPJ Shah Alam",
        delivery: "Weekday",
        latitude: 3.0888,
        longitude: 101.5326,
        descriptions: []
      },
    ]
  },
  {
    id: "route-4",
    name: "Route Sel 4",
    code: "3PVS09",
    shift: "PM",
    deliveryPoints: [
      {
        code: "61",
        name: "Hospital Klang",
        delivery: "Daily",
        latitude: 3.0449,
        longitude: 101.4456,
        descriptions: []
      },
    ]
  },
  {
    id: "route-5",
    name: "Route KL 11",
    code: "3PVK15",
    shift: "PM",
    deliveryPoints: [
      {
        code: "91",
        name: "Damansara Specialist",
        delivery: "Alt 1",
        latitude: 3.1500,
        longitude: 101.6200,
        descriptions: []
      },
    ]
  },
]

// ── Delivery type definitions ─────────────────────────────────────────────────
const DELIVERY_ITEMS = [
  { value: 'Daily',     label: 'Daily',     description: 'Delivery every day',          bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: '#10b981' },
  { value: 'Alt 1',    label: 'Alt 1',     description: 'Odd dates (1, 3, 5…)',         bg: 'bg-violet-100 dark:bg-violet-900/40',  text: 'text-violet-700 dark:text-violet-300',  dot: '#8b5cf6' },
  { value: 'Alt 2',    label: 'Alt 2',     description: 'Even dates (2, 4, 6…)',        bg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40',text: 'text-fuchsia-700 dark:text-fuchsia-300',dot: '#d946ef' },
  { value: 'Weekday',   label: 'Weekday',   description: 'Sun – Thu',                    bg: 'bg-sky-100 dark:bg-sky-900/40',        text: 'text-sky-700 dark:text-sky-300',        dot: '#0ea5e9' },
  { value: 'Weekday 2', label: 'Weekday 2', description: 'Mon – Fri',                    bg: 'bg-blue-100 dark:bg-blue-900/40',      text: 'text-blue-700 dark:text-blue-300',      dot: '#3b82f6' },
  { value: 'Weekday 3', label: 'Weekday 3', description: 'Sun, Tue & Fri only',          bg: 'bg-indigo-100 dark:bg-indigo-900/40',  text: 'text-indigo-700 dark:text-indigo-300',  dot: '#6366f1' },
] as const
const DELIVERY_MAP = new Map<string, typeof DELIVERY_ITEMS[number]>(DELIVERY_ITEMS.map(d => [d.value, d]))

// ── Route card color palette (from Settings → Route Colours, stored in localStorage) ──
const DEFAULT_ROUTE_COLORS = ['#374151', '#7c3aed', '#0891b2', '#16a34a', '#dc2626', '#d97706']
const LS_ROUTE_COLORS = 'fcalendar_route_colors'
const getRouteColorPalette = (): string[] => {
  try { const v = localStorage.getItem(LS_ROUTE_COLORS); if (v) return JSON.parse(v) } catch { /**/ }
  return DEFAULT_ROUTE_COLORS
}

export function RouteList() {
  const { isEditMode, hasUnsavedChanges, isSaving, setHasUnsavedChanges, registerSaveHandler, saveChanges, registerDiscardHandler } = useEditMode()
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"))
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains("dark")))
    obs.observe(document.documentElement, { attributeFilter: ["class"] })
    return () => obs.disconnect()
  }, [])
  const [routes, setRoutes] = useState<Route[]>(DEFAULT_ROUTES)
  const routesSnapshotRef = useRef<Route[]>([])
  const [routeColorPalette, setRouteColorPalette] = useState<string[]>(getRouteColorPalette)
  const [isLoading, setIsLoading] = useState(true)
  const [currentRouteId, setCurrentRouteId] = useState<string>("route-1")
  const [infoModalOpen, setInfoModalOpen] = useState(false)
  const [selectedPoint, setSelectedPoint] = useState<DeliveryPoint | null>(null)
  const [addRouteDialogOpen, setAddRouteDialogOpen] = useState(false)
  const [editRouteDialogOpen, setEditRouteDialogOpen] = useState(false)
  const [deleteRouteConfirmOpen, setDeleteRouteConfirmOpen] = useState(false)
  const [editingRoute, setEditingRoute] = useState<Route | null>(null)
  const [routeToDelete, setRouteToDelete] = useState<Route | null>(null)
  const [newRoute, setNewRoute] = useState({ name: "", code: "", shift: "AM" })
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRegion, setFilterRegion] = useState<"all" | "KL" | "Sel">("all")
  const [filterShift, setFilterShift] = useState<"all" | "AM" | "PM">("all")
  const [showAllRoutes, setShowAllRoutes] = useState(false)

  // ── Per-card sliding panel state { info, edit } ───────────────────
  const [cardPanels, setCardPanels] = useState<Record<string, { info: boolean; edit: boolean }>>({})
  // ── Per-card changelog cache ───────────────────────────────────────
  const [cardChangelogs, setCardChangelogs] = useState<Record<string, { loading: boolean; entries: RouteChangelog[] }>>({})
  // ── Per-card edit form state ───────────────────────────────────────
  const [editPanelState, setEditPanelState] = useState<Record<string, { name: string; code: string; shift: string; color: string; labels: string[] }>>({})
  const getCardPanel = (id: string) => cardPanels[id] ?? { info: false, edit: false }

  // Close edit panels when edit mode turns off
  useEffect(() => {
    if (!isEditMode) {
      setCardPanels(prev => {
        const updated: typeof prev = {}
        for (const id in prev) { updated[id] = { info: prev[id].info, edit: false } }
        return updated
      })
      setEditPanelState({})
    }
  }, [isEditMode])

  // Sync route colour palette when Settings saves new colours
  useEffect(() => {
    const handler = () => setRouteColorPalette(getRouteColorPalette())
    window.addEventListener('fcalendar_route_colors_changed', handler)
    return () => window.removeEventListener('fcalendar_route_colors_changed', handler)
  }, [])

  // Fetch changelog when an info panel opens
  useEffect(() => {
    for (const [id, panel] of Object.entries(cardPanels)) {
      if (panel.info && !cardChangelogs[id]) {
        setCardChangelogs(prev => ({ ...prev, [id]: { loading: true, entries: [] } }))
        fetch(`/api/route-notes?routeId=${encodeURIComponent(id)}`)
          .then(r => r.json())
          .then(data => {
            setCardChangelogs(prev => ({
              ...prev,
              [id]: { loading: false, entries: data.success ? (data.changelog ?? []) : [] },
            }))
          })
          .catch(() => setCardChangelogs(prev => ({ ...prev, [id]: { loading: false, entries: [] } })))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardPanels])

  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [detailFullscreen, setDetailFullscreen] = useState(false)
  const [dialogView, setDialogView] = useState<'table' | 'map'>('table')

  // Responsive card dimensions — measure the actual container so CSS zoom is handled correctly
  const cardContainerRef = useRef<HTMLDivElement>(null)
  const [cardW, setCardW] = useState(300)
  const [cardH, setCardH] = useState(460)
  useEffect(() => {
    const el = cardContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      setCardW(Math.min(340, w))
      setCardH(Math.min(580, Math.max(400, window.innerHeight / 1.2 - 220)))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])


  // Pinned routes stored in localStorage
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem("fcalendar_pinned_routes") || "[]").map((r: { id: string }) => r.id)) }
    catch { return new Set() }
  })

  const togglePin = useCallback((route: Route) => {
    setPinnedIds(prev => {
      const next = new Set(prev)
      if (next.has(route.id)) {
        next.delete(route.id)
      } else {
        next.add(route.id)
      }
      // Persist full route objects so HomePage can display them
      const allPinned = routes
        .filter(r => next.has(r.id))
        .map(r => ({ id: r.id, name: r.name, code: r.code, shift: r.shift }))
      localStorage.setItem("fcalendar_pinned_routes", JSON.stringify(allPinned))
      window.dispatchEvent(new Event("fcalendar_pins_changed"))
      return next
    })
  }, [routes])

  // Fetch routes from database
  const fetchRoutes = useCallback(async (preserveCurrentId?: string) => {
    try {
      const res = await fetch('/api/routes')
      const data = await res.json()
      if (data.success && data.data.length > 0) {
        setRoutes(data.data.map((r: Route) => ({ ...r, color: r.color ?? null })))
        // Keep current route if it still exists, else go to first
        const stillExists = preserveCurrentId && data.data.some((r: Route) => r.id === preserveCurrentId)
        setCurrentRouteId(stillExists ? preserveCurrentId! : data.data[0].id)
      }
    } catch {
      /* fallback to default routes */
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch routes from database on mount
  useEffect(() => {
    fetchRoutes()
  }, [fetchRoutes])

  // Listen for external open-route events (e.g. from pinned route on home page)
  // Check after routes finish loading so the dialog can find the route
  useEffect(() => {
    if (isLoading) return
    const pending = sessionStorage.getItem('fcalendar_open_route')
    if (pending) {
      sessionStorage.removeItem('fcalendar_open_route')
      setCurrentRouteId(pending)
      setDetailDialogOpen(true)
    }
  }, [isLoading])


  const currentRoute = routes.find(r => r.id === currentRouteId)
  const deliveryPoints = currentRoute?.deliveryPoints || []
  const setDeliveryPoints = (updater: (prev: DeliveryPoint[]) => DeliveryPoint[]) => {
    setHasUnsavedChanges(true)
    setRoutes(prev => prev.map(route => 
      route.id === currentRouteId 
        ? { ...route, deliveryPoints: updater(route.deliveryPoints) }
        : route
    ))
  }
  // Filter routes based on search query + region, then sort A-Z / 1-10 by name
  const filteredRoutes = useMemo(() => {
    const list = routes.filter(route => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchSearch =
          route.name.toLowerCase().includes(query) ||
          route.code.toLowerCase().includes(query) ||
          route.shift.toLowerCase().includes(query)
        if (!matchSearch) return false
      }
      if (filterRegion !== "all") {
        const hay = (route.name + " " + route.code).toLowerCase()
        const needle = filterRegion.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      if (filterShift !== "all" && route.shift !== filterShift) return false
      return true
    })
    return [...list].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    )
  }, [routes, searchQuery, filterRegion, filterShift])

  // Reset showAllRoutes when search or filter changes
  useEffect(() => { setShowAllRoutes(false) }, [searchQuery, filterRegion, filterShift])

  // Only show first 3 route cards when collapsed
  const displayedRoutes = showAllRoutes ? filteredRoutes : filteredRoutes.slice(0, 4)

  const [editingCell, setEditingCell] = useState<{ rowCode: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [editError, setEditError] = useState<string>("")
  const [popoverOpen, setPopoverOpen] = useState<{ [key: string]: boolean }>({})
  const [selectedRows, setSelectedRows] = useState<string[]>([])
  const [addPointDialogOpen, setAddPointDialogOpen] = useState(false)
  const [newPoint, setNewPoint] = useState({
    code: "",
    name: "",
    delivery: "Daily" as string,
    latitude: 0,
    longitude: 0,
    descriptions: [] as { key: string; value: string }[]
  })
  const [codeError, setCodeError] = useState<string>("")
  const [actionModalOpen, setActionModalOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [selectedTargetRoute, setSelectedTargetRoute] = useState("")
  const [pendingSelectedRows, setPendingSelectedRows] = useState<string[]>([])
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false)
  const [deliveryModalCode, setDeliveryModalCode] = useState<string | null>(null)
  const [openKmTooltip, setOpenKmTooltip] = useState<string | null>(null)
  const [badgePopover, setBadgePopover] = useState<string | null>(null)
  const [editLabelInput, setEditLabelInput] = useState<Record<string, string>>({})
  // tracks locally-edited cells that haven't been pushed to DB yet
  const [pendingCellEdits, setPendingCellEdits] = useState<Set<string>>(new Set())

  // ── Settings Modal ────────────────────────────────────────────────
  type ColumnKey = 'no' | 'code' | 'name' | 'delivery' | 'km' | 'lat' | 'lng' | 'action'

  interface ColumnDef {
    key: ColumnKey
    label: string
    visible: boolean
  }

  const DEFAULT_COLUMNS: ColumnDef[] = [
    { key: 'no',       label: 'No',        visible: true  },
    { key: 'code',     label: 'Code',      visible: true  },
    { key: 'name',     label: 'Name',      visible: true  },
    { key: 'delivery', label: 'Delivery',  visible: true  },
    { key: 'km',       label: 'KM',        visible: false },
    { key: 'lat',      label: 'Latitude',  visible: false },
    { key: 'lng',      label: 'Longitude', visible: false },
    { key: 'action',   label: 'Action',    visible: true  },
  ]

  interface SavedRowOrder {
    id: string
    label: string
    order: string[]   // array of point.code in order
  }

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [settingsMenu, setSettingsMenu] = useState<'column' | 'row' | 'sorting'>('column')
  const [sortConflictPending, setSortConflictPending] = useState<SortType | null>(null)

  // Column Customize
  const [columns, setColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS)
  const [draftColumns, setDraftColumns] = useState<ColumnDef[]>(DEFAULT_COLUMNS)
  const [savedColumns, setSavedColumns] = useState<ColumnDef[] | null>(null)
  const [savedSort, setSavedSort] = useState<SortType | undefined>(undefined)
  const [columnApplyScopeOpen, setColumnApplyScopeOpen] = useState(false)
  const [routeColumnOverrides, setRouteColumnOverrides] = useState<Record<string, ColumnDef[]>>(() => {
    try { const s = localStorage.getItem('fcalendar_route_columns'); return s ? JSON.parse(s) : {} } catch { return {} }
  })
  const columnsDirty = useMemo(
    () => JSON.stringify(draftColumns) !== JSON.stringify(routeColumnOverrides[currentRouteId] ?? columns),
    [draftColumns, columns, routeColumnOverrides, currentRouteId]
  )
  const columnsHasSaved = savedColumns !== null

  // Row Customize
  type RowOrderEntry = { code: string; position: string; name: string; delivery: string }
  const buildRowEntries = (pts: typeof deliveryPoints): RowOrderEntry[] =>
    pts.map((p) => ({ code: p.code, position: '', name: p.name, delivery: p.delivery }))
  const [draftRowOrder, setDraftRowOrder] = useState<RowOrderEntry[]>([])
  const [savedRowOrders, setSavedRowOrders] = useState<SavedRowOrder[]>([])
  const [rowOrderError, setRowOrderError] = useState<string>("")
  const [rowSaving, setRowSaving] = useState(false)
  const [rowSaved, setRowSaved] = useState(false)

  // Sorting
  type SortType = { type: 'column'; key: ColumnKey; dir: 'asc' | 'desc' } | { type: 'saved'; id: string } | null
  const [activeSortConfig, setActiveSortConfig] = useState<SortType>(null)
  const [draftSort, setDraftSort] = useState<SortType>(null)

  const openSettings = (routeId: string) => {
    setCurrentRouteId(routeId)
    setDraftColumns([...(routeColumnOverrides[routeId] ?? columns)])
    setDraftRowOrder(buildRowEntries(routes.find(r => r.id === routeId)?.deliveryPoints || []))
    setDraftSort(activeSortConfig)
    setSettingsMenu('column')
    try {
      const stored = localStorage.getItem(`fcalendar_my_sorts_${routeId}`)
      const parsed = stored ? JSON.parse(stored) : []
      setSavedRowOrders(Array.isArray(parsed) ? parsed : [])
    } catch { setSavedRowOrders([]) }
    setSettingsOpen(true)
  }

  // Column helpers
  const moveDraftCol = (idx: number, dir: -1 | 1) => {
    const next = [...draftColumns]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    setDraftColumns(next)
  }

  // Row helpers
  const handleRowPositionChange = (code: string, val: string) => {
    if (val !== '' && !/^\d+$/.test(val)) return
    const isDup = val !== '' && draftRowOrder.some(r => r.code !== code && r.position !== '' && r.position === val)
    setDraftRowOrder(prev => prev.map(r => r.code === code ? { ...r, position: val } : r))
    setRowOrderError(isDup ? `Position ${val} is already used` : '')
  }

  const saveRowOrder = async () => {
    const filled = draftRowOrder.filter(r => r.position !== '')
    const positions = filled.map(r => parseInt(r.position))
    const hasDup = positions.length !== new Set(positions).size
    if (hasDup) { setRowOrderError('Duplicate position numbers'); return }
    setRowSaving(true)
    setRowSaved(false)
    await new Promise(r => setTimeout(r, 700))
    // Sort the filled rows by their position input
    const filledSorted = [...filled].sort((a, b) => parseInt(a.position) - parseInt(b.position))
    // Sort the unfilled rows by code (natural sort)
    const unfilled = draftRowOrder
      .filter(r => r.position === '')
      .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
    // Merge: filled positions first, then unfilled appended at the end
    const merged = [...filledSorted, ...unfilled].map((r, i) => ({ ...r, position: String(i + 1) }))
    setDraftRowOrder(merged)
    setRowSaving(false)
    setRowSaved(true)
    setTimeout(() => setRowSaved(false), 1500)
    const id = `roworder-${Date.now()}`
    const label = `Order ${savedRowOrders.length + 1} (${new Date().toLocaleTimeString()})`
    const newEntry = { id, label, order: merged.map(r => r.code) }
    setSavedRowOrders(prev => {
      const updated = [...prev, newEntry]
      try { localStorage.setItem(`fcalendar_my_sorts_${currentRouteId}`, JSON.stringify(updated)) } catch {}
      return updated
    })
    setRowOrderError('')
  }

  // Apply sort to deliveryPoints
  const sortedDeliveryPoints = useMemo(() => {
    const today = new Date()
    const sortByActive = (pts: DeliveryPoint[]) => {
      // Active rows first, disabled rows last (stable within each group)
      const active   = pts.filter(p =>  isDeliveryActive(p.delivery, today))
      const inactive = pts.filter(p => !isDeliveryActive(p.delivery, today))
      return [...active, ...inactive]
    }

    if (!activeSortConfig) {
      const byCode = [...deliveryPoints].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }))
      return sortByActive(byCode)
    }
    if (activeSortConfig.type === 'column') {
      const { key, dir } = activeSortConfig
      const fieldMap: Partial<Record<ColumnKey, keyof DeliveryPoint>> = {
        code: 'code', name: 'name', delivery: 'delivery'
      }
      const field = fieldMap[key]
      if (!field) return sortByActive(deliveryPoints)
      const sorted = [...deliveryPoints].sort((a, b) => {
        const av = a[field!] ?? ''
        const bv = b[field!] ?? ''
        if (av < bv) return dir === 'asc' ? -1 : 1
        if (av > bv) return dir === 'asc' ? 1 : -1
        return 0
      })
      return sortByActive(sorted)
    }
    if (activeSortConfig.type === 'saved') {
      const saved = savedRowOrders.find(s => s.id === activeSortConfig.id)
      if (!saved) return sortByActive(deliveryPoints)
      const sorted = [...deliveryPoints].sort((a, b) => {
        const ai = saved.order.indexOf(a.code)
        const bi = saved.order.indexOf(b.code)
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
      })
      return sortByActive(sorted)
    }
    return sortByActive(deliveryPoints)
  }, [deliveryPoints, activeSortConfig, savedRowOrders])

  // Effective columns – per-route override wins, falls back to global columns
  const effectiveColumns = routeColumnOverrides[currentRouteId] ?? columns

  // Compute distances for Km column
  // Default sort  → direct distance from map origin to each point (not cumulative)
  // Custom/saved  → cumulative chained: origin → Row1 → Row2 → Row3 …
  const isCustomSort = activeSortConfig !== null
  const pointDistances = useMemo(() => {
    const result: { display: number; segment: number }[] = []
    if (!isCustomSort) {
      // Direct distance mode: each row shows straight-line from origin
      for (const point of sortedDeliveryPoints) {
        const direct = haversineKm(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, point.latitude, point.longitude)
        result.push({ display: direct, segment: direct })
      }
    } else {
      // Cumulative chain mode: origin → Row1 → Row2 → Row3 …
      let cumulative = 0
      let prevLat = DEFAULT_MAP_CENTER.lat
      let prevLng = DEFAULT_MAP_CENTER.lng
      for (const point of sortedDeliveryPoints) {
        const segment = haversineKm(prevLat, prevLng, point.latitude, point.longitude)
        cumulative += segment
        result.push({ display: cumulative, segment })
        prevLat = point.latitude
        prevLng = point.longitude
      }
    }
    return result
  }, [sortedDeliveryPoints, isCustomSort])

  const startEdit = (rowCode: string, field: string, currentValue: string | number) => {
    if (!isEditMode) return
    const key = `${rowCode}-${field}`
    setEditingCell({ rowCode, field })
    setEditValue(String(currentValue))
    setPopoverOpen({ [key]: true })
  }

  const saveEdit = () => {
    if (!editingCell) return

    // Cross-route duplicate check when editing code
    if (editingCell.field === 'code' && editValue !== editingCell.rowCode) {
      const dupMsg = findDuplicateRoute(editValue)
      if (dupMsg) {
        setEditError(dupMsg)
        return
      }
    }
    setEditError("")
    
    const { rowCode, field } = editingCell
    setDeliveryPoints(prev => prev.map(point => {
      if (point.code === rowCode) {
        if (field === 'latitude' || field === 'longitude') {
          const numValue = parseFloat(editValue)
          if (!isNaN(numValue)) {
            return { ...point, [field]: numValue }
          }
        } else {
          return { ...point, [field]: editValue }
        }
      }
      return point
    }))
    // mark this cell as pending (locally edited, not yet saved to DB)
    setPendingCellEdits(prev => { const n = new Set(prev); n.add(`${rowCode}-${field}`); return n })
    cancelEdit()
  }

  const cancelEdit = () => {
    setEditingCell(null)
    setEditValue("")
    setEditError("")
    setPopoverOpen({})
  }

  const toggleRowSelection = (code: string) => {
    setSelectedRows(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    )
  }

  const toggleSelectAll = () => {
    if (selectedRows.length === deliveryPoints.length) {
      setSelectedRows([])
    } else {
      setSelectedRows(deliveryPoints.map(p => p.code))
    }
  }

  const findDuplicateRoute = (code: string): string | null => {
    for (const route of routes) {
      const exists = route.deliveryPoints.some(p => p.code === code)
      if (exists) {
        if (route.id === currentRouteId) return "Code already exists in this route"
        return `Code already exists in "${route.name}"`
      }
    }
    return null
  }

  const handleAddNewPoint = () => {
    const dupMsg = findDuplicateRoute(newPoint.code)
    if (dupMsg) {
      setCodeError(dupMsg)
      return
    }
    
    if (newPoint.code) {
      setDeliveryPoints(prev => [...prev, newPoint])
      const label = newPoint.name ? `"${newPoint.name}" (${newPoint.code})` : newPoint.code
      setNewPoint({
        code: "",
        name: "",
        delivery: "Daily",
        latitude: 0,
        longitude: 0,
        descriptions: []
      })
      setCodeError("")
      setAddPointDialogOpen(false)
      toast.success("Location added", {
        description: `${label} · ${newPoint.delivery} · remember to save`,
        icon: <MapPin className="size-4 text-primary" />,
        duration: 3000,
      })
    }
  }

  const handleCodeChange = (value: string) => {
    setNewPoint({ ...newPoint, code: value })
    if (value) {
      const dupMsg = findDuplicateRoute(value)
      setCodeError(dupMsg ?? "")
    } else {
      setCodeError("")
    }
  }

  const handleDoneClick = () => {
    setPendingSelectedRows(selectedRows)
    setActionModalOpen(true)
  }

  const handleDeleteRows = () => {
    const count = pendingSelectedRows.length
    setDeliveryPoints(prev => prev.filter(point => !pendingSelectedRows.includes(point.code)))
    setDeleteConfirmOpen(false)
    setActionModalOpen(false)
    setPendingSelectedRows([])
    setSelectedRows([])
    toast.success(`${count} location${count !== 1 ? 's' : ''} removed`, {
      description: "Remember to save your changes.",
      icon: <Trash2 className="size-4 text-primary" />,
      duration: 3000,
    })
  }

  const handleMoveRows = () => {
    if (selectedTargetRoute) {
      // Get the points to move
      const pointsToMove = deliveryPoints.filter(point => pendingSelectedRows.includes(point.code))
      
      setHasUnsavedChanges(true)
      // Move points to target route
      setRoutes(prev => prev.map(route => {
        if (route.id === selectedTargetRoute) {
          return { ...route, deliveryPoints: [...route.deliveryPoints, ...pointsToMove] }
        }
        if (route.id === currentRouteId) {
          return { ...route, deliveryPoints: route.deliveryPoints.filter(point => !pendingSelectedRows.includes(point.code)) }
        }
        return route
      }))
      
      const count = pendingSelectedRows.length
      const destName = routes.find(r => r.id === selectedTargetRoute)?.name ?? "another route"
      setMoveDialogOpen(false)
      setActionModalOpen(false)
      setPendingSelectedRows([])
      setSelectedRows([])
      setSelectedTargetRoute("")
      toast.success(`${count} location${count !== 1 ? 's' : ''} moved`, {
        description: `Moved to "${destName}" · remember to save.`,
        icon: <Route className="size-4 text-primary" />,
        duration: 3000,
      })
    }
  }

  const handleSaveRoute = () => {
    if (!editingRoute) return
    
    if (!editingRoute.name || !editingRoute.code) {
      toast.error("Name and Code are required", {
        description: "Please fill in both fields before saving.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
      return
    }

    setHasUnsavedChanges(true)
    setRoutes(prev => prev.map(r => 
      r.id === editingRoute.id ? editingRoute : r
    ))
    setEditRouteDialogOpen(false)
    const saved = editingRoute
    setEditingRoute(null)
    toast.success("Route updated", {
      description: `"${saved.name}" (${saved.code}) · remember to save.`,
      icon: <CheckCircle2 className="size-4 text-primary" />,
      duration: 3000,
    })
  }

  const doSave = useCallback(async () => {
    // Snapshot before state for changelog
    const before = routesSnapshotRef.current
    const res = await fetch('/api/routes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routes }),
    })
    const data = await res.json()
    if (!data.success) throw new Error(data.error || 'Save failed')
    // Record changelog entries per changed route
    // First pass: detect cross-route moves
    type MoveInfo = { code: string; name: string; fromId: string; fromName: string; toId: string; toName: string }
    const moves: MoveInfo[] = []
    routes.forEach(route => {
      const old = before.find(r => r.id === route.id)
      if (!old) return
      route.deliveryPoints.forEach(p => {
        if (!old.deliveryPoints.find(o => o.code === p.code)) {
          // This point is new in this route — check if it was removed from another route
          before.forEach(oldRoute => {
            if (oldRoute.id === route.id) return
            if (oldRoute.deliveryPoints.find(o => o.code === p.code)) {
              const newFrom = routes.find(r => r.id === oldRoute.id)
              if (newFrom && !newFrom.deliveryPoints.find(x => x.code === p.code)) {
                // Confirmed move: was in oldRoute, now in route
                moves.push({ code: p.code, name: p.name || p.code, fromId: oldRoute.id, fromName: oldRoute.name, toId: route.id, toName: route.name })
              }
            }
          })
        }
      })
    })
    const movedCodes = new Set(moves.map(m => m.code))

    routes.forEach(route => {
      const old = before.find(r => r.id === route.id)
      const changes: string[] = []
      if (!old) {
        changes.push(`Route "${route.name}" created`)
      } else {
        // ── Route-level metadata changes ──────────────────────────────
        if (old.name !== route.name)   changes.push(`Name changed: "${old.name}" → "${route.name}"`)
        if (old.code !== route.code)   changes.push(`Code changed: ${old.code} → ${route.code}`)
        if (old.shift !== route.shift) changes.push(`Shift changed: ${old.shift} → ${route.shift}`)
        if ((old.color ?? '') !== (route.color ?? ''))
          changes.push(`Color changed: ${old.color ?? 'none'} → ${route.color ?? 'none'}`)

        // Labels
        const oldLabels = (old.labels ?? []).slice().sort()
        const newLabels = (route.labels ?? []).slice().sort()
        if (JSON.stringify(oldLabels) !== JSON.stringify(newLabels)) {
          const addedL  = newLabels.filter(l => !oldLabels.includes(l))
          const removedL = oldLabels.filter(l => !newLabels.includes(l))
          if (addedL.length)   changes.push(`Labels added: ${addedL.join(", ")}`)
          if (removedL.length) changes.push(`Labels removed: ${removedL.join(", ")}`)
        }

        // ── Cross-route moves ─────────────────────────────────────────
        // Moves OUT from this route
        const movedOut = moves.filter(m => m.fromId === route.id)
        const movedOutByDest: Record<string, MoveInfo[]> = {}
        movedOut.forEach(m => { if (!movedOutByDest[m.toId]) movedOutByDest[m.toId] = []; movedOutByDest[m.toId].push(m) })
        Object.values(movedOutByDest).forEach(group => {
          const names = group.map(m => m.name).join(", ")
          changes.push(`Moved ${group.length} location${group.length > 1 ? 's' : ''} to "${group[0].toName}": ${names}`)
        })

        // Moves INTO this route
        const movedIn = moves.filter(m => m.toId === route.id)
        const movedInBySource: Record<string, MoveInfo[]> = {}
        movedIn.forEach(m => { if (!movedInBySource[m.fromId]) movedInBySource[m.fromId] = []; movedInBySource[m.fromId].push(m) })
        Object.values(movedInBySource).forEach(group => {
          const names = group.map(m => m.name).join(", ")
          changes.push(`Received ${group.length} location${group.length > 1 ? 's' : ''} from "${group[0].fromName}": ${names}`)
        })

        // ── Per-point add / remove / edit ─────────────────────────────
        const addedPts   = route.deliveryPoints.filter(p => !old.deliveryPoints.find(o => o.code === p.code) && !movedCodes.has(p.code))
        const removedPts = old.deliveryPoints.filter(o => !route.deliveryPoints.find(p => p.code === o.code) && !movedCodes.has(o.code))
        const editedPts  = route.deliveryPoints.filter(p => {
          const o = old.deliveryPoints.find(x => x.code === p.code)
          if (!o) return false
          const descChanged = JSON.stringify((o.descriptions ?? []).slice().sort((a,b) => a.key.localeCompare(b.key)))
                           !== JSON.stringify((p.descriptions ?? []).slice().sort((a,b) => a.key.localeCompare(b.key)))
          return o.name !== p.name || o.delivery !== p.delivery ||
                 o.latitude !== p.latitude || o.longitude !== p.longitude || descChanged
        })

        // Added / Removed — grouped summary
        if (addedPts.length)
          changes.push(`Added ${addedPts.length} location${addedPts.length > 1 ? 's' : ''}: ${addedPts.map(p => p.name || p.code).join(", ")}`)
        if (removedPts.length)
          changes.push(`Removed ${removedPts.length} location${removedPts.length > 1 ? 's' : ''}: ${removedPts.map(p => p.name || p.code).join(", ")}`)

        // Edited — per-field detail for each point
        editedPts.forEach(p => {
          const o = old.deliveryPoints.find(x => x.code === p.code)!
          if (o.name !== p.name)
            changes.push(`[${p.code}] Name: "${o.name}" → "${p.name}"`)
          if (o.delivery !== p.delivery)
            changes.push(`[${p.code}] Delivery: ${o.delivery} → ${p.delivery}`)
          if (o.latitude !== p.latitude || o.longitude !== p.longitude)
            changes.push(`[${p.code}] Coordinates updated (${o.latitude.toFixed(5)},${o.longitude.toFixed(5)} → ${p.latitude.toFixed(5)},${p.longitude.toFixed(5)})`)
          const oldDescs = JSON.stringify((o.descriptions ?? []).slice().sort((a,b) => a.key.localeCompare(b.key)))
          const newDescs = JSON.stringify((p.descriptions ?? []).slice().sort((a,b) => a.key.localeCompare(b.key)))
          if (oldDescs !== newDescs)
            changes.push(`[${p.code}] Description fields updated`)
        })

        // ── Reorder detection ────────────────────────────────────────
        const commonOldOrder = old.deliveryPoints.filter(o => route.deliveryPoints.find(p => p.code === o.code) && !movedCodes.has(o.code)).map(o => o.code)
        const commonNewOrder = route.deliveryPoints.filter(p => old.deliveryPoints.find(o => o.code === p.code) && !movedCodes.has(p.code)).map(p => p.code)
        if (commonOldOrder.join(',') !== commonNewOrder.join(','))
          changes.push(`Location order changed (${commonNewOrder.length} location${commonNewOrder.length !== 1 ? 's' : ''} reordered)`)
      }
      changes.forEach(desc => { appendChangelog(route.id, desc) })
    })
    // Clear pending-edit markers once successfully persisted
    setPendingCellEdits(new Set())
    // Re-fetch from server so UI mirrors exactly what was persisted
    await fetchRoutes(currentRouteId)
    toast.success("Changes saved", {
      description: `All route data has been saved successfully.`,
      icon: <Save className="size-4 text-primary" />,
      duration: 3000,
    })
  }, [routes, fetchRoutes, currentRouteId])

  useEffect(() => {
    registerSaveHandler(doSave)
  }, [doSave, registerSaveHandler])

  // Snapshot routes when edit mode turns ON for instant discard
  useEffect(() => {
    if (isEditMode) {
      routesSnapshotRef.current = JSON.parse(JSON.stringify(routes))
    }
  }, [isEditMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Register discard handler — restore snapshot instantly, clear ALL edit-related state
  useEffect(() => {
    registerDiscardHandler(() => {
      // Restore data
      setRoutes(routesSnapshotRef.current)
      // Clear card panels
      setCardPanels({})
      setEditPanelState({})
      // Clear all cell-editing state
      setPendingCellEdits(new Set())
      setEditingCell(null)
      setEditValue("")
      setEditError("")
      setPopoverOpen({})
      // Clear row selection
      setSelectedRows([])
      // Close any open edit dialogs
      setAddPointDialogOpen(false)
      setDeliveryModalOpen(false)
      setDeliveryModalCode(null)
      setDeleteRouteConfirmOpen(false)
      setDetailDialogOpen(false)
      setEditingRoute(null)
      setSettingsOpen(false)
    })
  }, [registerDiscardHandler])

  const handleDeleteRoute = () => {
    if (!routeToDelete) return
    
    if (routes.length <= 1) {
      toast.error("Cannot delete the last route", {
        description: "At least one route must remain.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
      return
    }

    const deleted = routeToDelete
    setHasUnsavedChanges(true)
    setRoutes(prev => prev.filter(r => r.id !== routeToDelete.id))
    setDeleteRouteConfirmOpen(false)
    setRouteToDelete(null)
    
    // Switch to first available route if current route is deleted
    if (currentRouteId === routeToDelete.id) {
      const remainingRoutes = routes.filter(r => r.id !== routeToDelete.id)
      if (remainingRoutes.length > 0) {
        setCurrentRouteId(remainingRoutes[0].id)
      }
    }
    toast.success("Route removed", {
      description: `"${deleted.name}" (${deleted.code}) · remember to save.`,
      icon: <Trash2 className="size-4 text-primary" />,
      duration: 3000,
    })
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
        <span className="text-sm loading-text">Loading Routes…</span>
      </div>
    )
  }

  // Responsive scale helpers derived from card dimensions
  const scale      = Math.min(1, cardW / 340)
  const cardPad    = `${(1.25 * scale).toFixed(2)}rem`
  const cardPadV   = `${(1.0  * scale).toFixed(2)}rem`
  const cardFontLg = `${(1.1  * scale).toFixed(2)}rem`
  const cardFontSm = `${(0.75 * scale).toFixed(2)}rem`
  const cardFontXs = `${(0.65 * scale).toFixed(2)}rem`
  const rowPadH    = `${(0.65 * scale).toFixed(2)}rem`
  const rowPadV    = `${(0.42 * scale).toFixed(2)}rem`
  const rowGap     = `${(0.42 * scale).toFixed(2)}rem`
  const iconSz     = Math.round(20 * scale)
  const iconFs     = `${(0.55 * scale).toFixed(2)}rem`
  const badgeFs    = `${(0.72 * scale).toFixed(2)}rem`
  const btnFs      = `${(0.82 * scale).toFixed(2)}rem`
  const btnPad     = `${(0.6  * scale).toFixed(2)}rem`
  const bodyGap    = `${(0.45 * scale).toFixed(2)}rem`
  const previewRows = cardH >= 520 ? 5 : cardH >= 460 ? 4 : 3

  return (
    <div className="relative font-light flex-1 overflow-y-auto">
      {/* Backdrop overlay when badge popover is open */}
      {badgePopover && (
        <div
          className="fixed inset-0 z-40 backdrop-blur-[6px] bg-black/25 dark:bg-black/40 transition-all duration-200 animate-in fade-in"
          onClick={() => setBadgePopover(null)}
        />
      )}
      {/* Route List */}
      <div className="p-5 md:p-8 max-w-[1400px] mx-auto" style={{ paddingBottom: 'calc(5rem + env(safe-area-inset-bottom))' }}>
        {/* Page header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <List className="size-4 shrink-0 text-primary" />
            <h2 className="text-base font-semibold tracking-tight text-foreground">Route List</h2>
          </div>
          <p className="ml-7 text-sm text-muted-foreground leading-relaxed">
            {filteredRoutes.length} route{filteredRoutes.length !== 1 ? 's' : ''}
            {(filterRegion !== 'all' || filterShift !== 'all') && <span className="ml-1 text-primary font-medium">· filtered</span>}
          </p>
          <Separator className="mt-4" />
        </div>
        {/* Search + Filter */}
        <div className="mb-6 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50 pointer-events-none" />
            <input
              type="text"
              placeholder="Search routes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full h-12 pl-11 pr-10 bg-card rounded-xl text-sm placeholder:text-muted-foreground/40 outline-none ring-1 ring-border/60 focus:ring-2 focus:ring-primary/40 shadow-sm transition-shadow"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground transition-colors"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Single Filter Button */}
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={`relative h-12 w-12 flex items-center justify-center rounded-xl ring-1 shadow-sm transition-colors ${
                  filterRegion !== "all" || filterShift !== "all"
                    ? "bg-primary text-primary-foreground ring-primary"
                    : "bg-card text-muted-foreground ring-border/60 hover:bg-muted"
                }`}
              >
                <SlidersHorizontal className="size-5" />
                {(filterRegion !== "all" || filterShift !== "all") && (
                  <span className="absolute -top-1 -right-1 size-2.5 rounded-full bg-orange-400 ring-2 ring-background" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-5 space-y-5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">Filter</span>
                {(filterRegion !== "all" || filterShift !== "all") && (
                  <button
                    onClick={() => { setFilterRegion("all"); setFilterShift("all") }}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors font-medium"
                  >
                    Reset
                  </button>
                )}
              </div>

              {/* Region */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Region</p>
                <div className="flex gap-2">
                  {(["all", "KL", "Sel"] as const).map(r => (
                    <button
                      key={r}
                      onClick={() => setFilterRegion(r)}
                      className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${
                        filterRegion === r
                          ? r === "KL" ? "bg-blue-500 text-white shadow-sm"
                            : r === "Sel" ? "bg-red-500 text-white shadow-sm"
                            : "bg-foreground text-background shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                      }`}
                    >
                      {r === "all" ? "All" : r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Shift */}
              <div className="space-y-2.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shift</p>
                <div className="flex gap-2">
                  {(["all", "AM", "PM"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setFilterShift(s)}
                      className={`flex-1 h-9 rounded-lg text-xs font-semibold transition-all ${
                        filterShift === s
                          ? s === "AM" ? "bg-orange-500 text-white shadow-sm"
                            : s === "PM" ? "bg-indigo-500 text-white shadow-sm"
                            : "bg-foreground text-background shadow-sm"
                          : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                      }`}
                    >
                      {s === "all" ? "All" : s}
                    </button>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

        </div>

        {/* ── Card list ── */}
        <div ref={cardContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {displayedRoutes.map((route, routeIndex) => {
          const markerColor = route.color || routeColorPalette[routeIndex % routeColorPalette.length]
          const cardPanel = getCardPanel(route.id)
          const ep = editPanelState[route.id] ?? { name: route.name, code: route.code, shift: route.shift, color: route.color || markerColor, labels: route.labels ?? ['Daily', 'Weekday', 'Alt 1', 'Alt 2'] }
          return (
          <div key={route.id} style={{ display: 'flex', justifyContent: 'center' }}>
            {/* ── Route Card ── */}
            <div style={{ width: cardW, height: cardH, borderRadius: 22, overflow: 'hidden', position: 'relative', background: 'hsl(var(--card))', border: `1.5px solid ${markerColor}55`, boxShadow: `0 4px 24px ${markerColor}18, 0 0 0 1px ${markerColor}18` }}>
              {/* Background image – subtle */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: `url(${isDark ? bgDark : bgLight})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: isDark ? 0.42 : 0.26, zIndex: 0, pointerEvents: 'none' }} />
              {/* Sliding wrapper */}
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', width: cardW * 3, height: '100%', transform: cardPanel.edit ? `translateX(-${cardW * 2}px)` : cardPanel.info ? `translateX(-${cardW}px)` : 'translateX(0)', transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1)' }}>

                {/* ── Panel 1: Main card ── */}
                <div style={{ width: cardW, flexShrink: 0, display: 'flex', flexDirection: 'column', height: cardH }}>

                  {/* ── Colored header band ── */}
                  <div style={{ position: 'relative', background: 'transparent', overflow: 'hidden', flexShrink: 0, padding: `${cardPadV} ${cardPad} calc(${cardPadV} * 0.8)` }}>
                    {/* Header content */}
                    <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                      {/* Route name */}
                      <h3 style={{ margin: 0, marginTop: '0.5rem', fontSize: cardFontLg, fontWeight: 800, color: 'hsl(var(--foreground))', lineHeight: 1.25, wordBreak: 'break-word', textAlign: 'center' }}>Route {route.name}</h3>
                      {/* Code + shift — tight under name */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                        <span style={{ fontSize: cardFontSm, fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>{route.code}</span>
                        <span style={{ fontSize: cardFontSm, fontWeight: 800, color: route.shift === 'PM' ? '#c2410c' : route.shift === 'AM' ? '#1e3a8a' : 'hsl(var(--muted-foreground))' }}>{route.shift}</span>
                      </div>
                      {/* Pin (left) + stops (right) — bottom row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: `${(0.6 * Math.min(1, cardW / 340)).toFixed(2)}rem` }}>
                        <button
                          onClick={e => { e.stopPropagation(); togglePin(route) }}
                          title={pinnedIds.has(route.id) ? "Unpin from Home" : "Pin to Home"}
                          style={{
                            background: pinnedIds.has(route.id) ? `${markerColor}18` : 'hsl(var(--muted)/0.5)',
                            border: `1px solid ${pinnedIds.has(route.id) ? markerColor + '55' : 'hsl(var(--border)/0.6)'}`,
                            borderRadius: 10,
                            padding: `${rowPadV} ${rowPadH}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1,
                            transition: 'all 0.18s', gap: '0.3rem',
                          }}
                        >
                          <span style={{ fontSize: '0.9rem' }}>{pinnedIds.has(route.id) ? '📌' : '📍'}</span>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem' }}>
                            <span style={{ fontSize: cardFontXs, fontWeight: 700, color: pinnedIds.has(route.id) ? markerColor : 'hsl(var(--muted-foreground))', letterSpacing: '0.03em', lineHeight: 1 }}>
                              {pinnedIds.has(route.id) ? 'Pinned' : 'Pin'}
                            </span>
                            <span style={{ fontSize: `${(0.57 * Math.min(1, cardW / 340)).toFixed(2)}rem`, color: 'hsl(var(--muted-foreground))', opacity: 0.75, lineHeight: 1, whiteSpace: 'nowrap' }}>
                              {pinnedIds.has(route.id) ? 'Tap to unpin' : 'Show on Home'}
                            </span>
                          </div>
                        </button>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                          <span style={{ fontSize: `${(1.0 * Math.min(1, cardW / 340)).toFixed(2)}rem`, fontWeight: 900, color: isDark ? '#c0c7d0' : markerColor, lineHeight: 1 }}>{route.deliveryPoints.length}</span>
                          <span style={{ fontSize: iconFs, fontWeight: 700, color: isDark ? '#c0c7d0' : markerColor, opacity: isDark ? 0.85 : 0.6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>stops</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom separator */}
                    <div style={{ position: 'absolute', bottom: 0, left: cardPad, right: cardPad, height: 1, background: `linear-gradient(90deg, transparent, ${markerColor}30, transparent)` }} />
                  </div>

                  {/* ── Body ── */}
                  <div style={{ flex: 1, padding: `${rowGap} ${cardPad} 0`, display: 'flex', flexDirection: 'column', gap: bodyGap, overflow: 'hidden' }}>

                    {/* Stops list — responsive row count */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: rowGap }}>
                      {route.deliveryPoints.slice(0, previewRows).map((pt, i) => {
                        const hasCoords = pt.latitude !== 0 || pt.longitude !== 0
                        const km = hasCoords ? haversineKm(DEFAULT_MAP_CENTER.lat, DEFAULT_MAP_CENTER.lng, pt.latitude, pt.longitude) : null
                        return (
                          <div key={pt.code} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: cardFontSm, background: 'hsl(var(--muted)/0.5)', borderRadius: 10, padding: `${rowPadV} ${rowPadH}`, border: '1px solid hsl(var(--border)/0.6)' }}>
                            <span style={{ width: iconSz, height: iconSz, borderRadius: 6, background: `linear-gradient(135deg, ${markerColor}dd, ${markerColor}88)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: iconFs, fontWeight: 800, flexShrink: 0, boxShadow: `0 2px 6px ${markerColor}44` }}>{i + 1}</span>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'hsl(var(--foreground))', fontWeight: 600, minWidth: 0 }}>{pt.name}</span>
                            {km !== null && (
                              <span style={{ fontSize: cardFontXs, fontWeight: 600, color: 'hsl(var(--muted-foreground))', flexShrink: 0 }}>
                                {formatKm(km)}
                              </span>
                            )}
                          </div>
                        )
                      })}
                      {route.deliveryPoints.length === 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '1.5rem 0', color: 'hsl(var(--muted-foreground))' }}>
                          <MapPin style={{ width: 15, height: 15, opacity: 0.4 }} />
                          <span style={{ fontSize: '0.75rem', fontStyle: 'italic' }}>No delivery points yet</span>
                        </div>
                      )}
                    </div>

                    {/* +N more locations button */}
                    {route.deliveryPoints.length > previewRows && (
                      <>
                        <button
                          onClick={() => { setCurrentRouteId(route.id); setDetailDialogOpen(true) }}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: badgeFs, fontWeight: 700, color: isDark ? '#a0aab4' : markerColor, background: isDark ? 'rgba(160,170,180,0.08)' : `${markerColor}12`, border: isDark ? '1px dashed rgba(160,170,180,0.3)' : `1px dashed ${markerColor}50`, borderRadius: 8, padding: '0.3rem 0.6rem', cursor: 'pointer', transition: 'background 0.15s', width: '100%' }}
                          onMouseEnter={e => (e.currentTarget.style.background = isDark ? 'rgba(160,170,180,0.14)' : `${markerColor}22`)}
                          onMouseLeave={e => (e.currentTarget.style.background = isDark ? 'rgba(160,170,180,0.08)' : `${markerColor}12`)}
                        >
                          +{route.deliveryPoints.length - previewRows} more locations &nbsp;&rsaquo; view all
                        </button>
                        <div style={{ height: 1, background: isDark ? 'rgba(160,170,180,0.15)' : 'hsl(var(--border)/0.5)', margin: '0rem 0' }} />
                      </>
                    )}

                    {/* Divider */}
                    {route.deliveryPoints.length > 0 && (
                      <div style={{ height: 1, background: 'hsl(var(--border)/0.5)', margin: '0.2rem 0' }} />
                    )}

                    {/* Delivery type badges — centered + interactive */}
                    {(() => {
                      const grouped = route.deliveryPoints.reduce<Record<string, DeliveryPoint[]>>((acc, p) => {
                        if (!acc[p.delivery]) acc[p.delivery] = []
                        acc[p.delivery].push(p)
                        return acc
                      }, {})
                      return (
                        <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', justifyContent: 'center', paddingBottom: '0.2rem' }}>
                          {Object.entries(grouped).map(([type, pts]) => {
                            const popKey = `${route.id}-badge-${type}`
                            const isOpen = badgePopover === popKey
                            return (
                              <Popover key={type} open={isOpen} onOpenChange={open => setBadgePopover(open ? popKey : null)}>
                                <PopoverTrigger asChild>
                                  <span onClick={() => setBadgePopover(isOpen ? null : popKey)} style={{ display: 'inline-flex', alignItems: 'center', fontSize: badgeFs, fontWeight: 700, color: '#5a6070', background: 'linear-gradient(135deg, #e8eaed, #c8cdd6)', padding: '2px 9px', borderRadius: '6px', border: '1px solid #b0b8c4', flexShrink: 0, letterSpacing: '0.03em', textShadow: '0 1px 0 #fff8', cursor: 'pointer', opacity: isOpen ? 0.75 : 1, transition: 'opacity 0.15s' }}>
                                    {type}&nbsp;<span style={{ opacity: 0.55, fontWeight: 500 }}>&bull;</span>&nbsp;<span style={{ opacity: 0.75, fontWeight: 600 }}>{pts.length}</span>
                                  </span>
                                </PopoverTrigger>
                                <PopoverContent className="w-64 p-0 z-50 backdrop-blur-xl bg-background/90 dark:bg-card/90 border border-border/60 shadow-2xl rounded-2xl overflow-hidden" align="center" side="top">
                                  {/* Header */}
                                  <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/60" style={{ background: `${markerColor}14` }}>
                                    <span className="size-2.5 rounded-full shrink-0" style={{ background: markerColor }} />
                                    <span className="text-xs font-bold tracking-wide" style={{ color: markerColor }}>{type}</span>
                                    <span className="ml-auto text-[10px] font-semibold text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full">{pts.length}</span>
                                  </div>
                                  {/* Point list */}
                                  <div className="divide-y divide-border/30 max-h-48 overflow-y-auto">
                                    {pts.map(pt => (
                                      <div key={pt.code} className="flex items-center gap-2.5 px-3 py-2 group hover:bg-muted/60 transition-colors duration-100">
                                        <div className="flex-1 min-w-0">
                                          <p className="text-xs font-semibold truncate text-foreground leading-tight">{pt.name || pt.code}</p>
                                          <p className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">{pt.code}</p>
                                        </div>
                                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                          <button
                                            className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                                            title="Edit in table"
                                            onClick={() => { setBadgePopover(null); setCurrentRouteId(route.id); setDetailDialogOpen(true) }}
                                          >
                                            <Edit2 className="size-3" />
                                          </button>
                                          <button
                                            className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                            title="Delete"
                                            onClick={() => {
                                              setBadgePopover(null)
                                              setRoutes(prev => prev.map(r => r.id !== route.id ? r : {
                                                ...r,
                                                deliveryPoints: r.deliveryPoints.filter(p => p.code !== pt.code),
                                                updatedAt: new Date().toISOString()
                                              }))
                                              setHasUnsavedChanges(true)
                                            }}
                                          >
                                            <Trash2 className="size-3" />
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </PopoverContent>
                              </Popover>
                            )
                          })}

                        </div>
                      )
                    })()}
                  </div>{/* end Body */}

                  {/* Footer */}
                  <div style={{ padding: `${rowGap} ${cardPad} ${cardPadV}`, display: 'flex', gap: '0.45rem' }}>
                    {isEditMode && (
                      <button onClick={() => setCardPanels(prev => ({ ...prev, [route.id]: { info: false, edit: true } }))} style={{ flex: 1, borderRadius: 11, fontSize: btnFs, fontWeight: 700, padding: `${btnPad} 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: markerColor, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: `0 3px 10px ${markerColor}44` }}>
                        <Edit2 style={{ width: iconSz * 0.6, height: iconSz * 0.6 }} /> Edit
                      </button>
                    )}
                    <button onClick={() => setCardPanels(prev => ({ ...prev, [route.id]: { edit: false, info: true } }))} style={{ flex: 1, borderRadius: 11, fontSize: btnFs, fontWeight: 700, padding: `${btnPad} 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: markerColor, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: `0 3px 10px ${markerColor}44` }}>
                      <History style={{ width: iconSz * 0.6, height: iconSz * 0.6 }} /> Log
                    </button>
                    <button
                      onClick={() => { setCurrentRouteId(route.id); setDetailDialogOpen(true) }}
                      style={{ flex: 1, borderRadius: 11, fontSize: btnFs, fontWeight: 800, padding: `${btnPad} 0`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', background: `linear-gradient(135deg, ${markerColor} 0%, ${markerColor}cc 100%)`, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: `0 4px 14px ${markerColor}44`, letterSpacing: '0.02em' }}
                    >
                      <List style={{ width: iconSz * 0.65, height: iconSz * 0.65 }} /> View
                    </button>
                  </div>
                </div>

                {/* ── Panel 2: Changelog ── */}
                {(() => {
                  const cl = cardChangelogs[route.id]
                  const formatRelative = (iso: string) => {
                    const diff = Date.now() - new Date(iso).getTime()
                    const m = Math.floor(diff / 60000)
                    if (m < 1)  return 'Just now'
                    if (m < 60) return `${m}m ago`
                    const h = Math.floor(m / 60)
                    if (h < 24) return `${h}h ago`
                    const d = Math.floor(h / 24)
                    if (d < 30) return `${d}d ago`
                    return new Date(iso).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })
                  }
                  const formatExact = (iso: string) => new Date(iso).toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  return (
                  <div style={{ width: cardW, flexShrink: 0, height: cardH, display: 'flex', flexDirection: 'column', background: 'hsl(var(--card))', backdropFilter: 'blur(16px)' }}>
                    {/* Header */}
                    <div style={{ padding: '1rem 1.25rem 0.75rem', background: 'hsl(var(--background))', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: '0.65rem', flexShrink: 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'hsl(var(--foreground))', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          Changelog
                          {cl && !cl.loading && cl.entries.length > 0 && (
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, background: markerColor, color: '#fff', borderRadius: 999, padding: '1px 6px' }}>{cl.entries.length}</span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{route.name}</div>
                      </div>
                    </div>

                    {/* Updated timestamp banner */}
                    <div style={{ padding: '0.6rem 1.25rem', background: `${markerColor}20`, borderBottom: `1px solid ${markerColor}35`, display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: route.updatedAt ? markerColor : 'hsl(var(--muted-foreground))', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))' }}>Updated</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'hsl(var(--foreground))', flex: 1 }}>
                        {route.updatedAt ? formatRelative(route.updatedAt) : '—'}
                      </span>
                      {route.updatedAt && (
                        <span style={{ fontSize: '0.62rem', color: 'hsl(var(--muted-foreground))', textAlign: 'right' }}>
                          {formatExact(route.updatedAt)}
                        </span>
                      )}
                    </div>

                    {/* Changelog entries */}
                    <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0' }}>
                      {cl?.loading ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.5rem', color: 'hsl(var(--muted-foreground))' }}>
                          <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                          <span style={{ fontSize: '0.78rem' }}>Loading…</span>
                        </div>
                      ) : !cl || cl.entries.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '0.5rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center' }}>
                          <History style={{ width: 28, height: 28, opacity: 0.2 }} />
                          <span style={{ fontSize: '0.78rem' }}>No changes recorded yet</span>
                        </div>
                      ) : (
                        cl.entries.map((entry, i) => (
                          <div key={entry.id} style={{ display: 'flex', gap: '0.65rem', paddingBottom: i < cl.entries.length - 1 ? '0.75rem' : 0, marginBottom: i < cl.entries.length - 1 ? '0.75rem' : 0, borderBottom: i < cl.entries.length - 1 ? '1px solid hsl(var(--border)/0.5)' : 'none' }}>
                            {/* timeline dot */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, paddingTop: 3 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: markerColor, flexShrink: 0 }} />
                              {i < cl.entries.length - 1 && <div style={{ width: 1, flex: 1, background: `${markerColor}30`, marginTop: 3 }} />}
                            </div>
                            {/* content */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: '0 0 0.2rem', fontSize: '0.75rem', fontWeight: 500, color: 'hsl(var(--foreground))', lineHeight: 1.4 }}>{entry.text}</p>
                              <span style={{ fontSize: '0.65rem', color: 'hsl(var(--muted-foreground))' }}>{formatRelative(entry.created_at)}</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Footer */}
                    <div style={{ padding: '0.75rem 1.25rem 1.25rem', borderTop: '1px solid hsl(var(--border))', flexShrink: 0 }}>
                      <button
                        onClick={() => setCardPanels(prev => ({ ...prev, [route.id]: { info: false, edit: false } }))}
                        style={{ width: '100%', borderRadius: 10, fontSize: '0.8rem', fontWeight: 700, padding: '0.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', background: markerColor, color: '#fff', border: 'none', cursor: 'pointer', boxShadow: `0 3px 10px ${markerColor}44` }}
                      >
                        <ArrowDown style={{ width: 12, height: 12, transform: 'rotate(90deg)' }} /> Back to card
                      </button>
                    </div>
                  </div>
                  )
                })()}

                {/* ── Panel 3: Edit ── */}
                <div style={{ width: cardW, flexShrink: 0, height: cardH, display: 'flex', flexDirection: 'column', background: 'hsl(var(--card))' }}>
                  <div style={{ padding: '1rem 1.25rem 0.75rem', background: 'hsl(var(--background))', borderBottom: '1px solid hsl(var(--border))', display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: `linear-gradient(135deg, ${markerColor}, ${markerColor}bb)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Edit2 style={{ color: '#fff', width: 13, height: 13 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'hsl(var(--foreground))' }}>Edit Card</div>
                      <div style={{ fontSize: '0.67rem', color: 'hsl(var(--muted-foreground))' }}>Route · Code · Labels</div>
                    </div>
                  </div>
                  <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.4rem' }}>Route Name</label>
                      <input value={ep.name} onChange={e => setEditPanelState(prev => ({ ...prev, [route.id]: { ...ep, name: e.target.value } }))} placeholder="Route name..." style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1.5px solid hsl(var(--border))', fontSize: '0.84rem', fontWeight: 600, color: 'hsl(var(--foreground))', background: 'hsl(var(--background))', outline: 'none', boxSizing: 'border-box' }} onFocus={e => e.target.style.borderColor = markerColor} onBlur={e => e.target.style.borderColor = 'hsl(var(--border))'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.4rem' }}>Code</label>
                      <input value={ep.code} onChange={e => setEditPanelState(prev => ({ ...prev, [route.id]: { ...ep, code: e.target.value } }))} placeholder="Route code..." style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: 8, border: '1.5px solid hsl(var(--border))', fontSize: '0.84rem', fontWeight: 600, color: 'hsl(var(--foreground))', background: 'hsl(var(--background))', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} onFocus={e => e.target.style.borderColor = markerColor} onBlur={e => e.target.style.borderColor = 'hsl(var(--border))'} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.4rem' }}>Shift</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {['AM', 'PM'].map(opt => (
                          <button key={opt} onClick={() => setEditPanelState(prev => ({ ...prev, [route.id]: { ...ep, shift: opt } }))} style={{ flex: 1, padding: '0.55rem 0', borderRadius: 8, border: `2px solid ${ep.shift === opt ? ep.color : 'hsl(var(--border))'}`, background: ep.shift === opt ? ep.color : 'hsl(var(--muted))', color: ep.shift === opt ? '#fff' : 'hsl(var(--muted-foreground))', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>{opt}</button>
                        ))}
                      </div>
                    </div>
                    {/* Labels manager */}
                    <div>
                      <label style={{ fontSize: '0.67rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center', gap: 4, marginBottom: '0.4rem' }}>Labels</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.32rem', marginBottom: '0.45rem', minHeight: 24 }}>
                        {ep.labels.map((lbl) => {
                          return (
                            <span key={lbl} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${ep.color}18`, color: ep.color, fontSize: '0.72rem', fontWeight: 600, padding: '2px 10px 2px 11px', borderRadius: '999px', border: `1px solid ${ep.color}44` }}>
                              {lbl}
                              <button onClick={() => setEditPanelState(prev => ({ ...prev, [route.id]: { ...ep, labels: ep.labels.filter(l => l !== lbl) } }))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: ep.color, padding: '0 1px', display: 'flex', lineHeight: 1, opacity: 0.75, fontSize: '0.85rem' }}>×</button>
                            </span>
                          )
                        })}
                      </div>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <input
                          value={editLabelInput[route.id] ?? ''}
                          onChange={e => setEditLabelInput(prev => ({ ...prev, [route.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault()
                              const val = (editLabelInput[route.id] ?? '').trim()
                              if (val && !ep.labels.includes(val)) {
                                setEditPanelState(prev => ({ ...prev, [route.id]: { ...ep, labels: [...ep.labels, val] } }))
                                setEditLabelInput(prev => ({ ...prev, [route.id]: '' }))
                              }
                            }
                          }}
                          placeholder="New label, press Enter"
                          style={{ flex: 1, padding: '0.38rem 0.65rem', borderRadius: 7, border: '1.5px solid hsl(var(--border))', fontSize: '0.78rem', color: 'hsl(var(--foreground))', background: 'hsl(var(--background))', outline: 'none', boxSizing: 'border-box' }}
                          onFocus={e => e.target.style.borderColor = markerColor}
                          onBlur={e => e.target.style.borderColor = 'hsl(var(--border))'}
                        />
                        <button
                          onClick={() => {
                            const val = (editLabelInput[route.id] ?? '').trim()
                            if (val && !ep.labels.includes(val)) {
                              setEditPanelState(prev => ({ ...prev, [route.id]: { ...ep, labels: [...ep.labels, val] } }))
                              setEditLabelInput(prev => ({ ...prev, [route.id]: '' }))
                            }
                          }}
                          style={{ padding: '0.38rem 0.8rem', borderRadius: 7, background: markerColor, color: '#fff', border: 'none', fontSize: '0.82rem', fontWeight: 800, cursor: 'pointer' }}
                        >+</button>
                      </div>
                    </div>

                    <button onClick={() => { setCardPanels(prev => ({ ...prev, [route.id]: { info: false, edit: false } })); setRouteToDelete(route); setDeleteRouteConfirmOpen(true) }} style={{ borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', background: '#fee2e2', color: '#dc2626', border: '1px solid #fca5a5', cursor: 'pointer', width: '100%', justifyContent: 'center' }}>
                      <Trash2 style={{ width: 13, height: 13 }} /> Delete Route
                    </button>
                  </div>
                  <div style={{ padding: '0.75rem 1.25rem 1.25rem', display: 'flex', gap: '0.5rem', flexShrink: 0, borderTop: '1px solid hsl(var(--border))' }}>
                    <button onClick={() => { setCardPanels(prev => ({ ...prev, [route.id]: { info: false, edit: false } })); setEditPanelState(prev => { const n = { ...prev }; delete n[route.id]; return n }) }} style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem', fontWeight: 600, padding: '0.45rem 0', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'hsl(var(--muted))', color: 'hsl(var(--muted-foreground))', border: '1px solid hsl(var(--border))', cursor: 'pointer' }}>
                      <X style={{ width: 12, height: 12 }} /> Cancel
                    </button>
                    {(() => {
                      const hasEditChanges = ep.name !== route.name || ep.code !== route.code || ep.shift !== route.shift || ep.labels.join(',') !== (route.labels ?? ['Daily', 'Weekday', 'Alt 1', 'Alt 2']).join(',')
                      return (
                        <button
                          disabled={!hasEditChanges}
                          onClick={() => {
                            if (!ep.name || !ep.code) { toast.error('Name and Code required'); return }
                            setHasUnsavedChanges(true)
                            setRoutes(prev => prev.map(r => r.id === route.id ? { ...r, name: ep.name, code: ep.code, shift: ep.shift, color: ep.color, labels: ep.labels } : r))
                            setCardPanels(prev => ({ ...prev, [route.id]: { info: false, edit: false } }))
                            setEditPanelState(prev => { const n = { ...prev }; delete n[route.id]; return n })
                            toast.success('Route updated', { description: `"${ep.name}" · remember to save.`, icon: <CheckCircle2 className="size-4 text-primary" />, duration: 3000 })
                          }}
                          style={{ flex: 1, borderRadius: 8, fontSize: '0.8rem', fontWeight: 700, padding: '0.45rem 0', justifyContent: 'center', display: 'flex', alignItems: 'center', gap: '0.35rem', background: hasEditChanges ? markerColor : 'hsl(var(--muted))', color: hasEditChanges ? '#fff' : 'hsl(var(--muted-foreground))', border: 'none', cursor: hasEditChanges ? 'pointer' : 'not-allowed', opacity: hasEditChanges ? 1 : 0.5, transition: 'all 0.15s' }}
                        >
                          <Check style={{ width: 12, height: 12 }} /> Save
                        </button>
                      )
                    })()}
                  </div>
                </div>

              </div>{/* end sliding track */}
            </div>{/* end card */}

                  <Dialog open={detailDialogOpen && route.id === currentRouteId} onOpenChange={(open) => { if (!open) { setDetailDialogOpen(false); setDetailFullscreen(false); setDialogView('table'); setSelectedRows([]) } }}>
                  <DialogContent
                    className={`p-0 gap-0 flex flex-col overflow-hidden duration-300 ease-in-out ${
                      detailFullscreen
                        ? '!fixed !inset-0 !translate-x-0 !translate-y-0 !top-0 !left-0 !w-screen !max-w-none !h-dvh !rounded-none !border-0 !shadow-none'
                        : 'transition-[width,height,max-width,border-radius]'
                    }`}
                    style={detailFullscreen
                      ? {}
                      : { width: '92vw', maxWidth: '56rem', height: 'calc(5 * 44px + 96px)', borderRadius: '0.75rem' }
                    }
                  >
                    {/* Header */}
                    <div className="shrink-0 border-b border-border" style={{ background: `linear-gradient(135deg, ${markerColor}20 0%, ${markerColor}08 60%, transparent 100%)` }}>
                      {/* Color accent strip */}
                      <div style={{ height: 3, background: `linear-gradient(90deg, ${markerColor} 0%, ${markerColor}66 100%)` }} />
                      <div className="px-5 py-3 flex items-center gap-3">
                        {(route.name + " " + route.code).toLowerCase().includes("kl")
                          ? <img src="/kl-flag.png" className="object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/10 shrink-0" style={{ width: 42, height: 26, borderRadius: 4 }} alt="KL" />
                          : (route.name + " " + route.code).toLowerCase().includes("sel")
                          ? <img src="/selangor-flag.png" className="object-cover shadow-sm ring-1 ring-black/10 dark:ring-white/10 shrink-0" style={{ width: 42, height: 26, borderRadius: 4 }} alt="Selangor" />
                          : (
                            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${markerColor}25`, boxShadow: `0 0 0 1.5px ${markerColor}50` }}>
                              <Truck className="size-4" style={{ color: markerColor }} />
                            </div>
                          )}
                        <h1 className="flex-1 min-w-0 text-base font-bold leading-tight truncate">Route {route.name}</h1>
                        {/* Settings */}
                        <button
                          onClick={() => openSettings(route.id)}
                          title="Settings"
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          <SlidersHorizontal className="size-4" />
                        </button>
                        {/* Map / Table toggle */}
                        <button
                          onClick={() => setDialogView(v => v === 'table' ? 'map' : 'table')}
                          title={dialogView === 'table' ? 'Switch to Map' : 'Switch to Table'}
                          className="shrink-0 flex items-center justify-center transition-colors"
                          style={{ color: dialogView === 'map' ? markerColor : 'hsl(var(--muted-foreground))' }}
                        >
                          {dialogView === 'table' ? <MapPinned className="size-4" /> : <TableProperties className="size-4" />}
                        </button>
                        {/* Fullscreen */}
                        <button
                          onClick={() => setDetailFullscreen(f => !f)}
                          title={detailFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                        >
                          {detailFullscreen ? <Shrink className="size-4" /> : <Expand className="size-4" />}
                        </button>
                      </div>
                    </div>
                    {/* Table / Map */}
                    <div className="flex-1 overflow-auto scroll-smooth">
                    {dialogView === 'map' ? (
                      <div className="h-full min-h-[400px]">
                        <DeliveryMap deliveryPoints={deliveryPoints} scrollZoom={true} />
                      </div>
                    ) : (
                          <table className="border-collapse text-[12px] whitespace-nowrap min-w-max w-full text-center">
                            <thead className="sticky top-0 z-10 backdrop-blur-sm" style={{ background: 'hsl(var(--background)/0.92)' }}>
                              <tr>
                                {isEditMode && (
                                  <th className="px-4 h-10 text-center w-12 bg-background/95 border-b border-border/70">
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.length === deliveryPoints.length && deliveryPoints.length > 0}
                                      onChange={toggleSelectAll}
                                      className="w-4 h-4 rounded border-border cursor-pointer accent-primary"
                                    />
                                  </th>
                                )}
                                {effectiveColumns.filter(c => c.visible && c.key !== 'action' && !((c.key === 'lat' || c.key === 'lng') && !isEditMode)).map(col => (
                                  <th key={col.key} className="px-4 h-10 text-center text-[10px] font-bold uppercase tracking-wider bg-background/95 border-b border-border/70" style={{ color: 'hsl(var(--foreground)/0.72)' }}>{col.label}</th>
                                ))}
                                {effectiveColumns.find(c => c.key === 'action' && c.visible) && (
                                  <th className="px-4 h-10 text-center text-[10px] font-bold uppercase tracking-wider bg-background/95 border-b border-border/70" style={{ color: 'hsl(var(--foreground)/0.72)' }}>Action</th>
                                )}
                          </tr>
                        </thead>
                        <tbody>
                          {sortedDeliveryPoints.map((point, index) => {
                            const isActive = isDeliveryActive(point.delivery)
                            const distInfo = pointDistances[index]
                            const hasCoords = point.latitude !== 0 || point.longitude !== 0
                            const segmentLabel = !isCustomSort
                            ? `Origin → ${point.name || point.code}: ${hasCoords && distInfo ? formatKm(distInfo.display) : '-'}`
                            : index === 0
                              ? `Origin → ${point.name || point.code}: ${hasCoords && distInfo ? formatKm(distInfo.segment) : '-'}`
                              : `${sortedDeliveryPoints[index - 1].name || sortedDeliveryPoints[index - 1].code} → ${point.name || point.code}: ${hasCoords && distInfo ? formatKm(distInfo.segment) : '-'}`

                            const isEditingThisRow = editingCell?.rowCode === point.code
                            const hasRowPending = [...pendingCellEdits].some(k => k.startsWith(`${point.code}-`))
                            return (
                              <tr key={point.code} className={`border-b transition-colors duration-100 ${
                                isEditingThisRow
                                  ? 'border-primary/45 bg-primary/10'
                                  : hasRowPending
                                  ? 'border-amber-400/40 dark:border-amber-500/30 bg-amber-50/40 dark:bg-amber-900/10'
                                  : isActive
                                  ? index % 2 === 0 ? 'border-border/50 bg-background hover:bg-muted/30' : 'border-border/50 bg-muted/20 hover:bg-muted/35'
                                  : 'border-border/40 bg-muted/30 text-muted-foreground/80 hover:bg-muted/45'
                              }`}
                              >
                                {isEditMode && (
                                  <td className="px-4 h-12 text-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedRows.includes(point.code)}
                                      onChange={() => toggleRowSelection(point.code)}
                                      className="w-4 h-4 rounded border-border cursor-pointer accent-primary"
                                    />
                                  </td>
                                )}
                                {effectiveColumns.filter(c => c.visible).map(col => {
                                  if (col.key === 'no') return (
                                    <td key="no" className="px-4 h-10 text-center">
                                      <span className="text-[11px] font-semibold tabular-nums" style={{ color: markerColor }}>
                                        {index + 1}
                                      </span>
                                    </td>
                                  )
                                  if (col.key === 'code') return (
                                    <td key="code" className="px-4 h-10 text-center">
                                      {isEditMode ? (
                                      <Popover
                                        open={isEditMode && !!popoverOpen[`${point.code}-code`]}
                                        onOpenChange={(open) => {
                                          if (!isEditMode) return
                                          if (!open) cancelEdit()
                                          setPopoverOpen({ [`${point.code}-code`]: open })
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <button className="hover:bg-accent px-3 py-1 rounded flex items-center justify-center gap-1.5 group mx-auto" onClick={() => startEdit(point.code, 'code', point.code)}>
                                            <span className={pendingCellEdits.has(`${point.code}-code`) ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>{point.code}</span>
                                            <Edit2 className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72">
                                          <div className="space-y-3">
                                            <div className="space-y-2">
                                              <label className="text-sm font-medium">Code</label>
                                              <Input
                                                className={`text-center ${editError ? 'border-red-500 focus-visible:ring-red-500/30' : ''}`}
                                                value={editValue}
                                                onChange={(e) => {
                                                  const v = e.target.value
                                                  setEditValue(v)
                                                  if (v && v !== editingCell?.rowCode) {
                                                    const msg = findDuplicateRoute(v)
                                                    setEditError(msg ?? "")
                                                  } else {
                                                    setEditError("")
                                                  }
                                                }}
                                                placeholder="Enter code"
                                                autoFocus
                                                onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }}
                                              />
                                              {editError && <p className="text-xs text-red-500">{editError}</p>}
                                            </div>
                                            <div className="flex gap-2">
                                              <Button size="sm" onClick={saveEdit} disabled={!!editError} className="flex-1"><Check className="size-4 mr-1" /> Save</Button>
                                              <Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1"><X className="size-4 mr-1" /> Cancel</Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      ) : (<span className="text-[11px] font-semibold">{point.code}</span>)}
                                    </td>
                                  )
                                  if (col.key === 'name') return (
                                    <td key="name" className="px-3 h-9 text-center">
                                      {isEditMode ? (
                                      <Popover
                                        open={isEditMode && !!popoverOpen[`${point.code}-name`]}
                                        onOpenChange={(open) => {
                                          if (!isEditMode) return
                                          if (!open) cancelEdit()
                                          setPopoverOpen({ [`${point.code}-name`]: open })
                                        }}
                                      >
                                        <PopoverTrigger asChild>
                                          <button className="hover:bg-accent px-3 py-1 rounded flex items-center justify-center gap-1.5 group mx-auto" onClick={() => startEdit(point.code, 'name', point.name)}>
                                            <span className={pendingCellEdits.has(`${point.code}-name`) ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>{point.name}</span>
                                            <Edit2 className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                          </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-72">
                                          <div className="space-y-3">
                                            <div className="space-y-2">
                                              <label className="text-sm font-medium">Name</label>
                                              <Input className="text-center" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Enter name" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} />
                                            </div>
                                            <div className="flex gap-2">
                                              <Button size="sm" onClick={saveEdit} className="flex-1"><Check className="size-4 mr-1" /> Save</Button>
                                              <Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1"><X className="size-4 mr-1" /> Cancel</Button>
                                            </div>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      ) : (<span className="text-[11px] font-semibold">{point.name}</span>)}
                                    </td>
                                  )
                                  if (col.key === 'delivery') {
                                    const isPending = pendingCellEdits.has(`${point.code}-delivery`)
                                    return (
                                      <td key="delivery" className="px-3 h-9 text-center">
                                        {isEditMode ? (
                                          <button
                                            className="group inline-flex items-center gap-1.5 hover:opacity-70 transition-opacity mx-auto"
                                            onClick={() => {
                                              setDeliveryModalCode(point.code)
                                              setDeliveryModalOpen(true)
                                            }}
                                          >
                                            <span className={`text-[11px] font-semibold ${isPending ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                                              {point.delivery}
                                            </span>
                                            <Edit2 className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                          </button>
                                        ) : (
                                          <span className="text-[11px] font-semibold">{point.delivery}</span>
                                        )}
                                      </td>
                                    )
                                  }
                                  if (col.key === 'km') return (
                                    <td key="km" className="px-3 h-9 text-center">
                                      <TooltipProvider delayDuration={100}>
                                        <Tooltip
                                          open={openKmTooltip === point.code}
                                          onOpenChange={(open) => setOpenKmTooltip(open ? point.code : null)}
                                        >
                                          <TooltipTrigger
                                            type="button"
                                            className="text-[11px] font-semibold cursor-help tabular-nums"
                                            onClick={() => setOpenKmTooltip(prev => prev === point.code ? null : point.code)}
                                          >
                                            {hasCoords && distInfo ? formatKm(distInfo.display) : ''}
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs max-w-[220px] text-center z-[9999]">
                                            {segmentLabel}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    </td>
                                  )
                                  if (col.key === 'lat') {
                                    if (!isEditMode) return null
                                    return (
                                      <td key="lat" className="px-3 h-9 text-center font-mono">
                                        <Popover open={isEditMode && !!popoverOpen[`${point.code}-latitude`]} onOpenChange={(open) => { if (!isEditMode) return; if (!open) cancelEdit(); setPopoverOpen({ [`${point.code}-latitude`]: open }) }}>
                                          <PopoverTrigger asChild>
                                            <button className="hover:bg-accent px-3 py-1 rounded flex items-center justify-center gap-1.5 group font-mono mx-auto text-[11px]" onClick={() => startEdit(point.code, 'latitude', point.latitude.toFixed(4))}>
                                              <span className={pendingCellEdits.has(`${point.code}-latitude`) ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>{point.latitude.toFixed(4)}</span><Edit2 className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-64"><div className="space-y-3"><div className="space-y-2"><label className="text-sm font-medium">Latitude</label><Input className="text-center font-mono" type="number" step="0.0001" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Enter latitude" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} /></div><div className="flex gap-2"><Button size="sm" onClick={saveEdit} className="flex-1"><Check className="size-4 mr-1" /> Save</Button><Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1"><X className="size-4 mr-1" /> Cancel</Button></div></div></PopoverContent>
                                        </Popover>
                                      </td>
                                    )
                                  }
                                  if (col.key === 'lng') {
                                    if (!isEditMode) return null
                                    return (
                                      <td key="lng" className="px-3 h-9 text-center font-mono">
                                        <Popover open={isEditMode && !!popoverOpen[`${point.code}-longitude`]} onOpenChange={(open) => { if (!isEditMode) return; if (!open) cancelEdit(); setPopoverOpen({ [`${point.code}-longitude`]: open }) }}>
                                          <PopoverTrigger asChild>
                                            <button className="hover:bg-accent px-3 py-1 rounded flex items-center justify-center gap-1.5 group font-mono mx-auto text-[11px]" onClick={() => startEdit(point.code, 'longitude', point.longitude.toFixed(4))}>
                                              <span className={pendingCellEdits.has(`${point.code}-longitude`) ? 'text-amber-600 dark:text-amber-400 font-semibold' : ''}>{point.longitude.toFixed(4)}</span><Edit2 className="size-3 opacity-0 group-hover:opacity-50 transition-opacity" />
                                            </button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-64"><div className="space-y-3"><div className="space-y-2"><label className="text-sm font-medium">Longitude</label><Input className="text-center font-mono" type="number" step="0.0001" value={editValue} onChange={(e) => setEditValue(e.target.value)} placeholder="Enter longitude" autoFocus onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit() }} /></div><div className="flex gap-2"><Button size="sm" onClick={saveEdit} className="flex-1"><Check className="size-4 mr-1" /> Save</Button><Button size="sm" variant="outline" onClick={cancelEdit} className="flex-1"><X className="size-4 mr-1" /> Cancel</Button></div></div></PopoverContent>
                                        </Popover>
                                      </td>
                                    )
                                  }
                                  if (col.key === 'action') return null
                                  return null
                                })}
                                {effectiveColumns.find(c => c.key === 'action' && c.visible) && (
                                  <td className="px-3 h-9 text-center">
                                    <button
                                      className={`inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110 active:scale-95 ${
                                        isActive
                                          ? 'text-emerald-600 hover:bg-emerald-500/10'
                                          : 'text-rose-500 hover:bg-rose-500/10'
                                      }`}
                                      onClick={() => { setSelectedPoint(point); setInfoModalOpen(true) }}
                                    >
                                      <Info className="size-3.5" />
                                    </button>
                                  </td>
                                )}
                              </tr>
                            )
                          })}
                          
                          {/* Add New Row */}
                          {isEditMode && (
                          <tr 
                            className="border border-dashed border-border/60 hover:border-primary/50 hover:bg-primary/3 cursor-pointer transition-all duration-150 group"
                            onClick={() => {
                              setAddPointDialogOpen(true)
                              setCodeError("")
                            }}
                          >
                            <td colSpan={8} className="py-3 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-colors">
                                  <Plus className="size-3.5 text-primary" />
                                </div>
                                <span className="text-[12px] font-medium text-muted-foreground group-hover:text-primary transition-colors">
                                  Add New Delivery Point
                                </span>
                              </div>
                            </td>
                          </tr>
                          )}
                        </tbody>
                      </table>
                    )}
                    </div>
                    
                    {/* Action Buttons - Show when rows are selected in Edit Mode */}
                    {selectedRows.length > 0 && isEditMode && (
                      <div className="border-t border-border px-4 py-2.5 flex items-center justify-between shrink-0">
                        <span className="text-xs font-semibold text-primary">
                          {selectedRows.length} row{selectedRows.length > 1 ? 's' : ''} selected
                        </span>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setSelectedRows([])}>
                            <X className="size-3 mr-1" />Deselect
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 text-xs text-green-600 hover:text-green-600 hover:bg-green-500/10" onClick={handleDoneClick}>
                            <Check className="size-3 mr-1" />Action
                          </Button>
                        </div>
                      </div>
                    )}
                  </DialogContent>
                  </Dialog>
                
                {/* Action Modal - After Done is clicked */}
                <Dialog open={actionModalOpen} onOpenChange={setActionModalOpen}>
                  <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                          <Edit2 className="size-4 text-primary" />
                        </div>
                        <div>
                          <DialogTitle className="text-base font-bold">Manage Rows</DialogTitle>
                          <DialogDescription className="text-xs mt-0.5">
                            {pendingSelectedRows.length} row{pendingSelectedRows.length > 1 ? 's' : ''} selected
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="px-5 py-4 space-y-2.5">
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-background hover:bg-muted/60 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                        onClick={() => { setActionModalOpen(false); setMoveDialogOpen(true) }}
                        disabled={routes.length <= 1}
                      >
                        <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <ArrowUp className="size-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">Move to Route</p>
                          <p className="text-xs text-muted-foreground">{routes.length <= 1 ? 'Create another route first' : 'Transfer to another route'}</p>
                        </div>
                      </button>
                      <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 transition-colors text-left"
                        onClick={() => { setActionModalOpen(false); setDeleteConfirmOpen(true) }}
                      >
                        <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                          <Trash2 className="size-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-destructive">Delete Rows</p>
                          <p className="text-xs text-muted-foreground">Permanently remove selected rows</p>
                        </div>
                      </button>
                    </div>
                    <div className="px-5 pb-5 flex justify-end">
                      <Button variant="ghost" size="sm" onClick={() => { setActionModalOpen(false); setPendingSelectedRows([]); setSelectedRows([]) }}>
                        Cancel
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Move Dialog */}
                <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
                  <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                          <ArrowUp className="size-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <DialogTitle className="text-base font-bold">Move to Route</DialogTitle>
                          <DialogDescription className="text-xs mt-0.5">
                            {pendingSelectedRows.length} point{pendingSelectedRows.length > 1 ? 's' : ''} will be moved
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="px-5 py-4 space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Destination Route</label>
                      <select
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        value={selectedTargetRoute}
                        onChange={(e) => setSelectedTargetRoute(e.target.value)}
                      >
                        <option value="">Choose a route…</option>
                        {routes
                          .filter(route => route.id !== currentRouteId)
                          .map(route => (
                            <option key={route.id} value={route.id}>
                              {route.name} ({route.code} · {route.shift})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="px-5 pb-5 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setMoveDialogOpen(false); setActionModalOpen(true) }}>Back</Button>
                      <Button size="sm" onClick={handleMoveRows} disabled={!selectedTargetRoute}>
                        <ArrowUp className="size-3.5 mr-1" />Move
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Delete Confirmation Dialog */}
                <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
                  <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
                    <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                          <Trash2 className="size-4 text-destructive" />
                        </div>
                        <div>
                          <DialogTitle className="text-base font-bold">Delete Rows?</DialogTitle>
                          <DialogDescription className="text-xs mt-0.5">
                            This will permanently remove {pendingSelectedRows.length} point{pendingSelectedRows.length > 1 ? 's' : ''}.
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="px-5 py-4">
                      <p className="text-sm text-muted-foreground">This action <span className="font-semibold text-foreground">cannot be undone</span>. The selected delivery points will be permanently deleted.</p>
                    </div>
                    <div className="px-5 pb-5 flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setDeleteConfirmOpen(false); setActionModalOpen(true) }}>Cancel</Button>
                      <Button variant="destructive" size="sm" onClick={handleDeleteRows}>
                        <Trash2 className="size-3.5 mr-1" />Delete
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Add New Delivery Point Modal */}
                <Dialog open={addPointDialogOpen} onOpenChange={setAddPointDialogOpen}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Delivery Point</DialogTitle>
                      <DialogDescription>
                        Enter details for the new delivery location
                      </DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">
                            Code <span className="text-red-500">*</span>
                          </label>
                          <Input
                            placeholder="Enter code"
                            value={newPoint.code}
                            onChange={(e) => handleCodeChange(e.target.value)}
                            className={codeError ? "border-red-500" : ""}
                          />
                          {codeError && (
                            <p className="text-xs text-red-500">{codeError}</p>
                          )}
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Label</label>
                          <select
                            className="w-full p-2 rounded border border-border bg-background text-sm"
                            value={newPoint.delivery}
                            onChange={(e) => setNewPoint({ ...newPoint, delivery: e.target.value })}
                          >
                            {(currentRoute?.labels ?? ['Daily', 'Weekday', 'Alt 1', 'Alt 2']).map(lbl => (
                              <option key={lbl} value={lbl}>{lbl}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Name</label>
                        <Input
                          placeholder="Enter location name"
                          value={newPoint.name}
                          onChange={(e) => setNewPoint({ ...newPoint, name: e.target.value })}
                        />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Latitude</label>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            value={newPoint.latitude || ""}
                            onChange={(e) => setNewPoint({ ...newPoint, latitude: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Longitude</label>
                          <Input
                            type="number"
                            step="0.0001"
                            placeholder="0.0000"
                            value={newPoint.longitude || ""}
                            onChange={(e) => setNewPoint({ ...newPoint, longitude: parseFloat(e.target.value) || 0 })}
                          />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setAddPointDialogOpen(false)
                          setCodeError("")
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddNewPoint}
                        disabled={!newPoint.code || !!codeError}
                      >
                        Add Point
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
                
                {/* Delivery Edit Modal */}
                <Dialog open={deliveryModalOpen && currentRouteId === route.id} onOpenChange={(open) => {
                  setDeliveryModalOpen(open)
                  if (!open) setDeliveryModalCode(null)
                }}>
                  <DialogContent className="max-w-xs p-0 gap-0 overflow-hidden rounded-2xl">
                    <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
                      <DialogTitle className="text-base font-bold">Delivery Type</DialogTitle>
                      <DialogDescription className="text-xs">
                        {deliveryModalCode && (() => {
                          const pt = deliveryPoints.find(p => p.code === deliveryModalCode)
                          if (!pt) return ''
                          const active = isDeliveryActive(pt.delivery)
                          return (
                            <span className="flex items-center gap-2">
                              <span>{pt.code} — {pt.name}</span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                active ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${ active ? 'bg-green-500' : 'bg-red-500' }`} />
                                {active ? 'ON' : 'OFF'}
                              </span>
                            </span>
                          )
                        })()}
                      </DialogDescription>
                    </DialogHeader>

                    {deliveryModalCode && (() => {
                      const pt = deliveryPoints.find(p => p.code === deliveryModalCode)
                      if (!pt) return null
                      // Build item list: known items + any unknown value already set
                      const extraVal = DELIVERY_MAP.has(pt.delivery) ? [] : [{ value: pt.delivery, label: pt.delivery, description: '(existing)', bg: 'bg-muted', text: 'text-muted-foreground', dot: '#6b7280' }]
                      const items = [...DELIVERY_ITEMS, ...extraVal]
                      return (
                        <div className="py-1.5 px-1.5">
                          {items.map(item => {
                            const isSelected = pt.delivery === item.value
                            return (
                              <button
                                key={item.value}
                                onClick={() => {
                                  setDeliveryPoints(prev => prev.map(p =>
                                    p.code === deliveryModalCode ? { ...p, delivery: item.value } : p
                                  ))
                                  if (deliveryModalCode) {
                                    setPendingCellEdits(prev => { const n = new Set(prev); n.add(`${deliveryModalCode}-delivery`); return n })
                                  }
                                }}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                                  isSelected ? 'bg-primary/10 dark:bg-primary/20' : 'hover:bg-muted/70'
                                }`}
                              >
                                <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ backgroundColor: item.dot }} />
                                <span className="flex-1 min-w-0">
                                  <span className={`block text-sm font-bold ${item.text}`}>{item.label}</span>
                                  <span className="block text-[11px] text-muted-foreground leading-tight">{item.description}</span>
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                                  isDeliveryActive(item.value) ? 'bg-green-500/15 text-green-700 dark:text-green-400' : 'bg-red-500/15 text-red-600 dark:text-red-400'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${isDeliveryActive(item.value) ? 'bg-green-500' : 'bg-red-500'}`} />
                                  {isDeliveryActive(item.value) ? 'ON' : 'OFF'}
                                </span>
                                {isSelected && <Check className="size-3.5 shrink-0 text-primary" />}
                              </button>
                            )
                          })}
                        </div>
                      )
                    })()}

                    <div className="px-5 pb-4 pt-2 flex justify-end border-t border-border">
                      <Button size="sm" variant="ghost" onClick={() => { setDeliveryModalOpen(false); setDeliveryModalCode(null) }}>Close</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Info Modal */}
                {selectedPoint && (
                  <RowInfoModal
                    open={infoModalOpen}
                    onOpenChange={setInfoModalOpen}
                    point={selectedPoint}
                    isEditMode={isEditMode}
                    onSave={(updated) => {
                      setDeliveryPoints(prev => prev.map(p => p.code === updated.code ? updated : p))
                      setSelectedPoint(updated)
                      setHasUnsavedChanges(true)
                    }}
                  />
                )}
          </div>
          )
        })}
        </div> {/* end card list */}
        {/* Show more / show less button */}
        {filteredRoutes.length > 4 && (
          <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', paddingTop: '0.25rem' }}>
            <button
              onClick={() => setShowAllRoutes(prev => !prev)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                fontSize: '0.78rem', fontWeight: 700,
                color: 'hsl(var(--muted-foreground))',
                background: 'hsl(var(--muted)/0.6)',
                border: '1.5px dashed hsl(var(--border))',
                borderRadius: 10, padding: '0.55rem 1.4rem',
                cursor: 'pointer', transition: 'background 0.15s, color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'hsl(var(--muted))'; e.currentTarget.style.color = 'hsl(var(--foreground))' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'hsl(var(--muted)/0.6)'; e.currentTarget.style.color = 'hsl(var(--muted-foreground))' }}
            >
              {showAllRoutes
                ? '↑ Show less'
                : `+ ${filteredRoutes.length - 4} more Route list — click to show all`}
            </button>
          </div>
        )}

        {/* No Results Message */}
        {filteredRoutes.length === 0 && (searchQuery || filterRegion !== "all") && (
          <div className="flex flex-col items-center justify-center py-16 text-center" style={{ width: '100%' }}>
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-muted/50 to-muted/30 flex items-center justify-center">
                <Search className="size-10 text-muted-foreground/50" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent blur-xl" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">No routes found</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              {searchQuery
                ? `No routes match "${searchQuery}".`
                : `No routes found in ${filterRegion === "KL" ? "Kuala Lumpur" : "Selangor"}.`}{" "}
              Try adjusting your search or filter.
            </p>
            {filterRegion !== "all" && (
              <button
                onClick={() => setFilterRegion("all")}
                className="mt-3 text-xs text-primary hover:underline"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
        
        {/* Add New Route Card */}
        {isEditMode && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center' }}><div
            onClick={() => setAddRouteDialogOpen(true)}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.background = '#6366f108' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'hsl(var(--border))'; e.currentTarget.style.background = 'transparent' }}
            style={{ width: cardW, height: cardH, borderRadius: 16, border: '2.5px dashed hsl(var(--border))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1.1rem', cursor: 'pointer', background: 'transparent', transition: 'border-color 0.25s, background 0.25s' }}
          >
            <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Plus style={{ width: 28, height: 28, color: 'hsl(var(--muted-foreground))' }} />
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'hsl(var(--muted-foreground))' }}>Add New Route</div>
              <div style={{ fontSize: '0.72rem', fontWeight: 500, color: 'hsl(var(--muted-foreground))', marginTop: 4, opacity: 0.7 }}>Click to create a route</div>
            </div>
          </div></div>{/* end Add New Route wrapper */}
          <Dialog open={addRouteDialogOpen} onOpenChange={setAddRouteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Route</DialogTitle>
                <DialogDescription>
                  Add a new delivery route with details
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name Route</label>
                  <Input
                    placeholder="Enter route name"
                    value={newRoute.name}
                    onChange={(e) => setNewRoute({ ...newRoute, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Code Route</label>
                  <Input
                    placeholder="Enter route code"
                    value={newRoute.code}
                    onChange={(e) => setNewRoute({ ...newRoute, code: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shift</label>
                  <select
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                    value={newRoute.shift}
                    onChange={(e) => setNewRoute({ ...newRoute, shift: e.target.value })}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setAddRouteDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    if (newRoute.name && newRoute.code) {
                      const newRouteData: Route = {
                        id: `route-${Date.now()}`,
                        name: newRoute.name,
                        code: newRoute.code,
                        shift: newRoute.shift,
                        deliveryPoints: []
                      }
                      setHasUnsavedChanges(true)
                      setRoutes(prev => [...prev, newRouteData])
                      setNewRoute({ name: "", code: "", shift: "AM" })
                      setAddRouteDialogOpen(false)
                    }
                  }}
                >
                  Create Route
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </>
        )}
        </div>

        {/* Edit Route Dialog */}
        <Dialog open={editRouteDialogOpen} onOpenChange={setEditRouteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Route</DialogTitle>
              <DialogDescription>
                Update route information
              </DialogDescription>
            </DialogHeader>
            
            {editingRoute && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Route Name *</label>
                  <Input
                    placeholder="Enter route name"
                    value={editingRoute.name}
                    onChange={(e) => setEditingRoute({ ...editingRoute, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Route Code *</label>
                  <Input
                    placeholder="Enter route code"
                    value={editingRoute.code}
                    onChange={(e) => setEditingRoute({ ...editingRoute, code: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Shift</label>
                  <select
                    value={editingRoute.shift}
                    onChange={(e) => setEditingRoute({ ...editingRoute, shift: e.target.value })}
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
                
                <div className="flex justify-between items-center pt-4">
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setRouteToDelete(editingRoute)
                      setEditRouteDialogOpen(false)
                      setDeleteRouteConfirmOpen(true)
                    }}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete Route
                  </Button>
                  
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditRouteDialogOpen(false)
                        setEditingRoute(null)
                      }}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleSaveRoute}>
                      <Check className="size-4 mr-2" />
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Route Confirmation Dialog */}
        <Dialog open={deleteRouteConfirmOpen} onOpenChange={setDeleteRouteConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-destructive">Delete Route</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this route?
              </DialogDescription>
            </DialogHeader>
            
            {routeToDelete && (
              <div className="space-y-4 py-4">
                <div className="bg-destructive/10 border border-destructive/50 rounded-md p-4">
                  <dl className="space-y-2">
                    <div>
                      <dt className="font-bold text-sm">Route Name</dt>
                      <dd className="ml-0 mb-2 text-sm">{routeToDelete.name}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-sm">Code</dt>
                      <dd className="ml-0 mb-2 text-sm">{routeToDelete.code}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-sm">Delivery Points</dt>
                      <dd className="ml-0 mb-2 text-sm">{routeToDelete.deliveryPoints.length} points</dd>
                    </div>
                  </dl>
                </div>
                
                <div className="bg-muted/50 rounded-md p-4">
                  <p className="text-sm text-muted-foreground">
                    <strong>Warning:</strong> This will permanently delete the route and all its delivery points. This action cannot be undone.
                  </p>
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteRouteConfirmOpen(false)
                      setRouteToDelete(null)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={handleDeleteRoute}
                  >
                    <Trash2 className="size-4 mr-2" />
                    Delete Route
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

      {/* ── Settings Modal ──────────────────────────────────────────── */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="w-[92vw] max-w-lg h-[74vh] max-h-[600px] overflow-hidden flex flex-col gap-0 p-0">
          <div className="px-6 pt-5 pb-0 shrink-0">
            <DialogHeader className="text-center items-center">
              <DialogTitle className="text-sm font-bold">Table Settings</DialogTitle>
              <DialogDescription className="text-xs">Customize how the table looks and behaves</DialogDescription>
            </DialogHeader>
          </div>

          {/* Tab Menu */}
          <div className="flex justify-center border-b border-border shrink-0 px-6 mt-3">
            {(['column', 'row', 'sorting'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setSettingsMenu(m)}
                className={`px-4 py-2.5 text-xs font-semibold capitalize border-b-2 transition-colors ${
                  settingsMenu === m
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'column' ? 'Column Customize' : m === 'row' ? 'Row Customize' : 'Sorting'}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">

            {/* ── COLUMN CUSTOMIZE ── */}
            {settingsMenu === 'column' && (
              <div className="p-6 space-y-4">
                <p className="text-[13px] text-muted-foreground">Toggle visibility and reorder columns.</p>
                <div className="space-y-2.5">
                  {draftColumns.map((col, idx) => {
                    if ((col.key === 'lat' || col.key === 'lng') && !isEditMode) return null
                    return (
                    <div key={col.key} className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-muted/20">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={() =>
                          setDraftColumns(prev =>
                            prev.map((c, i) => i === idx ? { ...c, visible: !c.visible } : c)
                          )
                        }
                        className="w-4 h-4 cursor-pointer accent-primary"
                      />
                      <span className="flex-1 text-[13px] font-medium">{col.label}</span>
                      <div className="flex gap-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={idx === 0}
                          onClick={() => moveDraftCol(idx, -1)}
                        >
                          <ArrowUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          disabled={idx === draftColumns.length - 1}
                          onClick={() => moveDraftCol(idx, 1)}
                        >
                          <ArrowDown className="size-4" />
                        </Button>
                      </div>
                    </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── ROW CUSTOMIZE ── */}
            {settingsMenu === 'row' && (
              <div className="p-6 space-y-4">
                <p className="text-[13px] text-muted-foreground">Input a position number to reorder rows. No duplicates allowed.</p>
                {rowOrderError && (
                  <p className="text-[13px] text-destructive font-medium">{rowOrderError}</p>
                )}
                <div className={`space-y-2.5 relative transition-opacity duration-300 ${rowSaving ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  {rowSaving && (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                      <div className="bg-background/90 backdrop-blur-sm rounded-xl px-5 py-3 flex items-center gap-2.5 shadow-lg border border-border">
                        <Loader2 className="size-5 animate-spin text-primary" />
                        <span className="text-[13px] font-semibold text-foreground">Sorting rows…</span>
                      </div>
                    </div>
                  )}
                  {draftRowOrder.map((row) => (
                    <div key={row.code} className="flex items-center gap-3 p-3.5 rounded-lg border border-border bg-muted/20">
                      <div className="relative w-16 shrink-0">
                        <Input
                          value={row.position}
                          onChange={(e) => handleRowPositionChange(row.code, e.target.value)}
                          onFocus={(e) => e.target.select()}
                          placeholder="#"
                          className={`w-16 text-center text-[13px] font-semibold ${
                            row.position !== '' && draftRowOrder.filter(r => r.position !== '' && r.position === row.position).length > 1
                              ? 'border-destructive focus-visible:ring-destructive/30'
                              : ''
                          }`}
                          inputMode="numeric"
                          maxLength={3}
                        />
                      </div>
                      <span className="w-20 text-[13px] font-mono font-semibold text-center">{row.code}</span>
                      <span className="flex-1 text-[13px] text-center">{row.name}</span>
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">{row.delivery}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SORTING ── */}
            {settingsMenu === 'sorting' && (
              <div className="p-6 space-y-5">
                {/* Sort by Column */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sort by Column</p>
                  <div className="rounded-xl border border-border overflow-hidden bg-background">
                    {([
                      { key: 'code'     as ColumnKey, label: 'Code' },
                      { key: 'name'     as ColumnKey, label: 'Name' },
                      { key: 'delivery' as ColumnKey, label: 'Delivery' },
                    ]).map(({ key, label }, i, arr) => {
                      const isActive = draftSort?.type === 'column' && draftSort.key === key
                      const dir = (isActive && draftSort.type === 'column') ? draftSort.dir : 'asc'
                      return (
                        <button
                          key={key}
                          onClick={() => {
                            if (isActive) {
                              setDraftSort({ type: 'column', key, dir: dir === 'asc' ? 'desc' : 'asc' })
                            } else {
                              setDraftSort({ type: 'column', key, dir: 'asc' })
                            }
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors${
                            i < arr.length - 1 ? ' border-b border-border/50' : ''
                          }${
                            isActive
                              ? ' text-primary font-semibold bg-primary/5'
                              : ' text-foreground hover:bg-muted/60'
                          }`}
                        >
                          <span>{label}</span>
                          {isActive
                            ? (dir === 'asc'
                                ? <ChevronUp className="w-4 h-4" />
                                : <ChevronDown className="w-4 h-4" />)
                            : <ChevronsUpDown className="w-4 h-4 text-muted-foreground/40" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* My Sort List */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Sort List</p>
                  <p className="text-xs text-muted-foreground">Saved custom row orders — specific to this route only.</p>
                  {savedRowOrders.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground text-sm bg-muted/20 rounded-xl border border-border/50">
                      <p>No saved sort orders yet.</p>
                      <p className="text-xs mt-1.5">Go to <strong>Row Customize</strong> and save a custom order.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedRowOrders.map((s) => (
                        <div key={s.id} className="flex items-center gap-2.5">
                          <button
                            onClick={() => setDraftSort({ type: 'saved', id: s.id })}
                            className={`flex-1 py-2.5 px-4 text-sm rounded-lg border transition-colors text-left font-medium ${
                              draftSort?.type === 'saved' && draftSort.id === s.id
                                ? 'border-primary bg-primary/10 text-primary shadow-sm'
                                : 'border-border hover:bg-muted hover:border-border/80'
                            }`}
                          >
                            {s.label}
                          </button>
                          <button
                            onClick={() => {
                              setSavedRowOrders(prev => {
                                const updated = prev.filter(r => r.id !== s.id)
                                try { localStorage.setItem(`fcalendar_my_sorts_${currentRouteId}`, JSON.stringify(updated)) } catch {}
                                return updated
                              })
                              if (draftSort?.type === 'saved' && draftSort.id === s.id) setDraftSort(null)
                            }}
                            className="p-2 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground shrink-0"
                            title="Delete this sort"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {draftSort && (
                  <button
                    onClick={() => setDraftSort(null)}
                    className="text-sm text-muted-foreground hover:text-destructive flex items-center gap-1.5 pt-1"
                  >
                    <X className="size-4" /> Clear sorting
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Footer Buttons ── */}
          <div className="border-t border-border pt-4 px-6 pb-6 shrink-0 bg-background">
            {settingsMenu === 'column' && (
              <div className="flex items-center gap-3">
                {columnsHasSaved && (
                  <button
                    className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                    onClick={() => { setDraftColumns([...DEFAULT_COLUMNS]); setSavedColumns(null) }}
                  >
                    Reset to Default
                  </button>
                )}
                <div className="flex-1" />
                {columnsDirty && (
                  <button
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    onClick={() => setColumnApplyScopeOpen(true)}
                  >
                    Apply Changes
                  </button>
                )}
              </div>
            )}

            {settingsMenu === 'row' && (
              <div className="flex items-center gap-3">
                <div className="flex-1" />
                {draftRowOrder.some(r => r.position !== '') && !rowOrderError && (
                  <button
                    disabled={rowSaving}
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                    onClick={saveRowOrder}
                  >
                    {rowSaving ? (
                      <><Loader2 className="size-3.5 animate-spin" />Saving…</>
                    ) : rowSaved ? (
                      <><Check className="size-3.5" />Saved!</>
                    ) : (
                      'Save Order'
                    )}
                  </button>
                )}
              </div>
            )}

            {settingsMenu === 'sorting' && (
              <div className="flex items-center gap-3">
                {savedSort !== undefined && (
                  <button
                    className="text-xs font-medium text-destructive hover:text-destructive/80 transition-colors"
                    onClick={() => { setDraftSort(null); setActiveSortConfig(null); setSavedSort(undefined) }}
                  >
                    Reset to Default
                  </button>
                )}
                <div className="flex-1" />
                {JSON.stringify(draftSort) !== JSON.stringify(activeSortConfig) && (
                  <button
                    className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
                    onClick={() => {
                      if (activeSortConfig?.type === 'saved' && draftSort?.type === 'column') {
                        setSortConflictPending(draftSort)
                      } else {
                        setActiveSortConfig(draftSort)
                        setSavedSort(draftSort)
                        setSettingsOpen(false)
                      }
                    }}
                  >
                    Apply Sorting
                  </button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Column Apply Scope Dialog */}
      <Dialog open={columnApplyScopeOpen} onOpenChange={setColumnApplyScopeOpen}>
        <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">
          <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center shrink-0">
                <TableProperties className="size-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold">Apply Column Settings</DialogTitle>
                <DialogDescription className="text-xs mt-0.5">
                  Where should this column layout be applied?
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="px-5 py-4 space-y-2.5">
            {/* Apply for all routes */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-background hover:bg-muted/60 transition-colors text-left group"
              onClick={() => {
                setColumns([...draftColumns])
                setSavedColumns([...draftColumns])
                // Clear all per-route overrides so global applies everywhere
                setRouteColumnOverrides({})
                try { localStorage.removeItem('fcalendar_route_columns') } catch {}
                setColumnApplyScopeOpen(false)
                setSettingsOpen(false)
              }}
            >
              <Route className="size-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Apply for All Routes</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                  Use this column layout across every route table
                </p>
              </div>
              <ChevronDown className="size-4 text-muted-foreground/40 -rotate-90 shrink-0" />
            </button>
            {/* Only this route */}
            <button
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border bg-background hover:bg-muted/60 transition-colors text-left group"
              onClick={() => {
                setRouteColumnOverrides(prev => {
                  const updated = { ...prev, [currentRouteId]: [...draftColumns] }
                  try { localStorage.setItem('fcalendar_route_columns', JSON.stringify(updated)) } catch {}
                  return updated
                })
                setSavedColumns([...draftColumns])
                setColumnApplyScopeOpen(false)
                setSettingsOpen(false)
              }}
            >
              <MapPin className="size-5 text-violet-600 dark:text-violet-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">Only This Route</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                  Apply only to <span className="font-semibold text-foreground">{currentRoute?.name ?? 'this route'}</span>
                </p>
              </div>
              <ChevronDown className="size-4 text-muted-foreground/40 -rotate-90 shrink-0" />
            </button>
          </div>
          <div className="px-5 pb-5 flex justify-end border-t border-border pt-3">
            <Button variant="ghost" size="sm" onClick={() => setColumnApplyScopeOpen(false)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sort Conflict Confirmation */}
      <Dialog open={!!sortConflictPending} onOpenChange={(o) => { if (!o) setSortConflictPending(null) }}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Switch Sort Method?</DialogTitle>
            <DialogDescription>
              You currently have a <strong>My Sort List</strong> order active. Applying this sort will replace it with{' '}
              <strong>
                {sortConflictPending?.type === 'column'
                  ? `${sortConflictPending.key} (${sortConflictPending.dir === 'asc' ? 'A → Z' : 'Z → A'})`
                  : 'a new sort'}
              </strong>{' '}
              and your custom order will no longer be in use.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setSortConflictPending(null)}>Cancel</Button>
            <Button size="sm" onClick={() => {
              setActiveSortConfig(sortConflictPending)
              setSavedSort(sortConflictPending)
              setSortConflictPending(null)
              setSettingsOpen(false)
            }}>Apply Anyway</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Floating Save Button */}
      {(hasUnsavedChanges || isSaving) && isEditMode && (
        <Button
          onClick={saveChanges}
          disabled={isSaving}
          className={
            `fixed bottom-6 right-6 z-50 shadow-lg hover:shadow-xl transition-all h-12 px-6 gap-2 ` +
            (isSaving
              ? 'bg-green-600 hover:bg-green-600 animate-pulse cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700')
          }
          size="lg"
        >
          {isSaving ? (
            <Loader2 className="size-5 animate-spin" />
          ) : (
            <Save className="size-5" />
          )}
          <span>
            {isSaving ? (
              <span className="inline-flex items-center gap-0.5">
                Saving
                <span className="inline-flex gap-0.5 ml-0.5">
                  <span className="animate-bounce [animation-delay:0ms]">.</span>
                  <span className="animate-bounce [animation-delay:150ms]">.</span>
                  <span className="animate-bounce [animation-delay:300ms]">.</span>
                </span>
              </span>
            ) : 'Save Changes'}
          </span>
        </Button>
      )}


    </div>
  )
}
