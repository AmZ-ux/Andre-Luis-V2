// Converts snake_case string to camelCase
function toCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

// Recursively transforms all object keys from snake_case to camelCase
export function transformKeys<T>(data: any): T {
  if (Array.isArray(data)) {
    return data.map(transformKeys) as unknown as T
  }
  if (data !== null && typeof data === 'object' && !(data instanceof Date)) {
    const result: Record<string, any> = {}
    for (const key of Object.keys(data)) {
      result[toCamel(key)] = transformKeys(data[key])
    }
    return result as T
  }
  return data as T
}
