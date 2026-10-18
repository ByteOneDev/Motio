import type { MotioApi } from '../shared/api'

declare global {
  interface Window {
    /** Absent quand le renderer tourne dans un simple navigateur (npm run dev:web). */
    motio?: MotioApi
  }
}
