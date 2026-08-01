import { describe, it, expect } from 'vitest'
import { transformKeys } from './transformKeys'

describe('transformKeys', () => {
  it('converts snake_case object keys to camelCase', () => {
    const input = { passenger_name: 'João', created_at: '2026-01-01' }
    const result = transformKeys(input)
    expect(result).toEqual({ passengerName: 'João', createdAt: '2026-01-01' })
  })

  it('handles nested objects', () => {
    const input = {
      passenger_name: 'João',
      address: { zip_code: '12345-678', city_name: 'São Paulo' },
    }
    const result = transformKeys(input)
    expect(result).toEqual({
      passengerName: 'João',
      address: { zipCode: '12345-678', cityName: 'São Paulo' },
    })
  })

  it('handles arrays of objects', () => {
    const input = [
      { passenger_name: 'Ana', monthly_fee: 189.9 },
      { passenger_name: 'Carlos', monthly_fee: 250 },
    ]
    const result: any = transformKeys(input)
    expect(result[0]).toEqual({ passengerName: 'Ana', monthlyFee: 189.9 })
    expect(result[1]).toEqual({ passengerName: 'Carlos', monthlyFee: 250 })
  })

  it('returns primitives unchanged', () => {
    expect(transformKeys('hello')).toBe('hello')
    expect(transformKeys(42)).toBe(42)
    expect(transformKeys(null)).toBeNull()
    expect(transformKeys(undefined)).toBeUndefined()
  })

  it('handles empty objects', () => {
    expect(transformKeys({})).toEqual({})
  })

  it('handles empty arrays', () => {
    expect(transformKeys([])).toEqual([])
  })

  it('leaves camelCase keys unchanged', () => {
    const input = { passengerName: 'João', createdAt: '2026-01-01' }
    expect(transformKeys(input)).toEqual(input)
  })

  it('handles deep nesting', () => {
    const input = {
      data: {
        user_profile: {
          full_name: 'Maria',
          contact_info: { phone_number: '11999999999' },
        },
      },
    }
    const result: any = transformKeys(input)
    expect(result.data.userProfile.fullName).toBe('Maria')
    expect(result.data.userProfile.contactInfo.phoneNumber).toBe('11999999999')
  })

  it('handles Date objects without converting', () => {
    const date = new Date('2026-01-01')
    const result: any = transformKeys({ created_at: date, data: { nested_date: date } })
    expect(result.createdAt).toBe(date)
    expect(result.data.nestedDate).toBe(date)
  })
})
