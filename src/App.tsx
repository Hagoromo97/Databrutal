import { useState, useEffect, lazy, Suspense, Component, type ErrorInfo, type ReactNode } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt"

const RouteList = lazy(() => import("@/components/RouteList").then(m => ({ default: m.RouteList })))
const Settings = lazy(() => import("@/components/Settings").then(m => ({ default: m.Settings })))
const PlanoVM = lazy(() => import("@/components/PlanoVM").then(m => ({ default: m.PlanoVM })))
const DeliveryTableDialog = lazy(() => import("@/components/Location").then(m => ({ default: m.DeliveryTableDialog })))
const Album = lazy(() => import("@/components/Album").then(m => ({ default: m.Album })))
const Rooster = lazy(() => import("@/components/Rooster").then(m => ({ default: m.Rooster })))
import { EditModeProvider } from "@/contexts/EditModeContext"
import { DeviceProvider } from "@/contexts/DeviceContext"
import { Toaster } from "sonner"
import { Home, Package, Settings2, Images, ChevronDown, Truck, List, Layers, MapPin, ClipboardList, Users } from "lucide-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"

const DAYS = [
  { en: "Monday",    my: "Isnin"  },
  { en: "Tuesday",   my: "Selasa" },
  { en: "Wednesday", my: "Rabu"   },
  { en: "Thursday",  my: "Khamis" },
  { en: "Friday",    my: "Jumaat" },
  { en: "Saturday",  my: "Sabtu"  },
  { en: "Sunday",    my: "Ahad"   },
]

const STOCK_IN_COLORS  = ["#3B82F6","#F97316","#92400E","#22C55E","#A855F7","#EC4899","#EAB308"]
const MOVE_FRONT_COLORS = ["#EAB308","#3B82F6","#F97316","#92400E","#22C55E","#A855F7","#EC4899"]
const EXPIRED_COLORS   = ["#EC4899","#EAB308","#3B82F6","#F97316","#92400E","#22C55E","#A855F7"]

const COLOR_LABELS: Record<string, string> = {
  "#3B82F6": "Blue",
  "#F97316": "Orange",
  "#92400E": "Brown",
  "#22C55E": "Green",
  "#A855F7": "Purple",
  "#EC4899": "Pink",
  "#EAB308": "Yellow",
}

