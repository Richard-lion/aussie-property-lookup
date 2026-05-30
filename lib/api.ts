// Frontend API layer for Aussie Property Lookup
// All API calls go through the same Vercel deployment (Next.js serverless functions)

const API_BASE = ''; // same-origin, serverless routes under /api/

export interface AutosuggestResult {
  label: string;
  lat: number;
  lon: number;
  type: string;
}

export interface SoldPrice {
  price: number | null;
  date: string;
  address: string;
  beds: number | null;
  baths: number | null;
  cars: number | null;
  propertyType: string | null;
}

export interface PropertyData {
  source: string;
  address: string;
  slug: string | null;
  propertyType: string | null;
  beds: number | null;
  baths: number | null;
  cars: number | null;
  landArea: number | null;
  currentPrice: number | null;
  soldPrices: SoldPrice[];
  estimatedRange: { min: number; max: number } | null;
  totalSold: number;
  searchUrl: string;
}

export async function fetchAutosuggest(query: string): Promise<AutosuggestResult[]> {
  if (!query || query.length < 2) return [];
  try {
    const url = `/api/autosuggest?q=${encodeURIComponent(query)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return data.suggestions ?? [];
  } catch {
    return [];
  }
}

export async function fetchProperty(address: string): Promise<PropertyData | null> {
  try {
    const url = `/api/property?address=${encodeURIComponent(address)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}