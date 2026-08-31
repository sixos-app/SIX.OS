export type PilotTerminalState = { stdinTTY?: boolean; stdoutTTY?: boolean; rawMode?: boolean }

export function assertPilotInteractiveTerminal(message: string, terminal: PilotTerminalState = {}) {
  const stdinTTY = terminal.stdinTTY ?? process.stdin.isTTY
  const stdoutTTY = terminal.stdoutTTY ?? process.stdout.isTTY
  const rawMode = terminal.rawMode ?? typeof process.stdin.setRawMode === 'function'
  if (!stdinTTY || !stdoutTTY || !rawMode) throw new Error(message)
}

export function readHiddenLine(label: string) {
  return new Promise<string>((resolveValue, reject) => {
    let value = ''
    let finished = false
    const stdin = process.stdin
    stdin.setRawMode(true)
    stdin.resume()
    process.stdout.write(label)

    const finish = (error: Error | null, result = '') => {
      if (finished) return
      finished = true
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      process.stdout.write('\n')
      if (error) reject(error)
      else resolveValue(result)
    }
    const onData = (chunk: Buffer) => {
      const text = new TextDecoder().decode(chunk)
      if (text.includes('\u001b')) return
      for (const character of text) {
        if (character === '\u0003') {
          finish(new Error('password input cancelled'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish(null, value)
          return
        }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1)
        else value += character
      }
    }
    stdin.on('data', onData)
  })
}
