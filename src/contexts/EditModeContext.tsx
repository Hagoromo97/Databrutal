import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from "react"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"

interface EditModeContextType {
  isEditMode: boolean
  hasUnsavedChanges: boolean
  isSaving: boolean
  setIsEditMode: (value: boolean) => void
  setHasUnsavedChanges: (value: boolean) => void
  saveChanges: () => void
  registerSaveHandler: (handler: () => Promise<void>) => void
  discardChanges: () => void
  registerDiscardHandler: (handler: () => void) => void
}

const EditModeContext = createContext<EditModeContextType | undefined>(undefined)

export function EditModeProvider({ children }: { children: ReactNode }) {
  const [isEditMode, setIsEditMode] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const saveHandlerRef = useRef<(() => Promise<void>) | null>(null)
  const discardHandlerRef = useRef<(() => void) | null>(null)

  const registerSaveHandler = (handler: () => Promise<void>) => {
    saveHandlerRef.current = handler
  }

  const registerDiscardHandler = useCallback((handler: () => void) => {
    discardHandlerRef.current = handler
  }, [])

  const saveChanges = async () => {
    if (saveHandlerRef.current) {
      setIsSaving(true)
      try {
        await saveHandlerRef.current()
        setHasUnsavedChanges(false)
        // Success toast is shown by the individual save handler
      } catch (e) {
        toast.error("Save failed", {
          description: e instanceof Error ? e.message : "Unknown error. Please try again.",
          icon: <AlertCircle className="size-4" />,
          duration: 6000,
        })
      } finally {
        setIsSaving(false)
      }
    } else {
      setHasUnsavedChanges(false)
    }
  }

  const discardChanges = () => {
    if (discardHandlerRef.current) {
      discardHandlerRef.current()
    }
    setHasUnsavedChanges(false)
  }

  return (
    <EditModeContext.Provider
      value={{
        isEditMode,
        hasUnsavedChanges,
        isSaving,
        setIsEditMode,
        setHasUnsavedChanges,
        saveChanges,
        registerSaveHandler,
        discardChanges,
        registerDiscardHandler,
      }}
    >
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode() {
  const context = useContext(EditModeContext)
  if (context === undefined) {
    return {
      isEditMode: false,
      hasUnsavedChanges: false,
      isSaving: false,
      setIsEditMode: () => {},
      setHasUnsavedChanges: () => {},
      saveChanges: () => {},
      registerSaveHandler: () => {},
      discardChanges: () => {},
      registerDiscardHandler: () => {},
    }
  }
  return context
}
