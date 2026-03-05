/**
 * Input validation helpers.
 *
 * Each validator throws a ValidationError from @rescor/core-utils on failure.
 * Validators are thin — they check structure and ranges, not business logic.
 */

import { ValidationError } from '@rescor/core-utils'

/**
 * Require that body is a non-null object.
 *
 * @param {*} body
 * @returns {object}
 */
export function requireBody (body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ValidationError('Request body must be a JSON object')
  }
  return body
}

/**
 * Require a numeric field within a range.
 *
 * @param {object} source     - Parent object
 * @param {string} field      - Field name
 * @param {object} options
 * @param {boolean} options.required - Whether the field must be present
 * @param {number}  options.min      - Inclusive minimum
 * @param {number}  options.max      - Inclusive maximum
 * @param {number}  options.exclusiveMin - Exclusive minimum
 * @param {boolean} options.integer  - Must be integer
 * @param {number}  options.defaultValue - Default if absent
 * @returns {number|undefined}
 */
export function validateNumber (source, field, options = {}) {
  let value = source[field]

  if (value == null) {
    if (options.required) {
      throw new ValidationError(`'${field}' is required`)
    }
    return options.defaultValue
  }

  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new ValidationError(`'${field}' must be a number`)
  }

  if (options.integer && !Number.isInteger(value)) {
    throw new ValidationError(`'${field}' must be an integer`)
  }

  if (options.min != null && value < options.min) {
    throw new ValidationError(`'${field}' must be >= ${options.min}`)
  }

  if (options.max != null && value > options.max) {
    throw new ValidationError(`'${field}' must be <= ${options.max}`)
  }

  if (options.exclusiveMin != null && value <= options.exclusiveMin) {
    throw new ValidationError(`'${field}' must be > ${options.exclusiveMin}`)
  }

  return value
}

/**
 * Require a non-empty array of numbers.
 *
 * @param {object} source
 * @param {string} field
 * @param {object} options
 * @param {boolean} options.required
 * @param {number}  options.minLength
 * @returns {number[]|undefined}
 */
export function validateNumberArray (source, field, options = {}) {
  let value = source[field]

  if (value == null) {
    if (options.required) {
      throw new ValidationError(`'${field}' is required`)
    }
    return undefined
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`'${field}' must be an array`)
  }

  const minLength = options.minLength || 1
  if (value.length < minLength) {
    throw new ValidationError(`'${field}' must have at least ${minLength} item(s)`)
  }

  for (let index = 0; index < value.length; index++) {
    if (typeof value[index] !== 'number' || Number.isNaN(value[index])) {
      throw new ValidationError(`'${field}[${index}]' must be a number`)
    }
  }

  return value
}

/**
 * Validate a string field.
 *
 * @param {object} source
 * @param {string} field
 * @param {object} options
 * @param {boolean}  options.required
 * @param {string[]} options.enum - Allowed values
 * @param {string}   options.defaultValue
 * @returns {string|undefined}
 */
export function validateString (source, field, options = {}) {
  let value = source[field]

  if (value == null) {
    if (options.required) {
      throw new ValidationError(`'${field}' is required`)
    }
    return options.defaultValue
  }

  if (typeof value !== 'string') {
    throw new ValidationError(`'${field}' must be a string`)
  }

  if (options.enum && !options.enum.includes(value)) {
    throw new ValidationError(`'${field}' must be one of: ${options.enum.join(', ')}`)
  }

  return value
}

/**
 * Validate CreateMeasurementRequest.
 *
 * @param {object} body
 * @returns {object} Validated fields
 */
export function validateCreateMeasurement (body) {
  requireBody(body)

  const name = validateString(body, 'name', { defaultValue: '' })
  const scalingBase = validateNumber(body, 'scalingBase', { exclusiveMin: 1, defaultValue: 4 })
  const maximumValue = validateNumber(body, 'maximumValue', { min: 1, defaultValue: 100 })
  const ttl = validateNumber(body, 'ttl', { integer: true, min: 60, max: 604800, defaultValue: 86400 })

  let hierarchy = body.hierarchy || 'default'
  if (typeof hierarchy === 'string') {
    const validTemplates = ['default', 'basic_questionnaire', 'security_scan']
    if (!validTemplates.includes(hierarchy)) {
      throw new ValidationError(`'hierarchy' must be one of: ${validTemplates.join(', ')} (or a custom array)`)
    }
  } else if (Array.isArray(hierarchy)) {
    if (hierarchy.length < 1 || hierarchy.length > 8) {
      throw new ValidationError("'hierarchy' custom array must have 1–8 items")
    }
    for (const level of hierarchy) {
      if (typeof level !== 'string') {
        throw new ValidationError("'hierarchy' array items must be strings")
      }
    }
  } else {
    throw new ValidationError("'hierarchy' must be a string template name or an array of level names")
  }

  const result = { name, hierarchy, scalingBase, maximumValue, ttl, metadata: body.metadata }
  return result
}

