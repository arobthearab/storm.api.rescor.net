/**
 * Request Logger Middleware — Structured Activity Logging via Recorder
 *
 * Logs every HTTP request and its response using @rescor/core-utils Recorder.
 * Placed after requestTracing so that x-request-id is available.
 *
 * Event codes (7000–7099 range — STORM API):
 *   7000  Request received      (info)
 *   7001  Response sent — 2xx   (info)
 *   7002  Response sent — 4xx   (warning)
 *   7003  Response sent — 5xx   (error)
 *   7010  Batch request started (info)
 *
 * Log file: storm-api.log (resolved via RESCOR_LOG_BASE or /tmp/rescor/logs)
 */

import { Recorder } from '@rescor/core-utils'

// ── Event Codes ─────────────────────────────────────────────────────────────
const EVENT_REQUEST_RECEIVED  = 7000
const EVENT_RESPONSE_SUCCESS  = 7001
const EVENT_RESPONSE_CLIENT   = 7002
const EVENT_RESPONSE_SERVER   = 7003
const EVENT_BATCH_REQUEST     = 7010

// ── Singleton Recorder ──────────────────────────────────────────────────────
let recorder = null

/**
 * Initialise the shared Recorder instance.
 *
 * Call once during application startup, before mounting the middleware.
 *
 * @param {object} [options]
 * @param {string} [options.logFile='storm-api.log'] - Log file name
 * @param {string} [options.program='storm-api']     - Program identifier
 * @param {boolean} [options.tee]                    - Force tee mode
 * @returns {Recorder} The initialised recorder
 */
export function initialiseRequestLogger (options = {}) {
  const logFile = options.logFile || 'storm-api.log'
  const program = options.program || 'storm-api'

  recorder = new Recorder(logFile, program, { tee: options.tee })
  recorder.clearErrorState

  return recorder
}

/**
 * Return the active Recorder (for shutdown or direct use elsewhere).
 *
 * @returns {Recorder|null}
 */
export function getRecorder () {
  return recorder
}

/**
 * Close the Recorder — call during graceful shutdown.
 */
export function closeRecorder () {
  if (recorder) {
    recorder.close()
    recorder = null
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pick the severity and event code from the HTTP status code.
 *
 * @param {number} statusCode
 * @returns {{ code: number, severity: string }}
 */
function classifyResponse (statusCode) {
  let result = { code: EVENT_RESPONSE_SUCCESS, severity: 'i' }

  if (statusCode >= 500) {
    result = { code: EVENT_RESPONSE_SERVER, severity: 'e' }
  } else if (statusCode >= 400) {
    result = { code: EVENT_RESPONSE_CLIENT, severity: 'w' }
  }

  return result
}

/**
 * Detect batch endpoints (factors/batch, modifiers/batch).
 *
 * @param {string} path
 * @returns {boolean}
 */
function isBatchRequest (path) {
  return path.includes('/batch')
}

// ── Middleware ───────────────────────────────────────────────────────────────

/**
 * Express middleware that logs request receipt and response completion.
 *
 * Must be mounted after requestTracing (needs request.requestId).
 */
export function requestLogger (request, response, next) {
  if (!recorder) {
    next()
    return
  }

  const startTime = Date.now()
  const method = request.method
  const path = request.originalUrl || request.url
  const requestId = request.requestId || '-'
  const correlationId = request.correlationId || '-'
  const userAgent = request.headers['user-agent'] || '-'
  const remoteAddress = request.ip || request.socket?.remoteAddress || '-'

  // ── Log request arrival ─────────────────────────────────────────────────
  const requestMetadata = {
    requestId,
    correlationId,
    method,
    path,
    remoteAddress,
    userAgent,
    contentLength: request.headers['content-length'] || 0
  }

  if (isBatchRequest(path)) {
    recorder.emit(EVENT_BATCH_REQUEST, 'i', `${method} ${path}`, requestMetadata)
  } else {
    recorder.emit(EVENT_REQUEST_RECEIVED, 'i', `${method} ${path}`, requestMetadata)
  }

  // ── Log response completion ─────────────────────────────────────────────
  response.on('finish', () => {
    const durationMilliseconds = Date.now() - startTime
    const statusCode = response.statusCode
    const { code, severity } = classifyResponse(statusCode)

    const responseMetadata = {
      requestId,
      correlationId,
      method,
      path,
      statusCode,
      durationMilliseconds,
      contentLength: response.getHeader('content-length') || 0
    }

    recorder.emit(
      code,
      severity,
      `${method} ${path} → ${statusCode} (${durationMilliseconds}ms)`,
      responseMetadata
    )
  })

  next()
}
