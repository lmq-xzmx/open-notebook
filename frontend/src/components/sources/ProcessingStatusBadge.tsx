"use client"

import { useState, useEffect } from "react"
import { sourcesApi } from "@/lib/api/sources"
import { insightsApi } from "@/lib/api/insights"
import { Badge } from "@/components/ui/badge"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { useTranslation } from "@/lib/hooks/use-translation"

interface ProcessingStatusBadgeProps {
  sourceId: string
  embedded?: boolean
  initialCommandId?: string
}

type ProcessingStatus = "pending" | "processing" | "completed" | "failed" | "canceled" | "unknown"

export function ProcessingStatusBadge({
  sourceId,
  embedded,
  initialCommandId
}: ProcessingStatusBadgeProps) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ProcessingStatus>(embedded ? "completed" : "pending")
  const [isLoading, setIsLoading] = useState(!embedded && !!initialCommandId)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If already embedded, no need to poll
    if (embedded) {
      setStatus("completed")
      setIsLoading(false)
      return
    }

    // If we have a command_id, poll for status
    if (initialCommandId) {
      pollCommandStatus(initialCommandId)
    } else {
      // Check source status directly
      checkSourceStatus()
    }
  }, [sourceId, initialCommandId, embedded])

  const checkSourceStatus = async () => {
    try {
      const response = await sourcesApi.status(sourceId)
      if (response.command_id) {
        pollCommandStatus(response.command_id)
      } else if (response.status) {
        setStatus(mapStatus(response.status))
        setIsLoading(false)
      } else {
        setStatus("unknown")
        setIsLoading(false)
      }
    } catch (err) {
      console.error("Failed to check source status:", err)
      setError("Failed to load status")
      setIsLoading(false)
    }
  }

  const pollCommandStatus = async (commandId: string) => {
    setIsLoading(true)
    let attempts = 0
    const maxAttempts = 60 // 2 minutes max

    const poll = async () => {
      try {
        const response = await insightsApi.getCommandStatus(commandId)
        const newStatus = response.status as ProcessingStatus

        if (newStatus === "completed") {
          setStatus("completed")
          setIsLoading(false)
          return
        }

        if (newStatus === "failed" || newStatus === "canceled") {
          setStatus("failed")
          setIsLoading(false)
          return
        }

        // Still running, continue polling
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 3000) // Poll every 3 seconds
        } else {
          setStatus("unknown")
          setIsLoading(false)
        }
      } catch (err) {
        console.error("Failed to poll command status:", err)
        // Continue polling even on error
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, 5000) // Retry every 5 seconds on error
        } else {
          setStatus("unknown")
          setIsLoading(false)
        }
      }
    }

    poll()
  }

  const mapStatus = (backendStatus: string): ProcessingStatus => {
    switch (backendStatus.toLowerCase()) {
      case "pending":
      case "queued":
        return "pending"
      case "running":
      case "processing":
        return "processing"
      case "completed":
      case "success":
        return "completed"
      case "failed":
      case "error":
      case "canceled":
        return "failed"
      default:
        return "unknown"
    }
  }

  const getStatusConfig = () => {
    switch (status) {
      case "pending":
        return {
          variant: "secondary" as const,
          label: t("sources.processing.pending") || "等待中",
          color: "text-muted-foreground"
        }
      case "processing":
        return {
          variant: "default" as const,
          label: t("sources.processing.processing") || "处理中",
          color: "text-blue-600"
        }
      case "completed":
        return {
          variant: "default" as const,
          label: t("sources.processing.completed") || "已完成",
          color: "text-green-600"
        }
      case "failed":
        return {
          variant: "destructive" as const,
          label: t("sources.processing.failed") || "失败",
          color: "text-red-600"
        }
      default:
        return {
          variant: "secondary" as const,
          label: t("sources.processing.unknown") || "未知",
          color: "text-muted-foreground"
        }
    }
  }

  const config = getStatusConfig()

  if (isLoading) {
    return (
      <Badge variant="secondary" className="text-xs gap-1">
        <LoadingSpinner className="h-3 w-3" />
        {config.label}
      </Badge>
    )
  }

  return (
    <Badge variant={config.variant} className={`text-xs ${config.color}`}>
      {status === "processing" && (
        <span className="animate-pulse mr-1">●</span>
      )}
      {config.label}
    </Badge>
  )
}
