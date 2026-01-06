import { NextResponse } from 'next/server'
import thaiProvinceData from '@/lib/thai-province-data-min.json'

// Minimal province interface
interface MinimalProvince {
  n: string  // name_th
  e: string  // name_en
}

// Cache the provinces list (only names, no districts)
let cachedProvinces: { name_th: string; name_en: string }[] | null = null

function getProvinces() {
  if (!cachedProvinces) {
    cachedProvinces = (thaiProvinceData as MinimalProvince[]).map(p => ({
      name_th: p.n,
      name_en: p.e,
    }))
  }
  return cachedProvinces
}

export async function GET() {
  const provinces = getProvinces()
  
  return NextResponse.json(provinces, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
    },
  })
}

