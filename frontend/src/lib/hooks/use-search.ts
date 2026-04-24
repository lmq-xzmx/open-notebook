import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import { searchApi } from '@/lib/api/search'
import { SearchRequest } from '@/lib/types/search'

const SEARCH_HISTORY_KEY = 'search-history'
const MAX_HISTORY_ITEMS = 50

export interface SearchHistoryItem {
  id: string
  query: string
  searchType: 'text' | 'vector'
  resultCount: number
  createdAt: Date
}

function loadSearchHistory(): SearchHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((item: SearchHistoryItem & { createdAt: string }) => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }))
  } catch {
    return []
  }
}

function saveSearchHistory(history: SearchHistoryItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

export function useSearch() {
  const { t } = useTranslation()
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => loadSearchHistory())
  const [currentSearch, setCurrentSearch] = useState<{
    query: string
    searchType: 'text' | 'vector'
  } | null>(null)

  const mutation = useMutation({
    mutationFn: async (params: SearchRequest) => {
      const response = await searchApi.search(params)

      // Process results to add final_score
      const processedResults = response.results.map(result => ({
        ...result,
        final_score: result.relevance ?? result.similarity ?? result.score ?? 0
      }))

      // Sort by final_score descending
      processedResults.sort((a, b) => b.final_score - a.final_score)

      return {
        ...response,
        results: processedResults
      }
    },
    onSuccess: (data, variables) => {
      // Add to history on successful search
      const historyItem: SearchHistoryItem = {
        id: `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        query: variables.query,
        searchType: variables.type || 'text',
        resultCount: data.total_count,
        createdAt: new Date()
      }
      setHistory(prev => {
        const updated = [historyItem, ...prev].slice(0, MAX_HISTORY_ITEMS)
        saveSearchHistory(updated)
        return updated
      })
      setCurrentSearch({
        query: variables.query,
        searchType: variables.type || 'text'
      })
    },
    onError: (error: Error) => {
      toast.error(t('apiErrors.searchFailed'), {
        description: t(getApiErrorKey(error.message))
      })
    }
  })

  const clearHistory = useCallback(() => {
    setHistory([])
    saveSearchHistory([])
  }, [])

  const loadFromHistory = useCallback((item: SearchHistoryItem) => {
    setCurrentSearch({
      query: item.query,
      searchType: item.searchType
    })
  }, [])

  const removeFromHistory = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(item => item.id !== id)
      saveSearchHistory(updated)
      return updated
    })
  }, [])

  return {
    ...mutation,
    history,
    currentSearch,
    clearHistory,
    loadFromHistory,
    removeFromHistory
  }
}
