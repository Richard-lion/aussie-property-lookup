import { NextRequest, NextResponse } from 'next/server';
import { parsePrice, slugFromAddress } from '@/lib/allhomes';

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const HTML_HEADERS = {
  'User-Agent': USER_AGENT,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
};

// ── HTML parsing helpers ────────────────────────────────────────────────────────

function extractString(html: string, pattern: RegExp): string {
  const m = html.match(pattern);
  return m ? m[1].trim() : '';
}

function extractNumbers(html: string, pattern: RegExp): number[] {
  const nums: number[] = [];
  const matches = html.matchAll(pattern);
  for (const m of matches) nums.push(parseInt(m[1], 10));
  return nums;
}

function parseListingBlock(block: string) {
  // Street address
  const streetMatch = block.match(/itemProp="streetAddress"[^>]*>([^<]+)<\/span>/);
  const street = streetMatch ? streetMatch[1].trim() : '';

  // Suburb / state / postcode from microdata
  const localityMatch = block.match(/itemProp="addressLocality"[^>]*>([^<]+)<\/span>/);
  const regionMatch = block.match(/itemProp="addressRegion"[^>]*>([^<]+)<\/span>/);
  const postcodeMatch = block.match(/itemProp="postalCode"[^>]*>([^<]+)<\/span>/);
  const suburb = localityMatch ? localityMatch[1].trim() : '';
  const state = regionMatch ? regionMatch[1].trim() : '';
  const postcode = postcodeMatch ? postcodeMatch[1].trim() : '';
  const fullAddress = [street, suburb, state, postcode].filter(Boolean).join(', ');

  // Price
  const priceMatch = block.match(/\$(\d{3}(?:,\d{3})+|\d{6}(?!\d))/);
  const priceStr = priceMatch ? priceMatch[0] : null;
  const price = parsePrice(priceStr);

  // Beds / Baths / Cars via css-rhetjd span order
  const rhetjdNums = [...block.matchAll(/class="css-rhetjd">(\d+)<\/span>/g)].map(m => parseInt(m[1], 10));
  const beds = rhetjdNums[0] ?? null;
  const baths = rhetjdNums[1] ?? null;
  const cars = rhetjdNums[2] ?? null;

  // Property type
  const nameMatch = block.match(/itemProp="name" content="([^"]+)"/);
  const propertyType = nameMatch ? nameMatch[1] : null;

  // Sold date
  const dateMatch = block.match(/(?:sold|Sold)[^<]{0,30}(\d{1,2}\s+\w+\s+\d{4})/);
  const soldDate = dateMatch ? dateMatch[1] : null;

  return { address: fullAddress, price, priceStr, beds, baths, cars, propertyType, soldDate };
}

async function scrapeAllhomesHTML(slug: string): Promise<any[]> {
  const url = `https://www.allhomes.com.au/sold/${slug}/`;
  let html = '';

  try {
    const res = await fetch(url, {
      headers: HTML_HEADERS,
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    html = await res.text();
  } catch {
    return [];
  }

  if (!html || html.length < 1000) return [];

  // Find all listing card IDs
  const listingIdMatches = [...html.matchAll(/id="allhomes-search-listing-card-listing-details-(\d+)"/g)];
  const listings: any[] = [];

  for (const idMatch of listingIdMatches) {
    const start = html.indexOf(idMatch[0]);
    const nextStart = html.indexOf('id="allhomes-search-listing-card-listing-details-', start + 10);
    const block = html.slice(start, nextStart > 0 ? nextStart : start + 20000);

    const parsed = parseListingBlock(block);
    if (parsed.address || parsed.price) {
      listings.push(parsed);
    }
  }

  return listings;
}

// ── Route handler ───────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address') ?? '';

  if (!address) {
    return NextResponse.json({ error: 'address required' }, { status: 400 });
  }

  const slug = slugFromAddress(address);

  if (!slug) {
    return NextResponse.json({ error: 'Could not parse suburb from address' }, { status: 400 });
  }

  // Scrape sold listings
  const raw = await scrapeAllhomesHTML(slug);

  // Build response
  const soldPrices = raw
    .filter((l: any) => l.price)
    .map((l: any) => ({
      price: l.price,
      priceStr: l.priceStr,
      date: l.soldDate ?? '',
      address: l.address,
      beds: l.beds,
      baths: l.baths,
      cars: l.cars,
      propertyType: l.propertyType,
    }));

  const validPrices = soldPrices.filter((p: any) => p.price && p.price > 50000).map((p: any) => p.price);
  const estimatedRange = validPrices.length >= 2
    ? { min: Math.min(...validPrices), max: Math.max(...validPrices) }
    : null;

  const current = soldPrices[0] ?? {};

  return NextResponse.json({
    source: raw.length > 0 ? 'allhomes_html' : 'none',
    address,
    slug,
    propertyType: current.propertyType ?? null,
    beds: current.beds ?? null,
    baths: current.baths ?? null,
    cars: current.cars ?? null,
    landArea: null,
    currentPrice: current.price ?? null,
    soldPrices,
    estimatedRange,
    totalSold: soldPrices.length,
    searchUrl: `https://www.allhomes.com.au/sold/${slug}/`,
  });
}