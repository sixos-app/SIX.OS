import packageJson from '../package.json'

/**
 * Single Source of Truth para a versão do SIX.OS.
 * Importa diretamente a versão definida em package.json.
 */
export const APP_VERSION = packageJson.version
export const APP_VERSION_LABEL = `v${packageJson.version}`
export const APP_FULL_VERSION_LABEL = `SIX.OS v${packageJson.version}`
