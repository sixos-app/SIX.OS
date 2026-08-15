import { useEffect, useState } from 'react'
import { formatElapsedTimer } from '../../utils/formatters'

export function MissionTimerValue({ startedAt }: { startedAt: string }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const interval = window.setInterval(() => setTick((current) => current + 1), 1000)
    return () => window.clearInterval(interval)
  }, [startedAt])
  return <>{formatElapsedTimer(startedAt)}</>
}