function ColorPill({ color, size = "md" }: { color: string; size?: "sm" | "md" | "lg" }) {
  const label = COLOR_LABELS[color] ?? color
  const sizeClasses = size === "lg"
    ? "w-10 h-10"
    : size === "sm"
    ? "w-5 h-5"
    : "w-7 h-7"
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full shrink-0 ${sizeClasses}`}
      style={{ backgroundColor: color }}
      title={label}
    />
  )
}

function QuickActionCard({
  icon: Icon,
  label,
  description,
  page,
  iconClass,
  onNavigate,
}: {
  icon: React.ElementType
  label: string
  description: string
  page: string
  iconClass?: string
  onNavigate: (page: string) => void
}) {
  return (
    <button
      onClick={() => onNavigate(page)}
      className="group flex flex-col items-start gap-2.5 rounded-xl p-3.5 text-left border border-border bg-card hover:bg-muted/40 hover:border-border/80 active:scale-[0.97] transition-all duration-150"
    >
      <Icon className={`size-5 shrink-0 ${iconClass ?? "text-muted-foreground"}`} />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground tracking-tight leading-snug">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  )
}

function HomePage({ onNavigate }: { onNavigate: (page: string) => void }) {
  const [tableExpanded, setTableExpanded] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const todayIndex = (new Date().getDay() + 6) % 7

  const [pinnedRoutes, setPinnedRoutes] = useState<Array<{ id: string; name: string; code: string; shift: string }>>(() => {
    try { return JSON.parse(localStorage.getItem("fcalendar_pinned_routes") || "[]") } catch { return [] }
  })
  useEffect(() => {
    const sync = () => {
      try { setPinnedRoutes(JSON.parse(localStorage.getItem("fcalendar_pinned_routes") || "[]")) } catch {}
    }
    window.addEventListener("fcalendar_pins_changed", sync)
    window.addEventListener("focus", sync)
    return () => {
      window.removeEventListener("fcalendar_pins_changed", sync)
      window.removeEventListener("focus", sync)
    }
  }, [])

  return (
    <div
      className="flex flex-col gap-5 p-4 md:p-6 max-w-2xl mx-auto w-full"
      style={{ paddingBottom: "calc(2.5rem + env(safe-area-inset-bottom))" }}
    >
      {/* ── Pinned Routes ─────────────────────────────────────── */}
      {pinnedRoutes.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">
            Pinned Routes
          </p>
          <div className="rounded-2xl overflow-hidden border border-border/60 shadow-sm bg-card divide-y divide-border/40">
            {pinnedRoutes.map((r) => {
              const isKL  = (r.name + " " + r.code).toLowerCase().includes("kl")
              const isSel = (r.name + " " + r.code).toLowerCase().includes("sel")
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  {isKL
                    ? <img src="/kl-flag.png" className="shrink-0 object-cover rounded shadow-sm ring-1 ring-black/10 dark:ring-white/10" style={{ width: 32, height: 20 }} alt="KL" />
                    : isSel
                    ? <img src="/selangor-flag.png" className="shrink-0 object-cover rounded shadow-sm ring-1 ring-black/10 dark:ring-white/10" style={{ width: 32, height: 20 }} alt="Selangor" />
                    : <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
                        <Truck className="size-3.5 text-primary" />
                      </div>
                  }
                  <p className="flex-1 text-sm font-semibold text-foreground leading-tight line-clamp-1 min-w-0">{r.name}</p>
                  <span className="shrink-0 text-[10px] font-mono text-muted-foreground">{r.code}</span>
                  <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full text-white tracking-wide ${
                    r.shift === "AM" ? "bg-blue-500" : r.shift === "PM" ? "bg-orange-600" : "bg-muted text-muted-foreground"
                  }`}>{r.shift || "—"}</span>
                  <button
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    onClick={() => { sessionStorage.setItem("fcalendar_open_route", r.id); onNavigate("route-list") }}
                  >
                    <List className="size-3" />View
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">Quick Access</p>
        <div className="grid grid-cols-2 gap-3">
          <QuickActionCard icon={ClipboardList} label="Route List" description="Manage vending routes" page="route-list" iconClass="text-violet-500"  onNavigate={onNavigate} />
          <QuickActionCard icon={MapPin}        label="Location"   description="Delivery records"       page="deliveries" iconClass="text-emerald-500" onNavigate={onNavigate} />
          <QuickActionCard icon={Users}         label="Rooster"    description="Team schedule"          page="rooster"    iconClass="text-orange-500"  onNavigate={onNavigate} />
        </div>
      </div>

      {/* ── Color Guide Table ─────────────────────────────────── */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 px-0.5">Colour Guide</p>
        <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
          {/* Header */}
          <div className="grid grid-cols-4 items-end border-b border-border bg-card px-4 py-3 gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Day</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Stock In</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Move Front</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground text-center">Expired</span>
          </div>
          {/* Rows */}
          <div className="divide-y divide-border">
            {DAYS.map((day, i) => {
              const isToday = i === todayIndex
              if (!isToday && !tableExpanded) return null
              return (
                <div
                  key={day.en}
                  className="grid grid-cols-4 items-center px-4 py-3 gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {isToday && (
                      <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isToday ? "text-primary" : "text-foreground"}`}>{day.en}</p>
                    </div>
                  </div>
                  <div className="flex justify-center"><ColorPill color={STOCK_IN_COLORS[i]} size="sm" /></div>
                  <div className="flex justify-center"><ColorPill color={MOVE_FRONT_COLORS[i]} size="sm" /></div>
                  <div className="flex justify-center"><ColorPill color={EXPIRED_COLORS[i]} size="sm" /></div>
                </div>
              )
            })}
          </div>
          {/* Expand toggle */}
          <button
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted/70 transition-colors duration-200 ease-in-out border-t border-border"
            onClick={() => setTableExpanded(v => !v)}
          >
            <ChevronDown className={`size-3.5 transition-transform duration-200 ${tableExpanded ? "rotate-180" : ""}`} />
            {tableExpanded ? "Show less" : "Show all days"}
          </button>
        </div>
      </div>

      {/* ── Colour Legend ─────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-border bg-card shadow-sm">
        <button
          className="group w-full flex items-center gap-3 px-3.5 py-3.5 hover:bg-muted/40 active:scale-[0.99] transition-all duration-150 text-left"
          onClick={() => setLegendOpen(v => !v)}
        >
          <Layers className="size-5 text-violet-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground tracking-tight leading-snug">Colour Expired</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">Colour codes for stock activities</p>
          </div>
          <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform duration-200 ${legendOpen ? "rotate-180" : ""}`} />
        </button>
        {legendOpen && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-2 p-3 border-t border-border">
            {[
              { color: "#3B82F6", label: "Blue" },
              { color: "#F97316", label: "Orange" },
              { color: "#92400E", label: "Brown" },
              { color: "#22C55E", label: "Green" },
              { color: "#A855F7", label: "Purple" },
              { color: "#EC4899", label: "Pink" },
              { color: "#EAB308", label: "Yellow" },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2.5 rounded-lg border border-border bg-card p-2.5 hover:bg-muted/40 transition-colors">
                <ColorPill color={color} size="sm" />
                <span className="text-xs text-foreground font-medium leading-tight">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AppContent() {
  const [currentPage, setCurrentPage] = useState("home")
  const [isTransitioning, setIsTransitioning] = useState(false)
  const [roosterViewMode, setRoosterViewMode] = useState<"month" | "week">("month")
  const { open, openMobile, isMobile, toggleSidebar, setOpen, setOpenMobile } = useSidebar()

  const handlePageChange = (page: string) => {
    if (page === currentPage) return
    // Auto-close sidebar on navigation
    if (isMobile) setOpenMobile(false)
    else setOpen(false)
    setIsTransitioning(true)
    setTimeout(() => {
      setCurrentPage(page)
      setIsTransitioning(false)
    }, 200)
  }

  const renderContent = () => {
    switch (currentPage) {
      case "route-list":
        return <RouteList />
      case "deliveries":
        return (
          <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
            <div className="shrink-0">
              <div className="flex items-center gap-3 mb-1">
                <MapPin className="size-4 shrink-0 text-primary" />
                <h2 className="text-base font-semibold tracking-tight text-foreground">Location</h2>
              </div>
              <p className="ml-7 text-sm text-muted-foreground leading-relaxed">View and manage delivery records.</p>
              <Separator className="mt-4" />
            </div>
            <DeliveryTableDialog />
          </div>
        )
      case "rooster":
        return <Rooster viewMode={roosterViewMode} />
      case "settings":
      case "settings-profile":
        return <Settings section="profile" />
      case "settings-notifications":
        return <Settings section="notifications" />
      case "settings-appearance-font":
        return <Settings section="appearance-font" />
      case "settings-route-colors":
        return <Settings section="route-colors" />
      case "settings-security":
        return <Settings section="security" />
      case "plano-vm":
        return <PlanoVM />
      case "gallery-album":
        return <Album />
      case "home":
      default:
        return <HomePage onNavigate={handlePageChange} />
    }
  }

  const getPageBreadcrumbs = (): { parent?: { label: string; icon: React.ElementType }; current: string } => {
    switch (currentPage) {
      case "route-list":
        return { parent: { label: "Vending Machine", icon: Package }, current: "Route List" }
      case "deliveries":
        return { parent: { label: "Vending Machine", icon: Package }, current: "Location" }
      case "rooster":
        return { parent: { label: "Schedule", icon: Users }, current: "Rooster" }
      case "settings":
      case "settings-profile":
        return { parent: { label: "Settings", icon: Settings2 }, current: "Profile" }
      case "settings-notifications":
        return { parent: { label: "Settings", icon: Settings2 }, current: "Notifications" }
      case "settings-appearance-font":
        return { parent: { label: "Settings", icon: Settings2 }, current: "Font" }
      case "settings-route-colors":
        return { parent: { label: "Settings", icon: Settings2 }, current: "Route Colours" }
      case "settings-security":
        return { parent: { label: "Settings", icon: Settings2 }, current: "Security" }
      case "plano-vm":
        return { parent: { label: "Gallery", icon: Images }, current: "Plano VM" }
      case "gallery-album":
        return { parent: { label: "Gallery", icon: Images }, current: "Album" }
      case "home":
      default:
        return { current: "Home" }
    }
  }

  return (
    <>
      <AppSidebar onNavigate={handlePageChange} currentPage={currentPage} />
      
      {/* Backdrop for desktop sidebar */}
      {!isMobile && open && (
        <div 
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300"
          onClick={toggleSidebar}
        />
      )}
      
      <main className={`relative flex w-full flex-1 flex-col min-h-0 overflow-hidden bg-background transition-all duration-500 ease-in-out ${(isMobile && openMobile) || (!isMobile && open) ? 'scale-95 opacity-90' : 'scale-100 opacity-100'}`} style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <header className="glass-header sticky top-0 z-30 flex shrink-0 items-center gap-2 px-3 md:px-5 transition-colors duration-300" style={{ paddingTop: 'max(env(safe-area-inset-top), 10px)', paddingBottom: '0.5rem', minHeight: 'calc(3.25rem + max(env(safe-area-inset-top), 10px))' }}>
          <SidebarTrigger className="-ml-1 shrink-0" />
          <Separator orientation="vertical" className="mr-1 md:mr-2 h-4 shrink-0" />
          <Breadcrumb className="min-w-0 flex-1">
            <BreadcrumbList>
              <BreadcrumbItem className="shrink-0">
                <BreadcrumbLink
                  href="#"
                  onClick={() => handlePageChange("home")}
                  className="flex items-center gap-1.5 font-semibold text-foreground hover:text-foreground/80 transition-colors"
                >
                  <Home className="size-4 shrink-0" />
                </BreadcrumbLink>
              </BreadcrumbItem>
              {(() => {
                const { parent, current } = getPageBreadcrumbs()
                return (
                  <>
                    {parent && (
                      <>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem
                          key={`parent-${currentPage}`}
                          className="hidden md:flex items-center gap-1 text-muted-foreground animate-in fade-in slide-in-from-left-2 duration-200"
                        >
                          <parent.icon className="size-3.5 shrink-0" />
                          <span>{parent.label}</span>
                        </BreadcrumbItem>
                      </>
                    )}
                    <BreadcrumbSeparator className={parent ? undefined : "hidden md:block"} />
                    <BreadcrumbItem
                      key={`current-${currentPage}`}
                      className="min-w-0 animate-in fade-in slide-in-from-left-2 duration-300"
                    >
                      <BreadcrumbPage className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-none font-medium">
                        {current}
                      </BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                )
              })()}
            </BreadcrumbList>
          </Breadcrumb>

          {/* Rooster view toggle — cycles Month ↔ Week */}
          {currentPage === "rooster" && (
            <button
              onClick={() => setRoosterViewMode(v => v === "month" ? "week" : "month")}
              className="h-7 px-3 text-xs font-semibold rounded-lg border border-border bg-card hover:bg-muted transition-colors shrink-0"
            >
              {roosterViewMode === "month" ? "Month" : "Week"}
            </button>
          )}

        </header>
        <Suspense fallback={null}>
          <div className={`flex flex-col flex-1 min-h-0 overflow-y-auto ${isTransitioning ? "page-fade-out" : "page-fade-in"}`}>
            {renderContent()}
          </div>
        </Suspense>
      </main>

      {/* Edit Mode controls moved to Settings page */}
    </>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App error:', error, info)
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="text-xl font-semibold">Ralat berlaku</h1>
          <pre className="max-w-xl rounded bg-muted p-4 text-left text-xs text-destructive overflow-auto">
            {this.state.error.message}
          </pre>
          <button
            className="rounded bg-primary px-4 py-2 text-sm text-primary-foreground"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  return (
    <DeviceProvider>
      <ErrorBoundary>
        <SidebarProvider defaultOpen={false}>
          <EditModeProvider>
            <AppContent />
          </EditModeProvider>
        </SidebarProvider>
        <PWAInstallPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            classNames: {
              toast:
                "!border !border-border !bg-background !text-foreground !shadow-xl !rounded-xl",
              title: "!text-foreground !font-semibold !text-sm",
              description: "!text-muted-foreground !text-xs",
              success:
                "!border-green-500/50 [&_[data-icon]]:!text-green-500 [&_[data-icon]_svg]:!stroke-green-500 [&_[data-icon]_svg]:!text-green-500",
              error:
                "!border-red-500/50 [&_[data-icon]]:!text-red-500 [&_[data-icon]_svg]:!stroke-red-500 [&_[data-icon]_svg]:!text-red-500",
              warning:
                "!border-amber-400/50 [&_[data-icon]]:!text-amber-500 [&_[data-icon]_svg]:!stroke-amber-500 [&_[data-icon]_svg]:!text-amber-500",
              info:
                "!border-sky-400/50 [&_[data-icon]]:!text-sky-500 [&_[data-icon]_svg]:!stroke-sky-500 [&_[data-icon]_svg]:!text-sky-500",
              loader:
                "!border-primary/40 [&_[data-icon]]:!text-primary",
            },
          }}
        />
      </ErrorBoundary>
    </DeviceProvider>
  )
}

export default App
