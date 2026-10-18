import { create } from 'zustand'
import { z } from 'zod'
import { ColorSchema } from '@/model/schema'

/** Kit de marque : ce qui revient dans toutes vos vidéos. Stocké hors des projets. */
export const BrandSchema = z.object({
  name: z.string(),
  colors: z.array(ColorSchema),
  titleFont: z.string().nullable(),
  textFont: z.string().nullable(),
  logo: z.object({ src: z.string(), width: z.number().positive(), height: z.number().positive(), name: z.string() }).nullable(),
})

export type Brand = z.infer<typeof BrandSchema>

export const EMPTY_BRAND: Brand = { name: 'Ma marque', colors: [], titleFont: null, textFont: null, logo: null }

export function isBrandEmpty(b: Brand): boolean {
  return b.colors.length === 0 && !b.titleFont && !b.textFont && !b.logo
}

const LOCAL_KEY = 'motio:brand'

interface BrandState {
  brand: Brand
  loaded: boolean
  editing: boolean
  load: () => Promise<void>
  save: (brand: Brand) => void
  setEditing: (editing: boolean) => void
}

export const useBrand = create<BrandState>()((set) => ({
  brand: EMPTY_BRAND,
  loaded: false,
  editing: false,
  async load() {
    try {
      const raw = window.motio ? await window.motio.readBrand() : localStorage.getItem(LOCAL_KEY)
      const parsed = raw ? BrandSchema.safeParse(JSON.parse(raw)) : null
      set({ brand: parsed?.success ? parsed.data : EMPTY_BRAND, loaded: true })
    } catch {
      set({ loaded: true })
    }
  },
  save(brand) {
    set({ brand })
    const data = JSON.stringify(brand)
    if (window.motio) window.motio.writeBrand(data).catch(() => {})
    else {
      try {
        localStorage.setItem(LOCAL_KEY, data)
      } catch {
        // Logo trop lourd pour le stockage du navigateur : le kit reste valable pour cette session.
      }
    }
  },
  setEditing: (editing) => set({ editing }),
}))
