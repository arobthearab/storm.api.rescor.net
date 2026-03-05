/**
 * NIST 800-30 risk-matrix route.
 *
 * POST /v1/nist/risk-matrix
 */

import { Router } from 'express'
import { nistRiskMatrix } from '../engines/nist.mjs'
import { requireBody } from '../validators/index.mjs'

export function createNistRoutes () {
  const router = Router()

  // POST /v1/nist/risk-matrix
  router.post('/risk-matrix', (request, response, next) => {
    try {
      const body = requireBody(request.body)
      const computedResult = nistRiskMatrix(body)

      response.json({ data: computedResult })
    } catch (error) {
      next(error)
    }
  })

  return router
}
