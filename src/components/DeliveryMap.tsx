import { useMemo, useState, useEffect, useRef } from "react"
import { GoogleMap, useLoadScript, InfoWindow } from "@react-google-maps/api"

const GMAP_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ""
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LIBRARIES = ["marker"] as any

const DELIVERY_COLORS: Record<string, string> = {
  Daily:   "#22c55e",
  Weekday: "#3b82f6",
  "Alt 1": "#f59e0b",
  "Alt 2": "#a855f7",
}

interface DeliveryPoint {
  code: string
  name: string
  delivery: string
  latitude: number
  longitude: number
  descriptions: { key: string; value: string }[]
}

interface DeliveryMapProps {
  deliveryPoints: DeliveryPoint[]
  scrollZoom?: boolean
}

const MAP_OPTIONS: google.maps.MapOptions = {
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: false,
  clickableIcons: false,
  mapId: "DEMO_MAP_ID",
}

/**
 * Standard teardrop marker using a pure SVG inside an HTMLElement.
 * No dependency on PinElement — works on all platforms.
 */
function createMarkerEl(color: string): HTMLElement {
  const wrapper = document.createElement("div")
  wrapper.style.cssText = [
    "display:inline-flex",
    "flex-direction:column",
    "align-items:center",
    "cursor:pointer",
    "transform-origin:bottom center",
    "transition:transform 0.2s cubic-bezier(0.34,1.56,0.64,1),filter 0.2s ease",
    "will-change:transform",
  ].join(";")

  // Standard map-pin SVG (like Google Maps default)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg")
  svg.setAttribute("width", "28")
  svg.setAttribute("height", "36")
  svg.setAttribute("viewBox", "0 0 28 36")

  const pinPath = document.createElementNS("http://www.w3.org/2000/svg", "path")
  // Teardrop: circle top + pointed tip at bottom
  pinPath.setAttribute("d", "M14 0C6.268 0 0 6.268 0 14c0 9.625 14 22 14 22S28 23.625 28 14C28 6.268 21.732 0 14 0z")
  pinPath.setAttribute("fill", color)
  svg.appendChild(pinPath)

  // White inner circle
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle")
  circle.setAttribute("cx", "14")
  circle.setAttribute("cy", "13")
  circle.setAttribute("r", "5.5")
  circle.setAttribute("fill", "white")
  circle.setAttribute("opacity", "0.92")
  svg.appendChild(circle)

  wrapper.appendChild(svg)
  return wrapper
}

export function DeliveryMap({ deliveryPoints, scrollZoom = false }: DeliveryMapProps) {
  const { isLoaded } = useLoadScript({ googleMapsApiKey: GMAP_KEY, libraries: LIBRARIES })
  const [activeCode,  setActiveCode]  = useState<string | null>(null)
  const [mapInstance, setMapInstance] = useState<google.maps.Map | null>(null)

  const markersRef = useRef<Array<{
    marker: google.maps.marker.AdvancedMarkerElement
    el: HTMLElement
    code: string
    color: string
    index: number
  }>>([])

  const validPoints = useMemo(
    () => deliveryPoints.filter((p) => p.latitude !== 0 && p.longitude !== 0),
    [deliveryPoints]
  )

  const activePoint = useMemo(
    () => validPoints.find(p => p.code === activeCode) ?? null,
    [validPoints, activeCode]
  )

  const center = useMemo(() => {
    if (validPoints.length === 0) return { lat: 3.15, lng: 101.65 }
    return {
      lat: validPoints.reduce((s, p) => s + p.latitude, 0) / validPoints.length,
      lng: validPoints.reduce((s, p) => s + p.longitude, 0) / validPoints.length,
    }
  }, [validPoints])

  // Create markers
  useEffect(() => {
    if (!mapInstance) return
    markersRef.current.forEach(({ marker }) => { marker.map = null })
    markersRef.current = []

    validPoints.forEach((point, index) => {
      const color = DELIVERY_COLORS[point.delivery] ?? "#6b7280"
      const el = createMarkerEl(color)

      const marker = new google.maps.marker.AdvancedMarkerElement({
        map:      mapInstance,
        position: { lat: point.latitude, lng: point.longitude },
        content:  el,
        title:    point.name,
        zIndex:   index,
      })

      marker.addListener("click", () =>
        setActiveCode(prev => prev === point.code ? null : point.code)
      )

      markersRef.current.push({ marker, el, code: point.code, color, index })
    })

    return () => {
      markersRef.current.forEach(({ marker }) => { marker.map = null })
      markersRef.current = []
    }
  }, [mapInstance, validPoints])

  // Active state styling
  useEffect(() => {
    markersRef.current.forEach(({ el, code, color, index }) => {
      const isActive = code === activeCode
      el.style.transform = isActive ? "scale(1.3)" : "scale(1)"
      el.style.filter    = isActive
        ? `drop-shadow(0 4px 12px ${color}88)`
        : ""
      markersRef.current.find(m => m.code === code)!.marker.zIndex = isActive ? 999 : index
    })
  }, [activeCode])

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-muted/20">
        <div className="size-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <GoogleMap
      mapContainerStyle={{ width: "100%", height: "100%" }}
      center={center}
      zoom={13}
      options={{
        ...MAP_OPTIONS,
        scrollwheel: scrollZoom,
        gestureHandling: scrollZoom ? "greedy" : "cooperative",
      }}
      onLoad={(map) => {
        setMapInstance(map)
        if (validPoints.length > 1) {
          const bounds = new google.maps.LatLngBounds()
          validPoints.forEach(p => bounds.extend({ lat: p.latitude, lng: p.longitude }))
          map.fitBounds(bounds, 40)
        } else if (validPoints.length === 1) {
          map.setCenter({ lat: validPoints[0].latitude, lng: validPoints[0].longitude })
          map.setZoom(14)
        }
      }}
      onClick={() => setActiveCode(null)}
    >
      {activePoint && (
        <InfoWindow
          position={{ lat: activePoint.latitude, lng: activePoint.longitude }}
          onCloseClick={() => setActiveCode(null)}
          options={{ pixelOffset: new google.maps.Size(0, -46) }}
        >
          <div style={{ fontFamily: "system-ui, sans-serif", minWidth: 148, padding: "2px 0" }}>
            <p style={{ fontWeight: 700, fontSize: 13, marginBottom: 5, color: "#111", lineHeight: 1.3 }}>{activePoint.name}</p>
            <div style={{ fontSize: 11, color: "#666", lineHeight: 1.7 }}>
              <div>Code: <span style={{ fontWeight: 600, color: "#333", fontFamily: "monospace" }}>{activePoint.code}</span></div>
              <div>Delivery: <span style={{ fontWeight: 700, color: DELIVERY_COLORS[activePoint.delivery] ?? "#666" }}>{activePoint.delivery}</span></div>
            </div>
          </div>
        </InfoWindow>
      )}
    </GoogleMap>
  )
}
