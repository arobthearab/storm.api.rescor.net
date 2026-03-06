/**
 * FactorBatch — high-throughput factor submission with auto-chunking.
 *
 * Splits large factor arrays into chunks (default 5,000), submitting
 * up to `concurrency` (default 3) chunks in parallel.
 *
 * Usage:
 *   const batch = storm.measurement(id).createBatch()
 *   batch.add({ value: 0.8, path: ['root'], label: 'Finding A' })
 *   batch.add({ value: 0.6, label: 'Finding B', modifiers: [{ type: 'control', value: 0.3 }] })
 *   const result = await batch.submit()
 *   // result = { created: 2, failed: 0, errors: [], chunks: 1 }
 */

const DEFAULT_CHUNK_SIZE = 5000
const DEFAULT_CONCURRENCY = 3

/**
 * Batch factor builder with chunked parallel submission.
 */
export class FactorBatch {
  /**
   * @param {import('../StormClient.mjs').StormClient} client
   * @param {string} measurementId
   * @param {object} [options]
   * @param {number} [options.chunkSize=5000]  - Factors per request
   * @param {number} [options.concurrency=3]   - Max parallel requests
   */
  constructor (client, measurementId, options = {}) {
    this._client = client
    this._measurementId = measurementId
    this._chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE
    this._concurrency = options.concurrency || DEFAULT_CONCURRENCY
    this._factors = []
  }

  /**
   * Queue a factor for batch submission.
   *
   * @param {object} factor - { value, path?, label?, metadata?, modifiers?: [] }
   * @returns {FactorBatch} this (for chaining)
   */
  add (factor) {
    this._factors.push(factor)
    return this
  }

  /**
   * Queue multiple factors at once.
   *
   * @param {object[]} factors
   * @returns {FactorBatch} this
   */
  addAll (factors) {
    this._factors.push(...factors)
    return this
  }

  /**
   * Number of factors currently queued.
   * @returns {number}
   */
  get size () {
    return this._factors.length
  }

  /**
   * Submit all queued factors in chunked parallel requests.
   *
   * @returns {Promise<FactorBatchResult>}
   */
  async submit () {
    if (this._factors.length === 0) {
      return new FactorBatchResult(0, 0, [], 0)
    }

    const chunks = splitIntoChunks(this._factors, this._chunkSize)
    let totalCreated = 0
    let totalFailed = 0
    const allErrors = []

    // Process chunks with bounded concurrency
    for (let start = 0; start < chunks.length; start += this._concurrency) {
      const batch = chunks.slice(start, start + this._concurrency)
      const promises = batch.map((chunk, chunkIndex) => {
        const globalChunkIndex = start + chunkIndex
        return this._submitChunk(chunk, globalChunkIndex)
      })

      const results = await Promise.allSettled(promises)

      for (let index = 0; index < results.length; index++) {
        const settlement = results[index]
        if (settlement.status === 'fulfilled') {
          const chunkResult = settlement.value
          totalCreated += chunkResult.data.created
          totalFailed += chunkResult.data.failed
          allErrors.push(...(chunkResult.data.errors || []))
        } else {
          // Entire chunk failed (e.g. network error)
          const chunkSize = batch[index].length
          totalFailed += chunkSize
          allErrors.push({
            chunkIndex: start + index,
            message: settlement.reason?.message || 'Chunk submission failed'
          })
        }
      }
    }

    const result = new FactorBatchResult(totalCreated, totalFailed, allErrors, chunks.length)
    return result
  }

  /**
   * Submit a single chunk to the batch factors endpoint.
   * @private
   */
  async _submitChunk (chunk, chunkIndex) {
    const result = await this._client.post(
      `/v1/measurements/${this._measurementId}/factors/batch`,
      { factors: chunk }
    )
    return result
  }
}

/**
 * Result of a batch factor submission.
 */
export class FactorBatchResult {
  /**
   * @param {number} created
   * @param {number} failed
   * @param {object[]} errors
   * @param {number} chunks
   */
  constructor (created, failed, errors, chunks) {
    /** @type {number} Successfully created factors */
    this.created = created

    /** @type {number} Failed factors */
    this.failed = failed

    /** @type {object[]} Error details */
    this.errors = errors

    /** @type {number} Total chunks submitted */
    this.chunks = chunks

    /** @type {number} Total factors submitted */
    this.total = created + failed
  }

  /** @returns {boolean} True if all factors were created successfully */
  get isComplete () {
    return this.failed === 0
  }

  /** @returns {boolean} True if some (but not all) factors failed */
  get isPartial () {
    return this.failed > 0 && this.created > 0
  }
}

/**
 * Split an array into chunks of a given size.
 *
 * @param {any[]} array
 * @param {number} chunkSize
 * @returns {any[][]}
 */
function splitIntoChunks (array, chunkSize) {
  const chunks = []
  for (let index = 0; index < array.length; index += chunkSize) {
    chunks.push(array.slice(index, index + chunkSize))
  }
  return chunks
}
