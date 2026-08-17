import { type ReactNode } from 'react'

export function MentionRenderer({ text }: { text?: string | null }): ReactNode {
  if (!text || !text.trim()) return null

  // Tokenize by URLs and @mentions
  // Regex: capture URL or @username (where username is 3-40 chars of a-z0-9._-)
  const tokenRegex = /(https?:\/\/[^\s]+|(?:^|[\s(])@[a-z0-9._-]{3,40})/gi

  const elements: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = tokenRegex.exec(text)) !== null) {
    const matchStart = match.index
    const matchStr = match[0]

    // Push plain text before match
    if (matchStart > lastIndex) {
      elements.push(text.slice(lastIndex, matchStart))
    }

    if (matchStr.startsWith('http://') || matchStr.startsWith('https://')) {
      // URL link
      elements.push(
        <a
          key={`url-${matchStart}`}
          href={matchStr}
          target="_blank"
          rel="noreferrer noopener"
          className="mention-link"
          style={{ color: '#c6ff38', textDecoration: 'underline', overflowWrap: 'break-word', wordBreak: 'break-word' }}
        >
          {matchStr}
        </a>
      )
    } else {
      // @mention (may have leading whitespace/punctuation)
      const prefix = matchStr.startsWith(' ') || matchStr.startsWith('\n') || matchStr.startsWith('(') ? matchStr[0] : ''
      const mentionText = prefix ? matchStr.slice(1) : matchStr

      if (prefix) elements.push(prefix)

      elements.push(
        <span
          key={`mention-${matchStart}`}
          className="mention-tag"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 5px',
            margin: '0 1px',
            background: 'rgba(198, 255, 56, 0.12)',
            border: '1px solid rgba(198, 255, 56, 0.3)',
            borderRadius: '4px',
            color: '#c6ff38',
            fontWeight: 800,
            fontSize: 'inherit',
            lineHeight: 1.2,
            letterSpacing: '0.2px',
          }}
        >
          {mentionText}
        </span>
      )
    }

    lastIndex = matchStart + matchStr.length
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex))
  }

  return <>{elements}</>
}
