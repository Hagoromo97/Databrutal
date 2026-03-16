import { useMemo, useRef, useState, type ChangeEvent } from "react"
import { Camera, FileImage, FileText, Link2, Share2, ThermometerSun, Upload, User, MapPinHouse, Building2, Clock3, AlertTriangle } from "lucide-react"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ShareFormat = "pdf" | "image" | "link"

interface TemperatureReportData {
  name: string
  location: string
  flatNumber: string
  compartmentATemp: string
  compartmentBTemp: string
  compartmentAPhoto: string
  compartmentBPhoto: string
  createdAt: number
}

interface SharedLinkPayload {
  exp: number
  data: Omit<TemperatureReportData, "compartmentAPhoto" | "compartmentBPhoto">
}

interface TemperatureReportProps {
  sharedToken?: string | null
  onExitSharedView?: () => void
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function encodeBase64Url(value: string) {
  return btoa(unescape(encodeURIComponent(value)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
  return decodeURIComponent(escape(atob(padded)))
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ""))
    reader.onerror = () => reject(new Error("Failed to read image"))
    reader.readAsDataURL(file)
  })
}

function dataUrlToFile(dataUrl: string, filename: string) {
  const [meta, base64] = dataUrl.split(",")
  const mime = meta.match(/data:(.*?);base64/)?.[1] ?? "image/png"
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

function formatDateTime(ts: number) {
  return new Date(ts).toLocaleString()
}

export function TemperatureReport({ sharedToken, onExitSharedView }: TemperatureReportProps) {
  const [report, setReport] = useState<TemperatureReportData>({
    name: "",
    location: "",
    flatNumber: "",
    compartmentATemp: "",
    compartmentBTemp: "",
    compartmentAPhoto: "",
    compartmentBPhoto: "",
    createdAt: Date.now(),
  })
  const [shareFormat, setShareFormat] = useState<ShareFormat>("pdf")
  const [isSharing, setIsSharing] = useState(false)
  const reportCardRef = useRef<HTMLDivElement>(null)

  const sharedView = useMemo(() => {
    if (!sharedToken) return null
    try {
      const parsed = JSON.parse(decodeBase64Url(sharedToken)) as SharedLinkPayload
      const expired = Date.now() > parsed.exp
      return { parsed, expired }
    } catch {
      return { parsed: null, expired: true }
    }
  }, [sharedToken])

  const isFormValid =
    report.name.trim() &&
    report.location.trim() &&
    report.flatNumber.trim() &&
    report.compartmentATemp.trim() &&
    report.compartmentBTemp.trim() &&
    report.compartmentAPhoto &&
    report.compartmentBPhoto

  const openWhatsAppWithText = (text: string) => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, "_blank", "noopener,noreferrer")
  }

  const updatePhoto = async (key: "compartmentAPhoto" | "compartmentBPhoto", e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    setReport(prev => ({ ...prev, [key]: dataUrl }))
    e.target.value = ""
  }

  const buildShareLink = () => {
    const payload: SharedLinkPayload = {
      exp: Date.now() + ONE_DAY_MS,
      data: {
        name: report.name.trim(),
        location: report.location.trim(),
        flatNumber: report.flatNumber.trim(),
        compartmentATemp: report.compartmentATemp.trim(),
        compartmentBTemp: report.compartmentBTemp.trim(),
        createdAt: Date.now(),
      },
    }
    const token = encodeBase64Url(JSON.stringify(payload))
    const url = new URL(window.location.href)
    url.searchParams.set("tempReport", token)
    return url.toString()
  }

  const captureReportImage = async () => {
    if (!reportCardRef.current) throw new Error("Report card not ready")
    const canvas = await html2canvas(reportCardRef.current, {
      backgroundColor: "#ffffff",
      scale: 2,
      useCORS: true,
    })
    return canvas
  }

  const downloadFile = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const shareFile = async (file: File, caption: string) => {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "Temperature Report",
        text: caption,
      })
      return
    }
    downloadFile(file, file.name)
    openWhatsAppWithText("Temperature report exported. Please attach the downloaded file to this chat.")
  }

  const handleShare = async () => {
    if (!isFormValid) {
      toast.error("Please complete all required fields")
      return
    }

    setIsSharing(true)
    try {
      const createdAt = Date.now()
      const title = `Temperature Report - ${report.location}`
      const caption = `Temperature report for ${report.location} (Flat ${report.flatNumber})`

      if (shareFormat === "link") {
        const link = buildShareLink()
        try {
          await navigator.clipboard.writeText(link)
          toast.success("Link copied", { description: "Share link is valid for 24 hours." })
        } catch {
          toast.success("Link generated", { description: "Copy and share this 24-hour link manually." })
        }
        openWhatsAppWithText(`${caption}\n\n24-hour link:\n${link}`)
        return
      }

      const canvas = await captureReportImage()

      if (shareFormat === "image") {
        const pngDataUrl = canvas.toDataURL("image/png")
        const file = dataUrlToFile(pngDataUrl, `temperature-report-${createdAt}.png`)
        await shareFile(file, caption)
        return
      }

      const imgData = canvas.toDataURL("image/png")
      const pdf = new jsPDF("p", "mm", "a4")
      const pageW = pdf.internal.pageSize.getWidth()
      const pageH = pdf.internal.pageSize.getHeight()
      const margin = 10
      const imgW = pageW - margin * 2
      const imgH = (canvas.height * imgW) / canvas.width
      const finalH = Math.min(imgH, pageH - margin * 2)

      pdf.setFontSize(12)
      pdf.text(title, margin, margin)
      pdf.addImage(imgData, "PNG", margin, margin + 5, imgW, finalH - 5)
      const pdfBlob = pdf.output("blob")
      const pdfFile = new File([pdfBlob], `temperature-report-${createdAt}.pdf`, { type: "application/pdf" })
      await shareFile(pdfFile, caption)
    } catch (error) {
      console.error(error)
      toast.error("Share failed", { description: "Please try again." })
    } finally {
      setIsSharing(false)
    }
  }

  if (sharedToken) {
    if (!sharedView?.parsed || sharedView.expired) {
      return (
        <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6 max-w-2xl mx-auto w-full">
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="size-4" />
              <h2 className="text-sm font-semibold">Shared Report Unavailable</h2>
            </div>
            <p className="text-sm text-muted-foreground">This share link is invalid or already expired (valid for 24 hours only).</p>
            <Button onClick={onExitSharedView}>Open Temperature Report Form</Button>
          </div>
        </div>
      )
    }

    const { data } = sharedView.parsed
    return (
      <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6 max-w-2xl mx-auto w-full">
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ThermometerSun className="size-4 text-primary" />
            <h2 className="text-base font-semibold">Temperature Report</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{data.name}</span></div>
            <div><span className="text-muted-foreground">Location:</span> <span className="font-medium">{data.location}</span></div>
            <div><span className="text-muted-foreground">Flat Number:</span> <span className="font-medium">{data.flatNumber}</span></div>
            <div><span className="text-muted-foreground">Created:</span> <span className="font-medium">{formatDateTime(data.createdAt)}</span></div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Compartment A</p>
              <p className="text-lg font-semibold">{data.compartmentATemp}°C</p>
            </div>
            <div className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Compartment B</p>
              <p className="text-lg font-semibold">{data.compartmentBTemp}°C</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Photo attachments are not included in 24-hour link sharing.</p>
          <Button onClick={onExitSharedView}>Create New Report</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6 max-w-2xl mx-auto w-full" style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}>
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <ThermometerSun className="size-4 text-primary" />
          <h2 className="text-base font-semibold tracking-tight text-foreground">Temperature Report</h2>
        </div>
        <p className="text-sm text-muted-foreground">Fill in details, capture compartment photos, then share to WhatsApp.</p>
      </div>

      <div ref={reportCardRef} className="rounded-2xl border border-border bg-card p-4 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
            <div className="relative">
              <User className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input value={report.name} onChange={e => setReport(prev => ({ ...prev, name: e.target.value }))} placeholder="Enter name" className="pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
            <div className="relative">
              <MapPinHouse className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
              <Input value={report.location} onChange={e => setReport(prev => ({ ...prev, location: e.target.value }))} placeholder="Enter location" className="pl-8" />
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Flat Number</label>
          <div className="relative">
            <Building2 className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
            <Input value={report.flatNumber} onChange={e => setReport(prev => ({ ...prev, flatNumber: e.target.value }))} placeholder="Enter flat number" className="pl-8" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {[{ id: "A", tempKey: "compartmentATemp", photoKey: "compartmentAPhoto" }, { id: "B", tempKey: "compartmentBTemp", photoKey: "compartmentBPhoto" }].map((c, idx) => {
              const tempKey = c.tempKey as "compartmentATemp" | "compartmentBTemp";
              const photoKey = c.photoKey as "compartmentAPhoto" | "compartmentBPhoto";
              return (
                <div key={c.id} className={`space-y-2.5 ${idx > 0 ? "border-t border-border pt-3" : ""}`}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compartment {c.id}</p>
                <div className="relative">
                  <ThermometerSun className="size-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <Input
                    value={report[tempKey]}
                    onChange={e => setReport(prev => ({ ...prev, [tempKey]: e.target.value }))}
                    placeholder="Temperature (°C)"
                    className="pl-8"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 hover:bg-muted transition-colors">
                    <Camera className="size-3.5" />
                    Take Photo
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => { void updatePhoto(photoKey, e) }}
                    />
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium cursor-pointer rounded-lg border border-border bg-background px-2.5 py-1.5 hover:bg-muted transition-colors">
                    <Upload className="size-3.5" />
                    Upload
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={e => { void updatePhoto(photoKey, e) }}
                    />
                  </label>
                </div>
                {report[photoKey] ? (
                  <img src={report[photoKey]} alt={`Compartment ${c.id}`} className="w-full h-28 object-cover rounded-lg border border-border" />
                ) : (
                  <div className="w-full h-28 rounded-lg border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
                    No photo selected
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <div className="pt-1 border-t border-border/60">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Share Format</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {[
              { id: "pdf", label: "PDF", icon: FileText },
              { id: "image", label: "Image", icon: FileImage },
              { id: "link", label: "24h Link", icon: Link2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setShareFormat(id as ShareFormat)}
                className={`rounded-xl border px-3 py-2 text-left transition-colors flex items-center gap-2 ${
                  shareFormat === id
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background hover:bg-muted/60 text-muted-foreground"
                }`}
              >
                <Icon className="size-4" />
                <span className="text-sm font-semibold">{label}</span>
              </button>
            ))}
          </div>
          {shareFormat === "link" && (
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-amber-600">
              <Clock3 className="size-3.5" />
              Link will expire automatically in 24 hours.
            </div>
          )}
        </div>
      </div>

      <Button className="w-full h-10" onClick={() => { void handleShare() }} disabled={!isFormValid || isSharing}>
        <Share2 className="size-4 mr-2" />
        {isSharing ? "Preparing..." : "Share to WhatsApp"}
      </Button>
    </div>
  )
}