/**
 * Validate AddFactorRequest.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateAddFactor (body) {
  requireBody(body)

  const value = validateNumber(body, 'value', { required: true, min: 0 })

  let path = body.path
  if (path != null) {
    if (!Array.isArray(path)) {
      throw new ValidationError("'path' must be an array of strings")
    }
    for (const item of path) {
      if (typeof item !== 'string') {
        throw new ValidationError("'path' items must be strings")
      }
    }
  }

  const result = { value, path, label: body.label, metadata: body.metadata }
  return result
}

/**
 * Validate UpdateFactorRequest.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateUpdateFactor (body) {
  requireBody(body)

  const value = validateNumber(body, 'value', { min: 0 })
  const label = body.label
  const metadata = body.metadata

  const result = { value, label, metadata }
  return result
}

/**
 * Validate AddModifierRequest.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateAddModifier (body) {
  requireBody(body)

  const type = validateString(body, 'type', { required: true })
  const effect = validateString(body, 'effect', { enum: ['attenuate', 'amplify'], defaultValue: 'attenuate' })
  const application = validateString(body, 'application', { enum: ['direct', 'compound'] })
  const value = validateNumber(body, 'value', { required: true, min: 0, max: 1 })
  const label = body.label
  const metadata = body.metadata

  const result = { type, effect, application, value, label, metadata }
  return result
}

/**
 * Validate HAM533 request.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateHam533 (body) {
  requireBody(body)

  const history = validateNumber(body, 'history', { required: true, integer: true, min: 1, max: 5 })
  const access = validateNumber(body, 'access', { required: true, integer: true, min: 1, max: 3 })
  const means = validateNumber(body, 'means', { required: true, integer: true, min: 1, max: 3 })

  const result = { history, access, means }
  return result
}

/**
 * Validate CRVE3 request.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateCrve3 (body) {
  requireBody(body)

  const capabilities = validateNumber(body, 'capabilities', { required: true, integer: true, min: 1, max: 3 })
  const resources = validateNumber(body, 'resources', { required: true, integer: true, min: 1, max: 3 })
  const visibility = validateNumber(body, 'visibility', { required: true, integer: true, min: 1, max: 3 })
  const confidentiality = validateNumber(body, 'confidentiality', { required: true, integer: true, min: 1, max: 3 })
  const integrity = validateNumber(body, 'integrity', { required: true, integer: true, min: 1, max: 3 })
  const availability = validateNumber(body, 'availability', { required: true, integer: true, min: 1, max: 3 })

  const result = { capabilities, resources, visibility, confidentiality, integrity, availability }
  return result
}

/**
 * Validate SCEP request.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateScep (body) {
  requireBody(body)

  if (!body.controls || !Array.isArray(body.controls) || body.controls.length < 1) {
    throw new ValidationError("'controls' is required and must be a non-empty array")
  }

  const controls = body.controls.map((control, index) => {
    if (typeof control !== 'object') {
      throw new ValidationError(`'controls[${index}]' must be an object`)
    }
    const implemented = validateNumber(control, 'implemented', { required: true, min: 0, max: 1 })
    const correction = validateNumber(control, 'correction', { required: true, min: 0, max: 1 })
    return { implemented, correction }
  })

  const result = { controls }
  return result
}

/**
 * Validate AssetValuation request.
 *
 * @param {object} body
 * @returns {object}
 */
export function validateAssetValuation (body) {
  requireBody(body)

  const classification = validateNumber(body, 'classification', { required: true, integer: true, min: 1, max: 3 })
  const users = validateNumber(body, 'users', { required: true, integer: true, min: 1, max: 5 })

  if (!body.highValueData || !Array.isArray(body.highValueData)) {
    throw new ValidationError("'highValueData' is required and must be an array of booleans")
  }

  if (body.highValueData.length < 1 || body.highValueData.length > 6) {
    throw new ValidationError("'highValueData' must have 1–6 items")
  }

  const highValueData = body.highValueData.map((item, index) => {
    if (typeof item !== 'boolean') {
      throw new ValidationError(`'highValueData[${index}]' must be a boolean`)
    }
    return item
  })

  const result = { classification, users, highValueData }
  return result
}
