import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const sourceDirectory = '/Users/six.user/Documents/SIX OS v0.43.0/SELOS'
const destinationDirectory = new URL('../public/gamification/levels/', import.meta.url)

const assetPairs = [
  ['CRIADOR.png', '01-criador.png'],
  ['VISIONARIO.png', '02-visionario.png'],
  ['CATALISADOR.png', '03-catalisador.png'],
  ['EXPLORADOR.png', '04-explorador.png'],
  ['INPULSIONADOR.png', '05-impulsionador.png'],
  ['CONECTOR.png', '06-conector.png'],
  ['ESTRATEGISTA.png', '07-estrategista.png'],
  ['INVENTOR.png', '08-inventor.png'],
  ['ARTICULADOR.png', '09-articulador.png'],
  ['ARQUITETO.png', '10-arquiteto.png'],
  ['ALQUIMISTA.png', '11-alquimista.png'],
  ['ORQUESTRADOR.png', '12-orquestrador.png'],
  ['VANGUARDISTA.png', '13-vanguardista.png'],
  ['PIONEIRO.png', '14-pioneiro.png'],
  ['MAESTRO.png', '15-maestro.png'],
  ['TRASFORMADOR.png', '16-transformador.png'],
  ['MENTOR.png', '17-mentor.png'],
  ['REFERENCIA.png', '18-referencia.png'],
  ['FAROL.png', '19-farol.png'],
  ['AUTOR.png', '20-autor.png'],
  ['MESTRE.png', '21-mestre.png'],
  ['ICONE.png', '22-icone.png'],
  ['SINGULAR.png', '23-singular.png'],
  ['LEGADO.png', '24-legado.png'],
  ['ORIGINADOR.png', '25-originador.png'],
] as const

function sha256(file: Buffer) {
  return createHash('sha256').update(file).digest('hex')
}

for (const [sourceName, destinationName] of assetPairs) {
  const [source, destination] = await Promise.all([
    readFile(`${sourceDirectory}/${sourceName}`),
    readFile(new URL(destinationName, destinationDirectory)),
  ])

  assert.equal(sha256(destination), sha256(source), `${destinationName} must preserve the official PNG bytes`)
}

console.log('✅ GAMIFICATION BADGE INTEGRITY: 25 PNGs correspondem byte a byte à fonte oficial.')
