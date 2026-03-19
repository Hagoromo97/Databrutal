"use client"

import * as React from "react"
import {
  Moon,
  Package,
  Pencil,
  Search,
  Sun,
  X,
  Images,
  Layers,
  Users,
} from "lucide-react"
import { useEditMode } from "@/contexts/EditModeContext"
import { useTheme } from "@/hooks/use-theme"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const data = {
  user: {
    name: "User",
    email: "user@example.com",
    avatar: "/avatars/user.jpg",
  },
  navMain: [
    {
      title: "Schedule",
      url: "#",
      icon: Users,
      color: "#3B82F6",
      isActive: false,
      items: [
        {
          title: "Rooster",
          url: "#",
          page: "rooster",
        },
      ],
    },
    {
      title: "Vending Machine",
      url: "#",
      icon: Package,
      color: "#10B981",
      isActive: false,
      items: [
        {
          title: "Route List",
          url: "#",
          page: "route-list",
        },
        {
          title: "Location",
          url: "#",
          page: "deliveries",
        },
      ],
    },
    {
      title: "Gallery",
      url: "#",
      icon: Images,
      color: "#A855F7",
      isActive: false,
      items: [
        {
          title: "Plano VM",
          url: "#",
          page: "plano-vm",
        },
        {
          title: "Album",
          url: "#",
          page: "gallery-album",
        },
      ],
    },
  ],
  settingsItems: [
    { title: "Profile",     page: "settings-profile" },
    { title: "Font",        page: "settings-appearance-font" },
    { title: "Route Colours", page: "settings-route-colors" },
    { title: "Security",    page: "settings-security" },
  ],
}

const SETTINGS_PAGES = new Set([
  "settings-profile",
  "settings-appearance-font","settings-route-colors","settings-security",
])


