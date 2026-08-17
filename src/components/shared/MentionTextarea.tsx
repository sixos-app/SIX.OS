import { useRef, type ChangeEvent, type KeyboardEvent, type TextareaHTMLAttributes } from 'react'
import type { TeamMember } from '../../data/dashboard'
import { MentionPopover } from './MentionPopover'
import { useMentions } from './useMentions'

export type MentionTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & {
  value: string
  onChange: (value: string) => void
  teamMembers?: TeamMember[]
  containerStyle?: React.CSSProperties
}

export function MentionTextarea({
  value,
  onChange,
  teamMembers = [],
  containerStyle,
  placeholder,
  rows = 3,
  maxLength,
  required,
  disabled,
  className,
  style,
  onKeyDown: customOnKeyDown,
  ...props
}: MentionTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const {
    isOpen,
    suggestions,
    selectedIndex,
    checkTrigger,
    selectMention,
    handleKeyDown,
  } = useMentions({
    value,
    onChange,
    teamMembers,
  })

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    const nextVal = event.target.value
    onChange(nextVal)
    const cursor = event.target.selectionStart ?? nextVal.length
    checkTrigger(nextVal, cursor)
  }

  function handleKeyUp(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      const cursor = event.currentTarget.selectionStart ?? value.length
      checkTrigger(value, cursor)
    }
  }

  function handleClick(event: React.MouseEvent<HTMLTextAreaElement>) {
    const cursor = event.currentTarget.selectionStart ?? value.length
    checkTrigger(value, cursor)
  }

  function onKeyDownInternal(event: KeyboardEvent<HTMLTextAreaElement>) {
    const handled = handleKeyDown(event, textareaRef.current)
    if (!handled && customOnKeyDown) {
      customOnKeyDown(event)
    }
  }

  return (
    <div
      className="mention-textarea-container"
      style={{ position: 'relative', width: '100%', ...containerStyle }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={onKeyDownInternal}
        onKeyUp={handleKeyUp}
        onClick={handleClick}
        placeholder={placeholder}
        rows={rows}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        className={className}
        style={style}
        {...props}
      />
      {isOpen && suggestions.length > 0 && (
        <MentionPopover
          suggestions={suggestions}
          selectedIndex={selectedIndex}
          onSelect={(member) => selectMention(member, textareaRef.current)}
        />
      )}
    </div>
  )
}
