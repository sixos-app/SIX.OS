import { useState, useCallback, useMemo, type KeyboardEvent } from 'react'
import type { TeamMember } from '../../data/dashboard'

export function useMentions({
  value,
  onChange,
  teamMembers = [],
}: {
  value: string
  onChange: (next: string) => void
  teamMembers?: TeamMember[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStartIndex, setMentionStartIndex] = useState(-1)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Filter members with configured username
  const availableMembers = useMemo(() => {
    return teamMembers.filter((m) => Boolean(m.username && m.username.trim()))
  }, [teamMembers])

  // Filtered suggestions according to query typed after @
  const suggestions = useMemo(() => {
    if (!isOpen) return []
    const q = mentionQuery.toLowerCase().trim()
    if (!q) return availableMembers

    return availableMembers.filter((m) => {
      const username = (m.username || '').toLowerCase()
      const name = (m.name || '').toLowerCase()
      return username.includes(q) || name.includes(q)
    })
  }, [isOpen, mentionQuery, availableMembers])

  const checkTrigger = useCallback(
    (text: string, cursorPosition: number) => {
      // Find the last @ before the cursor
      const textBeforeCursor = text.slice(0, cursorPosition)
      const lastAtIndex = textBeforeCursor.lastIndexOf('@')

      if (lastAtIndex === -1) {
        setIsOpen(false)
        return
      }

      // Check if @ is at start of string or preceded by whitespace / newline / open bracket
      const charBeforeAt = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : ' '
      const isWordBoundary = /\s|[(\[{]/.test(charBeforeAt)

      if (!isWordBoundary) {
        setIsOpen(false)
        return
      }

      const query = textBeforeCursor.slice(lastAtIndex + 1)
      // If query contains spaces or is longer than 40 chars, it's not a mention in progress
      if (/\s/.test(query) || query.length > 40) {
        setIsOpen(false)
        return
      }

      setMentionStartIndex(lastAtIndex)
      setMentionQuery(query)
      setSelectedIndex(0)
      setIsOpen(true)
    },
    []
  )

  const selectMention = useCallback(
    (member: TeamMember, textareaElement?: HTMLTextAreaElement | null) => {
      if (mentionStartIndex === -1) return

      const cleanUsername = member.username?.replace(/^@/, '') || member.name.toLowerCase().replace(/\s+/g, '.')
      const mentionString = `@${cleanUsername} `

      const beforeMention = value.slice(0, mentionStartIndex)
      const afterMention = value.slice(mentionStartIndex + 1 + mentionQuery.length)
      const nextValue = beforeMention + mentionString + afterMention

      onChange(nextValue)
      setIsOpen(false)
      setMentionQuery('')
      setMentionStartIndex(-1)

      if (textareaElement) {
        const newCursorPos = beforeMention.length + mentionString.length
        setTimeout(() => {
          textareaElement.focus()
          textareaElement.setSelectionRange(newCursorPos, newCursorPos)
        }, 0)
      }
    },
    [value, mentionStartIndex, mentionQuery, onChange]
  )

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>, textareaElement?: HTMLTextAreaElement | null) => {
      if (!isOpen || suggestions.length === 0) {
        if (isOpen && event.key === 'Escape') {
          setIsOpen(false)
          event.preventDefault()
        }
        return false
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % suggestions.length)
        return true
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
        return true
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault()
        const selected = suggestions[selectedIndex]
        if (selected) {
          selectMention(selected, textareaElement)
        }
        return true
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        return true
      }

      return false
    },
    [isOpen, suggestions, selectedIndex, selectMention]
  )

  return {
    isOpen,
    suggestions,
    selectedIndex,
    checkTrigger,
    selectMention,
    handleKeyDown,
    closeMentions: () => setIsOpen(false),
  }
}
