import { NextRequest, NextResponse } from 'next/server'
import thaiProvinceData from '@/lib/thai-province-data-min.json'

// Minimal interfaces
interface MinimalDistrict {
  n: string  // name_th
  e: string  // name_en
}

interface MinimalProvince {
  n: string  // name_th
  e: string  // name_en
  d: MinimalDistrict[]  // districts
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const province = searchParams.get('province')
  
  if (!province) {
    return NextResponse.json({ error: 'Province parameter is required' }, { status: 400 })
  }
  
  // Find the province
  const provinceData = (thaiProvinceData as MinimalProvince[]).find(
    p => p.n === province || p.e === province
  )
  
  if (!provinceData) {
    return NextResponse.json({ error: 'Province not found' }, { status: 404 })
  }
  
  // Return only district names (not sub-districts)
  const districts = provinceData.d.map(d => ({
    name_th: d.n,
    name_en: d.e,
  }))
  
  return NextResponse.json(districts, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
    },
  })
}

