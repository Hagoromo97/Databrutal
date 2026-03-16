import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { registerServiceWorker } from "./lib/pwa"
import { FONT_OPTIONS } from "./hooks/use-theme"

// ── Apply persisted display settings before first paint ──────────────────────
;(function applyStoredDisplaySettings() {
  try {
    // App zoom
    const zoom = localStorage.getItem("app-zoom") ?? "120"
    document.body.style.zoom = `${zoom}%`

    // Text size (rem base)
    const textSize = localStorage.getItem("text-size")
    if (textSize) document.documentElement.style.fontSize = `${textSize}px`

    // Font family
    const fontId = localStorage.getItem("app-font") ?? "inter"
    const fontOpt = FONT_OPTIONS.find(f => f.id === fontId)
    if (fontOpt) {
      // Inject Google Fonts link if needed
      if (fontOpt.googleId) {
        const link = document.createElement("link")
        link.rel  = "stylesheet"
        link.href = `https://fonts.googleapis.com/css2?family=${fontOpt.googleId}&display=swap`
        document.head.appendChild(link)
      }
      document.documentElement.style.setProperty("--app-font", fontOpt.family)
      document.body.style.fontFamily = fontOpt.family
    }
  } catch { /* localStorage may be unavailable */ }
})()

createRoot(document.getElementById("root")!).render(
  <StrictMode>
      <App />
  </StrictMode>
)

// Fade out splash screen after React mounts
requestAnimationFrame(() => {
  const splash = document.getElementById("splash")
  if (splash) {
    splash.classList.add("fade-out")
    splash.addEventListener("transitionend", () => splash.remove(), { once: true })
  }
})

// Register service worker for PWA functionality
registerServiceWorker()
