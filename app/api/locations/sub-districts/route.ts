import { NextRequest, NextResponse } from 'next/server'
import thaiProvinceData from '@/lib/thai-province-data-min.json'

// Minimal interfaces
interface MinimalSubDistrict {
  n: string  // name_th
  e: string  // name_en
  z?: number // zip_code
}

interface MinimalDistrict {
  n: string  // name_th
  e: string  // name_en
  s: MinimalSubDistrict[]  // sub_districts
}

interface MinimalProvince {
  n: string  // name_th
  e: string  // name_en
  d: MinimalDistrict[]  // districts
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const province = searchParams.get('province')
  const district = searchParams.get('district')
  
  if (!province || !district) {
    return NextResponse.json(
      { error: 'Province and district parameters are required' }, 
      { status: 400 }
    )
  }
  
  // Find the province
  const provinceData = (thaiProvinceData as MinimalProvince[]).find(
    p => p.n === province || p.e === province
  )
  
  if (!provinceData) {
    return NextResponse.json({ error: 'Province not found' }, { status: 404 })
  }
  
  // Find the district
  const districtData = provinceData.d.find(
    d => d.n === district || d.e === district
  )
  
  if (!districtData) {
    return NextResponse.json({ error: 'District not found' }, { status: 404 })
  }
  
  // Return sub-districts
  const subDistricts = districtData.s.map(s => ({
    name_th: s.n,
    name_en: s.e,
    zip_code: s.z,
  }))
  
  return NextResponse.json(subDistricts, {
    headers: {
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 24 hours
    },
  })
}