export function AppSidebar({ 
  onNavigate,
  currentPage,
  ...props 
}: React.ComponentProps<typeof Sidebar> & { 
  onNavigate?: (page: string) => void
  currentPage?: string
}) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [settingsOpen, setSettingsOpen] = React.useState(() => SETTINGS_PAGES.has(currentPage ?? ""))
  const [openNavItem, setOpenNavItem] = React.useState<string | null>(null)
  const [unsavedDialogOpen, setUnsavedDialogOpen] = React.useState(false)
  const { isEditMode, setIsEditMode, hasUnsavedChanges, saveChanges, isSaving, discardChanges } = useEditMode()
  const { mode, toggleMode } = useTheme()

  // Mutually exclusive: opening a Platform submenu closes Settings, and vice versa
  const handleNavItemChange = (item: string | null) => {
    setOpenNavItem(item)
    if (item !== null) setSettingsOpen(false)
  }

  const handleSettingsOpenChange = (open: boolean) => {
    setSettingsOpen(open)
    if (open) setOpenNavItem(null)
  }

  const handleEditModeToggle = () => {
    if (isEditMode && hasUnsavedChanges) {
      setUnsavedDialogOpen(true)
    } else {
      setIsEditMode(!isEditMode)
    }
  }

  const filteredNavMain = React.useMemo(() => {
    if (!searchQuery.trim()) return data.navMain
    const q = searchQuery.toLowerCase()
    return data.navMain
      .map(item => {
        const titleMatch = item.title.toLowerCase().includes(q)
        const filteredSubs = item.items?.filter(sub => sub.title.toLowerCase().includes(q)) ?? []
        if (titleMatch) return item
        if (filteredSubs.length > 0) return { ...item, items: filteredSubs }
        return null
      })
      .filter(Boolean) as typeof data.navMain
  }, [searchQuery])

  const settingsHasMatch = React.useMemo(() => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      "settings".includes(q) ||
      data.settingsItems.some(i => i.title.toLowerCase().includes(q)) ||
      "dark mode".includes(q) || "light mode".includes(q) || "appearance".includes(q) ||
      "edit mode".includes(q) || "edit".includes(q)
    )
  }, [searchQuery])

  const noResults = searchQuery.trim().length > 0 && filteredNavMain.length === 0 && !settingsHasMatch

  const handleNavClick = (_itemTitle: string) => {
    // top-level items with children just expand/collapse — no navigation
  }

  const handleSubItemClick = (page: string) => {
    onNavigate?.(page)
  }

  return (
    <>
    <Sidebar {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              size="lg" 
              asChild
              onClick={() => onNavigate?.("home")}
            >
              <a href="#">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Layers className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Data Brutal</span>
                  <span className="truncate text-xs">Info for driver bejad</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {/* Search field */}
        <div className="relative mt-1 sidebar-search-wrapper">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none transition-colors" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="sidebar-search h-8 w-full rounded-md border border-input bg-background pl-8 pr-7 text-[11px] md:text-[11px] shadow-none outline-none ring-0 transition-all duration-200 placeholder:text-muted-foreground/60 focus:ring-1 focus:ring-ring"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <NavMain
          items={filteredNavMain}
          onItemClick={handleNavClick}
          onSubItemClick={handleSubItemClick}
          searchQuery={searchQuery}
          currentPage={currentPage}
          openItem={openNavItem}
          onOpenItemChange={handleNavItemChange}
        />
        <NavProjects
          settingsItems={data.settingsItems}
          settingsOpen={settingsOpen}
          onSettingsOpenChange={handleSettingsOpenChange}
          currentPage={currentPage}
          onNavigate={onNavigate}
          searchQuery={searchQuery}
        />
        {noResults && (
          <div className="flex flex-col items-center gap-1.5 py-6 px-3 text-center animate-in fade-in duration-200">
            <span className="text-xl">🔍</span>
            <p className="text-xs font-medium text-muted-foreground">No results found</p>
            <p className="text-[11px] text-muted-foreground/60">Try a different keyword</p>
          </div>
        )}
      </SidebarContent>
      <SidebarFooter>
        {/* Theme toggle */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors cursor-pointer mx-1"
          onClick={toggleMode}
        >
          {mode === "dark"
            ? <Moon className="size-4 shrink-0" style={{ color: "#EAB308" }} />
            : <Sun  className="size-4 shrink-0" style={{ color: "#F97316" }} />}
          <span className="flex-1 text-sm font-medium text-sidebar-foreground/90">
            {mode === "dark" ? "Dark Mode" : "Light Mode"}
          </span>
          <span onClick={e => e.stopPropagation()}>
            <Switch size="sm" checked={mode === "dark"} onCheckedChange={toggleMode} />
          </span>
        </div>
        {/* Edit Mode toggle */}
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors cursor-pointer mx-1 ${
            isEditMode ? "text-primary hover:bg-primary/10" : "hover:bg-sidebar-accent/50"
          }`}
          onClick={handleEditModeToggle}
        >
          <Pencil className={`size-4 shrink-0 ${isEditMode ? "text-primary" : ""}`} style={!isEditMode ? { color: "#6366F1" } : undefined} />
          <span className={`flex-1 text-sm font-medium ${isEditMode ? "text-primary" : "text-sidebar-foreground/90"}`}>Edit Mode</span>
          <span onClick={e => e.stopPropagation()}>
            <Switch size="sm" checked={isEditMode} onCheckedChange={handleEditModeToggle} />
          </span>
        </div>
        <Separator className="mx-1" />
        <NavUser user={data.user} onNavigate={onNavigate} />
      </SidebarFooter>
    </Sidebar>

      {/* Unsaved Changes Dialog */}
      <Dialog open={unsavedDialogOpen} onOpenChange={setUnsavedDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved Changes</DialogTitle>
            <DialogDescription>
              You have unsaved changes. What would you like to do before turning off Edit Mode?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                discardChanges()
                setUnsavedDialogOpen(false)
                setIsEditMode(false)
              }}
            >
              Discard Changes
            </Button>
            <Button
              onClick={async () => {
                await saveChanges()
                setUnsavedDialogOpen(false)
                setIsEditMode(false)
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save & Turn Off'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
