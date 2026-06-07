function formatExtra(extra) {
  if (!extra || Object.keys(extra).length === 0) return ''
  try {
    return ` ${JSON.stringify(extra)}`
  } catch {
    return ''
  }
}

export function logError(context, message, extra) {
  console.error(`[${context}] ${message}${formatExtra(extra)}`)
}

export function logWarn(context, message, extra) {
  console.warn(`[${context}] ${message}${formatExtra(extra)}`)
}

export function logInfo(context, message, extra) {
  console.log(`[${context}] ${message}${formatExtra(extra)}`)
}
