import { useState, useEffect, useRef } from "react"
import QrScanner from "qr-scanner"
import { Plus, Trash2, QrCode, ExternalLink, Pencil, Link2, ImageUp, X, CheckCircle2, Loader2, AlertCircle, Check, Camera, ChevronRight } from "lucide-react"
import { toast } from "sonner"
import "lightgallery/css/lightgallery.css"
import "lightgallery/css/lg-zoom.css"
import "lightgallery/css/lg-thumbnail.css"
import noImageSrc from "../../icon/noimage.jpeg"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { uploadImageToImgBB } from "@/lib/imgbb"

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

interface RowInfoModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  point: DeliveryPoint
  isEditMode: boolean
  onSave?: (updated: DeliveryPoint) => void
}

export function RowInfoModal({ open, onOpenChange, point, isEditMode, onSave }: RowInfoModalProps) {
  const [drafts, setDrafts] = useState<{ key: string; value: string }[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [qrCodeImageUrl, setQrCodeImageUrl] = useState("")
  const [qrCodeDestinationUrl, setQrCodeDestinationUrl] = useState("")
  const [showQRDialog, setShowQRDialog] = useState(false)
  const [qrTab, setQrTab] = useState<"url" | "media">("url")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pendingUrl, setPendingUrl] = useState<string | null>(null)
  const [pendingUrlLabel, setPendingUrlLabel] = useState<string>("")

  // Avatar image state
  const [avatarImageUrl, setAvatarImageUrl] = useState("") // selected display image
  const [avatarImages, setAvatarImages] = useState<string[]>([]) // all uploaded images
  const [showAvatarDialog, setShowAvatarDialog] = useState(false)
  // Dialog draft state
  const [dialogImages, setDialogImages] = useState<string[]>([])
  const [dialogSelected, setDialogSelected] = useState("")
  const [avatarTab, setAvatarTab] = useState<"url" | "upload">("url")
  const [avatarUrlInput, setAvatarUrlInput] = useState("")
  const [avatarUploading, setAvatarUploading] = useState(false)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const avatarGalleryHostRef = useRef<HTMLDivElement | null>(null)
  const avatarLGInstance = useRef<any>(null)

  useEffect(() => {
    if (open) {
      setDrafts(point.descriptions ?? [])
      setQrCodeImageUrl(point.qrCodeImageUrl ?? "")
      setQrCodeDestinationUrl(point.qrCodeDestinationUrl ?? "")
      const imgs = point.avatarImages ?? (point.avatarImageUrl ? [point.avatarImageUrl] : [])
      setAvatarImages(imgs)
      setAvatarImageUrl(point.avatarImageUrl ?? (imgs[0] ?? ""))
      setIsEditing(false)
    }
  }, [open, point])

  // Init lightGallery for avatar (view mode only)
  useEffect(() => {
    if (!open || avatarImages.length === 0 || isEditMode) {
      if (avatarLGInstance.current) {
        avatarLGInstance.current.destroy()
        avatarLGInstance.current = null
      }
      return
    }
    const init = async () => {
      await new Promise(r => setTimeout(r, 150))
      if (!avatarGalleryHostRef.current) return
      const { default: lightGallery } = await import('lightgallery')
      const { default: lgZoom } = await import('lightgallery/plugins/zoom')
      const { default: lgThumbnail } = await import('lightgallery/plugins/thumbnail')
      if (avatarLGInstance.current) {
        avatarLGInstance.current.destroy()
        avatarLGInstance.current = null
      }
      avatarLGInstance.current = lightGallery(avatarGalleryHostRef.current, {
        plugins: [lgZoom, lgThumbnail],
        speed: 300,
        download: false,
        thumbnail: true,
        dynamic: true,
        dynamicEl: avatarImages.map((url) => ({
          src: url,
          thumb: url,
          subHtml: `<h4>${point.name}</h4>`,
        })),
      })
    }
    init()
    return () => {
      if (avatarLGInstance.current) {
        avatarLGInstance.current.destroy()
        avatarLGInstance.current = null
      }
    }
  }, [open, avatarImages, isEditMode, point.name])

  const openAvatarGallery = () => {
    if (!avatarLGInstance.current || avatarImages.length === 0) return
    const idx = avatarImages.indexOf(avatarImageUrl)
    avatarLGInstance.current.openGallery(idx >= 0 ? idx : 0)
  }

  const [isUploadingQR, setIsUploadingQR] = useState(false)
  const [qrDecodeStatus, setQrDecodeStatus] = useState<"idle" | "decoding" | "decoded" | "failed">("idle")

  // Decode QR code from a data URL or Blob using qr-scanner
  const decodeQrFromSource = async (source: string | Blob): Promise<string | null> => {
    try {
      const result = await QrScanner.scanImage(source, { returnDetailedScanResult: true })
      return result.data ?? null
    } catch {
      return null
    }
  }

  // Upload QR image file → ImgBB (no base64 bloat in DB)
  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploadingQR(true)
    setQrDecodeStatus("decoding")
    try {
      const url = await uploadImageToImgBB(file)
      setQrCodeImageUrl(url)
      const decoded = await decodeQrFromSource(file)
      if (decoded) {
        setQrDecodeStatus("decoded")
        setQrCodeDestinationUrl(decoded)
      } else {
        setQrDecodeStatus("failed")
      }
    } catch {
      setQrDecodeStatus("failed")
    } finally {
      setIsUploadingQR(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const hasCoords = point.latitude !== 0 && point.longitude !== 0

  const handleAdd = () => setDrafts(prev => [...prev, { key: "", value: "" }])
  const handleRemove = (i: number) => setDrafts(prev => prev.filter((_, idx) => idx !== i))
  const handleChange = (i: number, field: "key" | "value", val: string) =>
    setDrafts(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: val } : d))

  const handleSave = () => {
    try {
      onSave?.({ ...point, descriptions: drafts.filter(d => d.key.trim() !== ""), qrCodeImageUrl, qrCodeDestinationUrl, avatarImageUrl, avatarImages })
      setIsEditing(false)
      toast.success("Changes saved", {
        description: `${point.name || point.code} updated successfully.`,
        icon: <CheckCircle2 className="size-4 text-primary" />,
        duration: 3000,
      })
    } catch {
      toast.error("Failed to save", {
        description: "Please try again.",
        icon: <AlertCircle className="size-4" />,
        duration: 4000,
      })
    }
  }

  const handleCancel = () => {
    setDrafts(point.descriptions ?? [])
    setIsEditing(false)
  }

  const gmapsUrl = `https://maps.google.com/?q=${point.latitude},${point.longitude}`
  const wazeUrl = `https://waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes`
  const familyMartUrl = `https://fmvending.web.app/refill-service/M${String(point.code).padStart(4, "0")}`

  const openUrl = (url: string, label = "") => {
    if (pendingUrlLabel === label) {
      setPendingUrl(null)
      setPendingUrlLabel("")
      return
    }
    setPendingUrl(url)
    setPendingUrlLabel(label)
  }
  const confirmOpen = () => {
    if (pendingUrl) {
      window.open(pendingUrl, "_blank")
      setPendingUrl(null)
      setPendingUrlLabel("")
    }
  }

  const handleDialogInteractOutside = (event: Event) => {
    const target = event.target as HTMLElement | null
    if (!target) return
    // lightGallery is rendered in a portal outside this dialog; keep modal open while interacting with gallery UI.
    if (target.closest(".lg-outer") || target.closest(".lg-backdrop") || target.closest(".lg-container")) {
      event.preventDefault()
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) { setPendingUrl(null); setPendingUrlLabel("") } onOpenChange(o) }}>
      <DialogContent
        onInteractOutside={handleDialogInteractOutside}
        className="flex max-h-[min(78vh,34rem)] w-[90vw] max-w-[20rem] flex-col gap-0 overflow-hidden rounded-xl p-0 md:max-w-sm"
      >
        {/* Header */}
        <DialogHeader className="shrink-0 border-b border-border px-4 pt-4 pb-3 text-left md:px-5 md:pt-5 md:pb-4">
          <div className="flex items-center gap-2.5 md:gap-3">
            {/* Avatar: multi-image gallery / camera-slash placeholder */}
            {isEditMode ? (
              <button
                onClick={() => {
                  setDialogImages([...avatarImages])
                  setDialogSelected(avatarImageUrl)
                  setAvatarUrlInput("")
                  setAvatarTab("url")
                  setShowAvatarDialog(true)
                }}
                className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full shadow group focus:outline-none md:h-12 md:w-12"
              >
                {avatarImageUrl ? (
                  <img src={avatarImageUrl} alt={point.name} className="w-full h-full object-cover" />
                ) : (
                  <img src={noImageSrc} alt="No image" className="w-full h-full object-cover" />
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Camera className="size-4 text-white md:size-5" />
                </div>
              </button>
            ) : (
              avatarImages.length > 0 ? (
                <>
                  <button
                    onClick={openAvatarGallery}
                    className="relative h-9 w-9 shrink-0 cursor-zoom-in overflow-hidden rounded-full shadow focus:outline-none md:h-12 md:w-12"
                  >
                    <img src={avatarImageUrl || avatarImages[0]} alt={point.name} className="w-full h-full object-cover" />
                    {avatarImages.length > 1 && (
                      <span className="absolute -right-0.5 -bottom-0.5 rounded-full bg-black/75 px-1 py-0.5 text-[9px] leading-none text-white md:px-1.5 md:py-1 md:text-[10px]">
                        {avatarImages.length}
                      </span>
                    )}
                  </button>
                </>
              ) : (
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full shadow md:h-12 md:w-12">
                  <img src={noImageSrc} alt="No image" className="w-full h-full object-cover" />
                </div>
              )
            )}
            <div className="flex-1 min-w-0">
              <DialogTitle className="truncate text-sm font-bold text-foreground md:text-base md:leading-tight">
                {point.name}
              </DialogTitle>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="text-xs font-mono text-muted-foreground">{point.code}</span>
                <span className="text-xs text-muted-foreground/60">•</span>
                <span className="text-xs text-muted-foreground">{point.delivery}</span>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overflow-x-hidden px-4 py-3 md:px-5 md:py-4">
          {/* Information section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Information</p>
              {isEditMode && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="text-xs text-primary hover:text-primary/80 font-medium px-2 py-0.5 rounded-md hover:bg-primary/10 transition-colors"
                >
                  Edit
                </button>
              )}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                {drafts.map((d, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      placeholder="Key"
                      value={d.key}
                      onChange={e => handleChange(i, "key", e.target.value)}
                      className="w-28 h-8 text-[11px] md:text-[11px]"
                    />
                    <Input
                      placeholder="Value"
                      value={d.value}
                      onChange={e => handleChange(i, "value", e.target.value)}
                      className="flex-1 h-8 text-[11px] md:text-[11px]"
                    />
                    <button
                      onClick={() => handleRemove(i)}
                      className="text-red-400 hover:text-red-600 shrink-0"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 font-medium mt-1"
                >
                  <Plus className="size-3.5" />
                  Add field
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-border overflow-hidden">
                {drafts && drafts.length > 0 ? (
                  drafts.map((d, i) => (
                    <div
                      key={i}
                      className={`flex items-center border-b border-border last:border-0 group transition-colors duration-150 hover:bg-primary/5 cursor-default ${i % 2 === 1 ? "bg-muted/10" : "bg-background"}`}
                    >
                      <span className="w-[80px] shrink-0 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2.5 py-2 bg-muted/50 group-hover:bg-muted/80 border-r border-border truncate transition-colors duration-150">
                        {d.key}
                      </span>
                      <span className="flex-1 text-xs font-medium text-foreground px-2.5 py-2">
                        {d.value}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-5">No information added</p>
                )}
              </div>
            )}
          </div>

          {/* Navigation buttons */}
          {!isEditing && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Open With</p>
              <div className="flex flex-col gap-1.5">

                {/* Google Maps row */}
                {hasCoords && (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="transition-transform duration-300 ease-in-out" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'Google Maps' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(gmapsUrl, "Google Maps")} className="w-full flex items-center gap-2.5 px-3 py-2 bg-muted/50 hover:bg-muted transition-all active:scale-[0.98] group">
                        <img src="/Gmaps.png" alt="Google Maps" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                        <span className="flex-1 text-left text-xs font-semibold text-foreground">Google Maps</span>
                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </button>
                      <div className="relative overflow-hidden bg-muted/50">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#4285F4,#34A853)' }} />
                        <div className="flex items-center gap-2.5 px-3 py-2 pl-5">
                          <button
                            onClick={() => openUrl(gmapsUrl, "Google Maps")}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <img src="/Gmaps.png" alt="Google Maps" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground leading-tight truncate">Open Google Maps?</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">Will leave this app</p>
                            </div>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button onClick={confirmOpen} aria-label="Open Google Maps URL" className="h-8 w-8 rounded-full transition-colors active:scale-95 flex items-center justify-center" style={{ color: '#4285F4' }}><ExternalLink className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Waze row */}
                {hasCoords && (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="transition-transform duration-300 ease-in-out" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'Waze' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(wazeUrl, "Waze")} className="w-full flex items-center gap-2.5 px-3 py-2 bg-muted/50 hover:bg-muted transition-all active:scale-[0.98] group">
                        <img src="/waze.png" alt="Waze" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                        <span className="flex-1 text-left text-xs font-semibold text-foreground">Waze</span>
                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </button>
                      <div className="relative overflow-hidden bg-muted/50">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#33CCFF,#05C8F0)' }} />
                        <div className="flex items-center gap-2.5 px-3 py-2 pl-5">
                          <button
                            onClick={() => openUrl(wazeUrl, "Waze")}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <img src="/waze.png" alt="Waze" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground leading-tight truncate">Open Waze?</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">Will leave this app</p>
                            </div>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button onClick={confirmOpen} aria-label="Open Waze URL" className="h-8 w-8 rounded-full transition-colors active:scale-95 flex items-center justify-center" style={{ color: '#05C8F0' }}><ExternalLink className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FamilyMart row */}
                <div className="overflow-hidden rounded-xl border border-border">
                  <div className="transition-transform duration-300 ease-in-out" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'FamilyMart' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(familyMartUrl, "FamilyMart")} className="w-full flex items-center gap-2.5 px-3 py-2 bg-muted/50 hover:bg-muted transition-all active:scale-[0.98] group">
                      <img src="/FamilyMart.png" alt="FamilyMart" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                      <span className="flex-1 text-left text-xs font-semibold text-foreground">FamilyMart</span>
                      <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </button>
                    <div className="relative overflow-hidden bg-muted/50">
                      <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#007140,#00A651)' }} />
                        <div className="flex items-center gap-2.5 px-3 py-2 pl-5">
                        <button
                          onClick={() => openUrl(familyMartUrl, "FamilyMart")}
                          className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                        >
                          <img src="/FamilyMart.png" alt="FamilyMart" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-foreground leading-tight truncate">Open FamilyMart?</p>
                            <p className="text-[9px] text-muted-foreground mt-0.5">Will leave this app</p>
                          </div>
                        </button>
                        <div className="flex items-center shrink-0">
                          <button onClick={confirmOpen} aria-label="Open FamilyMart URL" className="h-8 w-8 rounded-full transition-colors active:scale-95 flex items-center justify-center" style={{ color: '#007140' }}><ExternalLink className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code row — view mode, slides like other rows */}
                {!isEditMode && qrCodeDestinationUrl && (
                  <div className="overflow-hidden rounded-xl border border-border">
                    <div className="transition-transform duration-300 ease-in-out" style={{ display: 'grid', gridTemplateColumns: '100% 100%', transform: pendingUrlLabel === 'QR Code' ? 'translateX(-100%)' : 'translateX(0)' }}>
                      <button onClick={() => openUrl(qrCodeDestinationUrl, "QR Code")} className="w-full flex items-center gap-2.5 px-3 py-2 bg-muted/50 hover:bg-muted transition-all active:scale-[0.98] group">
                        <QrCode className="w-7 h-7 text-orange-500 shrink-0 p-1" />
                        <span className="flex-1 text-left text-xs font-semibold text-foreground">QR Code</span>
                        <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                      </button>
                      <div className="relative overflow-hidden bg-muted/50">
                        <div className="absolute inset-y-0 left-0 w-1" style={{ background: 'linear-gradient(to bottom,#f97316,#ea580c)' }} />
                        <div className="flex items-center gap-2.5 px-3 py-2 pl-5">
                          <button
                            onClick={() => openUrl(qrCodeDestinationUrl, "QR Code")}
                            className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                          >
                            <QrCode className="w-7 h-7 text-orange-500 shrink-0 p-1" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground leading-tight truncate">Open QR Code?</p>
                              <p className="text-[9px] text-muted-foreground mt-0.5">Will leave this app</p>
                            </div>
                          </button>
                          <div className="flex items-center shrink-0">
                            <button onClick={confirmOpen} aria-label="Open QR Code URL" className="h-8 w-8 rounded-full transition-colors active:scale-95 flex items-center justify-center" style={{ color: '#f97316' }}><ExternalLink className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* QR Code — edit mode (opens settings dialog, no slide) */}
                {isEditMode && (
                  <button
                    onClick={() => { setQrDecodeStatus("idle"); setShowQRDialog(true) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-border bg-muted/50 hover:bg-muted transition-all active:scale-[0.98] group"
                  >
                    <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4 text-orange-500" />
                      <span className="absolute -top-1 -right-1 bg-background rounded-full p-0.5 shadow-sm border border-border/40">
                        {qrCodeImageUrl ? <Pencil className="w-2.5 h-2.5" /> : <Plus className="w-2.5 h-2.5" />}
                      </span>
                    </div>
                    <span className="flex-1 text-left text-xs font-semibold text-foreground">
                      {qrCodeImageUrl ? "Edit QR Code" : "Add QR Code"}
                    </span>
                    <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                  </button>
                )}

              </div>
            </div>
          )}

          {/* Avatar Gallery Dialog */}
          <Dialog open={showAvatarDialog} onOpenChange={(o) => { if (!o) { setAvatarTab("url"); setAvatarUrlInput("") } setShowAvatarDialog(o) }}>
            <DialogContent className="max-w-sm rounded-2xl md:max-w-lg md:rounded-3xl">
              <DialogHeader>
                <DialogTitle className="text-base">Avatar Images</DialogTitle>
                <DialogDescription>Manage avatar images. Click an image to set it as display thumbnail.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Image grid */}
                <div className="grid grid-cols-4 gap-2 md:grid-cols-5">
                  {dialogImages.map((url, i) => (
                    <div key={i} className="relative group">
                      <button
                        onClick={() => setDialogSelected(url)}
                        className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                          dialogSelected === url
                            ? "border-primary ring-2 ring-primary/30"
                            : "border-transparent hover:border-primary/40"
                        }`}
                      >
                        <img src={url} alt={`avatar-${i}`} className="w-full h-full object-cover" />
                      </button>
                      {/* Selected badge */}
                      {dialogSelected === url && (
                        <div className="absolute -top-1 -right-1 bg-primary rounded-full p-0.5 pointer-events-none">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                      {/* Delete button */}
                      <button
                        onClick={() => {
                          const next = dialogImages.filter((_, idx) => idx !== i)
                          setDialogImages(next)
                          if (dialogSelected === url) setDialogSelected(next[0] ?? "")
                        }}
                        className="absolute -bottom-1 -right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  {/* Add slot */}
                  {dialogImages.length < 8 && (
                    <div className="w-full aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center">
                      <Plus className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {dialogImages.length === 0 && (
                  <p className="text-xs text-center text-muted-foreground py-1">No images yet. Add one below.</p>
                )}

                {/* Add new image */}
                {dialogImages.length < 8 && (
                  <div className="border-t border-border pt-3 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Add Image</p>
                    {/* Tabs */}
                    <div className="flex rounded-lg border overflow-hidden">
                      {(["url", "upload"] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setAvatarTab(tab)}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold transition-colors ${
                            avatarTab === tab ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
                          }`}
                        >
                          {tab === "url" ? <><Link2 className="w-3 h-3" />URL</> : <><ImageUp className="w-3 h-3" />Upload</>}
                        </button>
                      ))}
                    </div>
                    {avatarTab === "url" && (
                      <div className="flex gap-2">
                        <Input
                          value={avatarUrlInput}
                          onChange={e => setAvatarUrlInput(e.target.value)}
                          placeholder="https://example.com/image.jpg"
                          className="h-8 text-[11px] md:text-[11px] flex-1"
                        />
                        <Button
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={!avatarUrlInput.trim()}
                          onClick={() => {
                            const url = avatarUrlInput.trim()
                            if (!url) return
                            const next = [...dialogImages, url]
                            setDialogImages(next)
                            if (!dialogSelected) setDialogSelected(url)
                            setAvatarUrlInput("")
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )}
                    {avatarTab === "upload" && (
                      <>
                        <div
                          onClick={() => !avatarUploading && avatarFileRef.current?.click()}
                          className="flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-3 cursor-pointer hover:bg-muted/40 transition-colors"
                        >
                          {avatarUploading ? (
                            <><Loader2 className="w-4 h-4 text-muted-foreground animate-spin" /><p className="text-xs text-muted-foreground">Uploading…</p></>
                          ) : (
                            <><ImageUp className="w-4 h-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Click to select image</p></>
                          )}
                        </div>
                        <input
                          ref={avatarFileRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={async e => {
                            const files = Array.from(e.target.files ?? [])
                            if (!files.length) return
                            setAvatarUploading(true)
                            const uploadToastId = toast.loading(
                              `Uploading ${files.length} image${files.length > 1 ? "s" : ""}…`,
                              { duration: Infinity }
                            )
                            try {
                              const urls: string[] = []
                              for (const file of files) {
                                const url = await uploadImageToImgBB(file)
                                urls.push(url)
                              }
                              toast.dismiss(uploadToastId)
                              toast.success("Upload berjaya", {
                                description: `${urls.length} imej dimuat naik.`,
                                icon: <CheckCircle2 className="size-4 text-primary" />,
                                duration: 3000,
                              })
                              const next = [...dialogImages, ...urls].slice(0, 8)
                              setDialogImages(next)
                              if (!dialogSelected && next.length > 0) setDialogSelected(next[0])
                            } catch {
                              toast.dismiss(uploadToastId)
                              toast.error("Upload gagal", {
                                description: "Sila cuba semula.",
                                icon: <AlertCircle className="size-4" />,
                                duration: 4000,
                              })
                            } finally {
                              setAvatarUploading(false)
                              if (avatarFileRef.current) avatarFileRef.current.value = ""
                            }
                          }}
                        />
                      </>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="flex gap-2 justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setShowAvatarDialog(false)}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={() => {
                    const newImages = dialogImages
                    const newSelectedUrl = dialogSelected || dialogImages[0] || ""
                    setAvatarImages(newImages)
                    setAvatarImageUrl(newSelectedUrl)
                    setShowAvatarDialog(false)
                    // Save immediately after updating avatar images
                    const updatedPoint = {
                      ...point,
                      descriptions: drafts.filter(d => d.key.trim() !== ""),
                      qrCodeImageUrl,
                      qrCodeDestinationUrl,
                      avatarImageUrl: newSelectedUrl,
                      avatarImages: newImages
                    }
                    onSave?.(updatedPoint)
                    toast.success("Avatar updated", {
                      description: `${point.name || point.code} images saved.`,
                      icon: <CheckCircle2 className="size-4 text-primary" />,
                      duration: 3000,
                    })
                  }}
                >
                  <Check className="w-3.5 h-3.5 mr-1" />Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* QR Code dialog — unified for view + edit mode */}
          <Dialog open={showQRDialog} onOpenChange={(o) => { if (!o) { setQrTab("url"); setQrDecodeStatus("idle") } setShowQRDialog(o) }}>
            <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden gap-0">

              {/* Header */}
              <DialogHeader className="px-5 pt-5 pb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0">
                    <QrCode className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold leading-tight">
                      {isEditMode ? "QR Code Settings" : "QR Code"}
                    </DialogTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isEditMode ? "Manage the QR code for this location." : "View or open the QR code destination."}
                    </p>
                  </div>
                </div>
              </DialogHeader>

              {/* Body */}
              <div className="px-5 py-4 space-y-4">

                {/* ── EDIT MODE ── */}
                {isEditMode && (
                  <>
                    {/* Preview */}
                    {qrCodeImageUrl && (
                      <div className="relative flex justify-center p-3 bg-muted/40 rounded-2xl border border-border">
                        <img src={qrCodeImageUrl} alt="QR Code"
                          className="w-40 h-40 object-contain rounded-lg bg-white shadow-sm"
                        />
                        <button
                          onClick={() => { setQrCodeImageUrl(""); setQrDecodeStatus("idle"); if (fileInputRef.current) fileInputRef.current.value = "" }}
                          className="absolute top-2 right-2 bg-destructive text-white rounded-full p-1 hover:bg-destructive/80 transition-colors shadow"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Tabs */}
                    <div className="flex rounded-xl border border-border overflow-hidden bg-muted/40 p-0.5 gap-0.5">
                      {(["url", "media"] as const).map(tab => (
                        <button key={tab}
                          onClick={() => { setQrTab(tab); setQrDecodeStatus("idle") }}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                            qrTab === tab
                              ? "bg-background text-foreground shadow-sm"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {tab === "url" ? <><Link2 className="w-3 h-3" />URL</> : <><ImageUp className="w-3 h-3" />Upload</>}
                        </button>
                      ))}
                    </div>

                    {/* Tab: URL */}
                    {qrTab === "url" && (
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">QR Image URL</label>
                        <Input value={qrCodeImageUrl} onChange={e => setQrCodeImageUrl(e.target.value)}
                          placeholder="https://example.com/qr.png" className="h-9 text-[11px] md:text-[11px]" />
                      </div>
                    )}

                    {/* Tab: Upload → ImgBB */}
                    {qrTab === "media" && (
                      <div className="space-y-2.5">
                        <div
                          onClick={() => !isUploadingQR && fileInputRef.current?.click()}
                          className={`flex flex-col items-center justify-center gap-2.5 border-2 border-dashed rounded-2xl py-6 cursor-pointer transition-colors ${
                            isUploadingQR ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/40"
                          }`}
                        >
                          {isUploadingQR ? (
                            <>
                              <Loader2 className="w-6 h-6 text-primary animate-spin" />
                              <p className="text-xs font-medium text-primary">Uploading to cloud…</p>
                            </>
                          ) : (
                            <>
                              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                                <ImageUp className="w-5 h-5 text-muted-foreground" />
                              </div>
                              <div className="text-center">
                                <p className="text-xs font-semibold text-foreground">Click to upload</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">Auto-scan included · PNG, JPG, etc.</p>
                              </div>
                            </>
                          )}
                        </div>
                        {qrDecodeStatus === "decoding" && (
                          <div className="flex items-center gap-2 text-xs text-blue-500 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
                            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />Scanning QR code…
                          </div>
                        )}
                        {qrDecodeStatus === "decoded" && (
                          <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-lg px-3 py-2">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />QR decoded — destination URL auto-filled.
                          </div>
                        )}
                        {qrDecodeStatus === "failed" && (
                          <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />QR code could not be read. Please enter the destination URL manually.
                          </div>
                        )}
                        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleQrFileUpload} />
                      </div>
                    )}

                    {/* Destination URL */}
                    <div className="pt-1 border-t border-border space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Destination URL</label>
                        {qrDecodeStatus === "decoded" && (
                          <span className="text-[10px] text-green-600 dark:text-green-400 font-semibold bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded-md">Auto-filled ✓</span>
                        )}
                      </div>
                      <Input value={qrCodeDestinationUrl} onChange={e => setQrCodeDestinationUrl(e.target.value)}
                        placeholder="https://example.com/destination" className="h-9 text-[11px] md:text-[11px]" />
                    </div>
                  </>
                )}

                {/* ── VIEW MODE ── */}
                {!isEditMode && (
                  <div className="space-y-3">
                    {qrCodeImageUrl && (
                      <div className="flex justify-center p-3 bg-muted/40 rounded-2xl border border-border">
                        <img src={qrCodeImageUrl} alt="QR Code"
                          className="w-44 h-44 object-contain rounded-lg bg-white shadow-sm"
                        />
                      </div>
                    )}
                    {qrCodeDestinationUrl ? (
                      <div className="bg-muted/50 rounded-xl border border-border px-4 py-3 space-y-1">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Destination URL</p>
                        <p className="text-xs font-mono break-all text-foreground leading-relaxed">{qrCodeDestinationUrl}</p>
                      </div>
                    ) : !qrCodeImageUrl && (
                      <div className="flex flex-col items-center gap-2 py-6 text-center">
                        <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                          <QrCode className="w-6 h-6 text-muted-foreground/50" />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground">No QR code configured</p>
                        <p className="text-xs text-muted-foreground/60">Enable edit mode to add one.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-border flex gap-2 justify-end bg-muted/20">
                {isEditMode ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowQRDialog(false)}>Cancel</Button>
                    <Button size="sm" onClick={() => { handleSave(); setShowQRDialog(false) }}>Save</Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setShowQRDialog(false)}>Close</Button>
                    {qrCodeDestinationUrl && (
                      <Button size="sm" onClick={() => { window.open(qrCodeDestinationUrl, "_blank"); setShowQRDialog(false) }}>
                        <ExternalLink className="w-3.5 h-3.5 mr-1.5" />Open Link
                      </Button>
                    )}
                  </>
                )}
              </div>

            </DialogContent>
          </Dialog>

          {/* QR Scan result modal removed — integrated into main QR dialog */}
        </div>

        <DialogFooter className="shrink-0 border-t border-border bg-background px-4 py-3 sm:space-x-0">
          {isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel}>Cancel</Button>
              <Button size="sm" onClick={handleSave}><Check className="size-3.5 mr-1" />Save</Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-0 py-0 text-xs text-red-600 hover:bg-transparent hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <div ref={avatarGalleryHostRef} className="hidden" />
    </>
  )
}
