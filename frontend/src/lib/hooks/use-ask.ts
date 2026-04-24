'use client'

import { useState, useCallback, useEffect } from 'react'
import { toast } from 'sonner'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { searchApi } from '@/lib/api/search'
import { AskStreamEvent } from '@/lib/types/search'

const ASK_HISTORY_KEY = 'ask-history'
const MAX_HISTORY_ITEMS = 50

function loadAskHistory(): AskHistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(ASK_HISTORY_KEY)
    if (!stored) return []
    const parsed = JSON.parse(stored)
    return parsed.map((item: AskHistoryItem & { createdAt: string }) => ({
      ...item,
      createdAt: new Date(item.createdAt)
    }))
  } catch {
    return []
  }
}

function saveAskHistory(history: AskHistoryItem[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(ASK_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // Ignore storage errors
  }
}

interface AskModels {
  strategy: string
  answer: string
  finalAnswer: string
}

interface StrategyData {
  reasoning: string
  searches: Array<{ term: string; instructions: string }>
}

export interface AskHistoryItem {
  id: string
  question: string
  answer: string
  strategy: StrategyData | null
  answers: string[]
  createdAt: Date
}

interface AskState {
  isStreaming: boolean
  strategy: StrategyData | null
  answers: string[]
  finalAnswer: string | null
  error: string | null
  currentQuestion: string
}

export function useAsk() {
  const { t } = useTranslation()
  const [history, setHistory] = useState<AskHistoryItem[]>(() => loadAskHistory())
  const [state, setState] = useState<AskState>({
    isStreaming: false,
    strategy: null,
    answers: [],
    finalAnswer: null,
    error: null,
    currentQuestion: ''
  })

  const sendAsk = useCallback(async (question: string, models: AskModels) => {
    // Validate inputs
    if (!question.trim()) {
      toast.error(t('apiErrors.pleaseEnterQuestion'))
      return
    }

    if (!models.strategy || !models.answer || !models.finalAnswer) {
      toast.error(t('apiErrors.pleaseConfigureModels'))
      return
    }

    // Reset state
    setState({
      isStreaming: true,
      strategy: null,
      answers: [],
      finalAnswer: null,
      error: null,
      currentQuestion: question
    })

    try {
      const response = await searchApi.askKnowledgeBase({
        question,
        strategy_model: models.strategy,
        answer_model: models.answer,
        final_answer_model: models.finalAnswer
      })

      if (!response) {
        throw new Error('No response body received from server')
      }

      const reader = response.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()

        if (done) {
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')

        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (!jsonStr) continue

              const data: AskStreamEvent = JSON.parse(jsonStr)

              if (data.type === 'strategy') {
                setState(prev => ({
                  ...prev,
                  strategy: {
                    reasoning: data.reasoning || '',
                    searches: data.searches || []
                  }
                }))
              } else if (data.type === 'answer') {
                setState(prev => ({
                  ...prev,
                  answers: [...prev.answers, data.content || '']
                }))
              } else if (data.type === 'final_answer') {
                setState(prev => ({
                  ...prev,
                  finalAnswer: data.content || '',
                  isStreaming: false
                }))
              } else if (data.type === 'complete') {
                setState(prev => ({
                  ...prev,
                  isStreaming: false
                }))
              } else if (data.type === 'error') {
                throw new Error(data.message || 'Stream error occurred')
              }
            } catch (e) {
              if (e instanceof SyntaxError) {
                console.error('Error parsing SSE data:', e, 'Line:', line)
                // Don't throw - continue processing other lines
              } else {
                throw e
              }
            }
          }
        }
      }

      // Ensure streaming is stopped
      setState(prev => {
        // Save to history after successful completion
        if (prev.finalAnswer) {
          const historyItem: AskHistoryItem = {
            id: `ask-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            question,
            answer: prev.finalAnswer,
            strategy: prev.strategy,
            answers: prev.answers,
            createdAt: new Date()
          }
          setHistory(prevHistory => {
            const newHistory = [historyItem, ...prevHistory].slice(0, MAX_HISTORY_ITEMS)
            saveAskHistory(newHistory)
            return newHistory
          })
        }
        return { ...prev, isStreaming: false }
      })

    } catch (error) {
      const err = error as { message?: string }
      const errorMessage = err.message || 'An unexpected error occurred'
      console.error('Ask error:', error)

      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: errorMessage
      }))

      toast.error(t('apiErrors.askFailed'), {
        description: getApiErrorMessage(errorMessage, (key) => t(key))
      })
    }
  }, [t])

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      strategy: null,
      answers: [],
      finalAnswer: null,
      error: null,
      currentQuestion: ''
    })
  }, [])

  const loadFromHistory = useCallback((item: AskHistoryItem) => {
    setState({
      isStreaming: false,
      strategy: item.strategy,
      answers: item.answers,
      finalAnswer: item.answer,
      error: null,
      currentQuestion: item.question
    })
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
    saveAskHistory([])
  }, [])

  return {
    ...state,
    history,
    sendAsk,
    reset,
    loadFromHistory,
    clearHistory
  }
}
