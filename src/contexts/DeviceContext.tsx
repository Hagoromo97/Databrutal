import * as React from "react"
import { useDeviceType, type DeviceType } from "@/hooks/use-mobile"

interface DeviceContextValue {
  device: DeviceType
  isMobile: boolean
  isTablet: boolean
  isDesktop: boolean
  isTouch: boolean
  /** CSS-friendly font scale factor — 0.875 on mobile, 0.9375 on tablet, 1 on desktop */
  fontScale: number
}

const DeviceContext = React.createContext<DeviceContextValue>({
  device: "desktop",
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouch: false,
  fontScale: 1,
})

/**
 * DeviceProvider
 * – Detects device type (mobile / tablet / desktop) via window resize listener.
 * – Writes `data-device` and `data-touch` to the root <html> element so CSS
 *   can target each breakpoint with plain attribute selectors.
 * – Adjusts `--app-font-scale` CSS custom property so every rem-based value
 *   scales uniformly without touching individual component classes.
 */
export function DeviceProvider({ children }: { children: React.ReactNode }) {
  const device = useDeviceType()

  const isMobile  = device === "mobile"
  const isTablet  = device === "tablet"
  const isDesktop = device === "desktop"
  const isTouch   = React.useMemo(
    () => typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0),
    []
  )
  const fontScale = isMobile ? 0.875 : isTablet ? 0.9375 : 1

  // Sync HTML data-attributes whenever device changes
  React.useEffect(() => {
    const html = document.documentElement
    html.setAttribute("data-device", device)
    html.setAttribute("data-touch", isTouch ? "true" : "false")
    // Fluid font scale via CSS custom property
    html.style.setProperty("--app-font-scale", String(fontScale))
  }, [device, isTouch, fontScale])

  const value = React.useMemo<DeviceContextValue>(
    () => ({ device, isMobile, isTablet, isDesktop, isTouch, fontScale }),
    [device, isMobile, isTablet, isDesktop, isTouch, fontScale]
  )

  return (
    <DeviceContext.Provider value={value}>
      {children}
    </DeviceContext.Provider>
  )
}

export function useDevice() {
  return React.useContext(DeviceContext)
}
