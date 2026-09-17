export interface Route {
  id: string
  origin: string
  destination: string
  monthlyAmount: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface RouteFormData {
  origin: string
  destination: string
  monthlyAmount: number
}
