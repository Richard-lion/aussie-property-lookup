import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q') ?? '';
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const stateMap: Record<string, string> = {
    victoria: 'VIC', 'new south wales': 'NSW', queensland: 'QLD',
    'south australia': 'SA', 'western australia': 'WA',
    tasmania: 'TAS', 'australian capital territory': 'ACT',
  };

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=au`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AussiePropertyLookup/1.0 (contact@example.com)' },
    });
    if (!res.ok) return NextResponse.json({ suggestions: [] });
    const results = await res.json();

    const suggestions = results
      .filter((item: any) => item.display_name?.toLowerCase().includes('australia'))
      .map((item: any) => {
        const addr = item.address ?? {};
        const parts: string[] = [];
        if (addr.house_number && addr.road) parts.push(`${addr.house_number} ${addr.road}`);
        else if (addr.neighbourhood) parts.push(addr.neighbourhood);
        else if (addr.suburb) parts.push(addr.suburb);
        if (addr.suburb) parts.push(addr.suburb);
        else if (addr.city) parts.push(addr.city);
        else if (addr.town) parts.push(addr.town);
        if (addr.state) parts.push(stateMap[addr.state.toLowerCase()] ?? addr.state.toUpperCase());
        if (addr.postcode) parts.push(addr.postcode);
        return {
          label: parts.join(', '),
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          type: item.type,
        };
      });

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}