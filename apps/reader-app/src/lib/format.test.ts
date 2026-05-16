import { describe, expect, it } from 'vitest'
import { formatUsd } from './format'

describe('formatUsd', () => {
  it('omits decimals for whole-dollar prices', () => {
    expect(formatUsd(9)).toBe('$9')
  })

  it('keeps cents for fractional prices', () => {
    expect(formatUsd(4.99)).toBe('$4.99')
  })
})
