const HTML_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-AU,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Upgrade-Insecure-Requests': '1',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'AussiePropertyLookup/1.0 (contact@example.com)',
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const s = priceStr.replace(/[$,]/g, '').trim().toLowerCase();
  if (s.endsWith('m')) {
    const n = parseFloat(s.slice(0, -1));
    return isNaN(n) ? null : Math.round(n * 1_000_000);
  }
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

function slugFromAddress(address) {
  const m = address.match(/(\w+)\s+(VIC|NSW|QLD|SA|WA|TAS|ACT)\s+(\d{4})/i);
  if (m) return `${m[1].toLowerCase()}-${m[2].toLowerCase()}-${m[3]}`;
  return null;
}

function parseListingBlock(block) {
  // Street address
  const streetMatch = block.match(/itemProp="streetAddress"[^>]*>([^<]+)<\/span>/);
  const street = streetMatch ? streetMatch[1].trim() : '';

  // Suburb / state / postcode
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

async function scrapeAllhomesHTML(slug) {
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
  const listings = [];

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

// ── Worker (Service Worker format for Cloudflare REST API) ───────────────────

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    // ── /health ──────────────────────────────────────────────────────────────
    if (path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'aussie-property-cf-worker' }), { headers: cors });
    }

    // ── /autosuggest?q=... ───────────────────────────────────────────────────
    if (path === '/autosuggest') {
      const q = url.searchParams.get('q') ?? '';
      if (q.length < 2) {
        return new Response(JSON.stringify({ suggestions: [] }), { headers: cors });
      }

      const stateMap = {
        victoria: 'VIC', 'new south wales': 'NSW', queensland: 'QLD',
        'south australia': 'SA', 'western australia': 'WA',
        tasmania: 'TAS', 'australian capital territory': 'ACT',
      };

      try {
        const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6&countrycodes=au`;
        const res = await fetch(nominatimUrl, { headers: NOMINATIM_HEADERS });
        if (!res.ok) throw new Error('nominatim failed');
        const results = await res.json();

        const suggestions = results
          .filter(item => item.display_name?.toLowerCase().includes('australia'))
          .map(item => {
            const addr = item.address ?? {};
            const parts = [];
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

        return new Response(JSON.stringify({ suggestions }), { headers: cors });
      } catch {
        return new Response(JSON.stringify({ suggestions: [] }), { headers: cors });
      }
    }

    // ── /property?address=... ────────────────────────────────────────────────
    if (path === '/property') {
      const address = url.searchParams.get('address') ?? '';
      if (!address) {
        return new Response(JSON.stringify({ error: 'address required' }), { status: 400, headers: cors });
      }

      const slug = slugFromAddress(address);
      if (!slug) {
        return new Response(JSON.stringify({ error: 'Could not parse suburb from address' }), { status: 400, headers: cors });
      }

      const raw = await scrapeAllhomesHTML(slug);

      const soldPrices = raw
        .filter(l => l.price)
        .map(l => ({
          price: l.price,
          priceStr: l.priceStr,
          date: l.soldDate ?? '',
          address: l.address,
          beds: l.beds,
          baths: l.baths,
          cars: l.cars,
          propertyType: l.propertyType,
        }));

      const validPrices = soldPrices.filter(p => p.price && p.price > 50000).map(p => p.price);
      const estimatedRange = validPrices.length >= 2
        ? { min: Math.min(...validPrices), max: Math.max(...validPrices) }
        : null;

      const current = soldPrices[0] ?? {};

      return new Response(JSON.stringify({
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
      }), { headers: cors });
    }

    // Fallback: 404
    return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: cors });
  }
