export type StatusMessage = {
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  timestamp: number
}