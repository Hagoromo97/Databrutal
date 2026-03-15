import { useEffect, useState } from "react"

export type ColorMode = "light" | "dark"

/** meta theme-color backgrounds */
const META_BG: Record<ColorMode, string> = {
  light: "#f4f6fb",
  dark:  "#090e1a",
}

export type AppFont =
  | "system"
  | "inter"
  | "poppins"
  | "roboto"
  | "nunito"
  | "plus-jakarta-sans"
  | "quicksand"
  | "figtree"
  | "barlow"

export const FONT_OPTIONS: { id: AppFont; label: string; family: string; googleId?: string }[] = [
  { id: "system",            label: "System Default",    family: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  { id: "inter",             label: "Inter",             family: "'Inter', sans-serif",             googleId: "Inter:wght@300;400;500;600;700" },
  { id: "poppins",           label: "Poppins",           family: "'Poppins', sans-serif",           googleId: "Poppins:wght@300;400;500;600;700" },
  { id: "roboto",            label: "Roboto",            family: "'Roboto', sans-serif",            googleId: "Roboto:wght@300;400;500;700" },
  { id: "nunito",            label: "Nunito",            family: "'Nunito', sans-serif",            googleId: "Nunito:wght@300;400;500;600;700" },
  { id: "plus-jakarta-sans", label: "Plus Jakarta Sans", family: "'Plus Jakarta Sans', sans-serif", googleId: "Plus+Jakarta+Sans:wght@300;400;500;600;700" },
  { id: "quicksand",         label: "Quicksand",         family: "'Quicksand', sans-serif",         googleId: "Quicksand:wght@300;400;500;600;700" },
  { id: "figtree",           label: "Figtree",           family: "'Figtree', sans-serif",           googleId: "Figtree:wght@300;400;500;600;700" },
  { id: "barlow",            label: "Barlow",            family: "'Barlow', sans-serif",            googleId: "Barlow:wght@300;400;500;600;700" },
]

export type AppZoom = "80" | "85" | "90" | "95" | "100" | "105" | "110" | "115" | "120"
export type TextSize = "13" | "14" | "15" | "16" | "17" | "18" | "20"

/** Inject a Google Fonts <link> once per googleId */
const loadedFonts = new Set<string>()
function loadGoogleFont(googleId: string) {
  if (loadedFonts.has(googleId)) return
  loadedFonts.add(googleId)
  const link = document.createElement("link")
  link.rel  = "stylesheet"
  link.href = `https://fonts.googleapis.com/css2?family=${googleId}&display=swap`
  document.head.appendChild(link)
}

export function useTheme() {
  const [mode, setMode] = useState<ColorMode>(() =>
    (localStorage.getItem("colorMode") as ColorMode) ?? "light"
  )
  const [appFont, setAppFont] = useState<AppFont>(() =>
    (localStorage.getItem("app-font") as AppFont) ?? "inter"
  )
  const [appZoom, setAppZoom] = useState<AppZoom>(() =>
    (localStorage.getItem("app-zoom") as AppZoom) ?? "120"
  )
  const [textSize, setTextSize] = useState<TextSize>(() =>
    (localStorage.getItem("text-size") as TextSize) ?? "16"
  )

  // Apply color mode
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle("dark", mode === "dark")
    // Remove legacy data-theme attribute
    root.removeAttribute("data-theme")
    localStorage.setItem("colorMode", mode)
    // Update PWA meta theme-color
    const metaColor = META_BG[mode]
    const allMetas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    if (allMetas.length === 0) {
      const meta = document.createElement("meta")
      meta.name = "theme-color"
      meta.setAttribute("content", metaColor)
      document.head.appendChild(meta)
    } else {
      allMetas.forEach(meta => meta.setAttribute("content", metaColor))
    }
  }, [mode])

  // Apply font
  useEffect(() => {
    const opt = FONT_OPTIONS.find(f => f.id === appFont)
    if (!opt) return
    if (opt.googleId) loadGoogleFont(opt.googleId)
    document.documentElement.style.setProperty("--app-font", opt.family)
    document.body.style.fontFamily = opt.family
    localStorage.setItem("app-font", appFont)
  }, [appFont])

  // Apply zoom (applied to body to avoid viewport distortion)
  useEffect(() => {
    document.body.style.zoom = `${appZoom}%`
    localStorage.setItem("app-zoom", appZoom)
  }, [appZoom])

  // Apply text size — stored in CSS custom property so DeviceProvider can scale it
  useEffect(() => {
    document.documentElement.style.setProperty("--text-size-base", `${textSize}px`)
    localStorage.setItem("text-size", textSize)
  }, [textSize])

  const toggleMode = () => setMode(prev => prev === "light" ? "dark" : "light")

  // Backward-compat aliases
  const theme = mode
  const setTheme = setMode
  const toggleTheme = toggleMode

  return {
    mode, setMode, toggleMode,
    theme, setTheme, toggleTheme,
    appFont, setAppFont,
    appZoom, setAppZoom,
    textSize, setTextSize,
  }
}
