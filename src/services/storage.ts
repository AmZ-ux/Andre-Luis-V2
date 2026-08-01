export const storage = {
  get<T>(key: string): T | null {
    try {
      const item = localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : null
    } catch {
      return null
    }
  },

  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // silently ignore
    }
  },

  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // silently ignore
    }
  },

  getSession<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : null
    } catch {
      return null
    }
  },

  setSession<T>(key: string, value: T): void {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch {
      // silently ignore
    }
  },

  removeSession(key: string): void {
    try {
      sessionStorage.removeItem(key)
    } catch {
      // silently ignore
    }
  },

  clear(): void {
    try {
      localStorage.clear()
      sessionStorage.clear()
    } catch {
      // silently ignore
    }
  },
}
