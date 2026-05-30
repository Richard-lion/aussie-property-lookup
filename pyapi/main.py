from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx, re

app = FastAPI(title="Aussie Property API", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection": "keep-alive",
}

USER_AGENT = {"User-Agent": "AussiePropertyLookup/1.0"}


# ─── helpers ───────────────────────────────────────────────────────────────────

def _state_name_to_abbr(state: str) -> str:
    mapping = {
        "victoria": "VIC", "new south wales": "NSW", "queensland": "QLD",
        "south australia": "SA", "western australia": "WA",
        "tasmania": "TAS", "australian capital territory": "ACT",
    }
    return mapping.get(state.lower(), state.upper())


def _slug_from_address(address: str) -> str | None:
    """Extract 'suburb-state-postcode' slug from address string."""
    m = re.search(
        r"(\w+)\s+(VIC|NSW|QLD|SA|WA|TAS|ACT)\s+(\d{4})",
        address, re.IGNORECASE
    )
    if m:
        return f"{m.group(1).lower()}-{m.group(2).lower()}-{m.group(3)}"
    return None


def _parse_price(price_str: str) -> int | None:
    """Convert '$1,234,567' or '1.23M' -> integer."""
    if not price_str:
        return None
    s = str(price_str).replace('$', '').replace(',', '').strip().lower()
    if s.endswith('m'):
        try:
            return int(float(s[:-1]) * 1_000_000)
        except ValueError:
            pass
    try:
        return int(s)
    except ValueError:
        return None


def _scrape_sold_listings(slug: str) -> list[dict]:
    """
    Scrape sold listings from allhomes.com.au/sold/{slug}/.
    Parses the rendered HTML using discovered CSS class patterns.

    Successfully extracts: address, price, beds, baths, cars, property type.
    """
    url = f"https://www.allhomes.com.au/sold/{slug}/"
    try:
        r = httpx.get(url, headers=HEADERS, timeout=15)
        r.raise_for_status()
    except Exception:
        return []

    html = r.text
    listings = []

    # ── Discovery: allhomes uses dynamic CSS hash class names, not data-testid ──
    # Each listing card has: id="allhomes-search-listing-card-listing-details-{numeric_id}"
    # Price appears in class="css-120mxi4" (e.g. $217,000)
    # Beds/Baths/Cars appear as css-rhetjd spans after Bedrooms/Bathrooms/CarSpaces SVG icons
    # Address: itemProp="streetAddress" within h2 itemProp="address"
    #   + itemProp="addressLocality/addressRegion/postalCode"

    listing_ids = re.findall(
        r'id="allhomes-search-listing-card-listing-details-(\d+)"',
        html
    )

    for lid in listing_ids:
        id_str = f'id="allhomes-search-listing-card-listing-details-{lid}"'
        start = html.find(id_str)
        if start < 0:
            continue

        # Find end of this block (start of next listing or end of page)
        end = html.find('id="allhomes-search-listing-card-listing-details-', start + 10)
        block = html[start:end if end > 0 else start + 15000]

        # ── Address ──────────────────────────────────────────────────────────
        sa = re.search(r'itemProp="streetAddress"[^>]*>([^<]+)</span>', block)
        street = sa.group(1).strip() if sa else ''

        loc = re.findall(
            r'itemProp="(addressLocality|addressRegion|postalCode)"[^>]*>([^<]+)</span>',
            block
        )
        loc_dict = {k: v for k, v in loc}
        suburb = loc_dict.get('addressLocality', '').strip()
        state = loc_dict.get('addressRegion', '').strip()
        postcode = loc_dict.get('postalCode', '').strip()
        full_address = f"{street}, {suburb} {state} {postcode}".strip(', ')

        # ── Price ────────────────────────────────────────────────────────────
        price_m = re.search(r'\$(\d{3}(?:,\d{3})+|\d{6}(?!\d))', block)
        price_str = price_m.group(0) if price_m else None
        price = _parse_price(price_str)

        # ── Beds / Baths / Cars ──────────────────────────────────────────────
        rhetjd_nums = re.findall(r'class="css-rhetjd">(\d+)</span>', block)
        beds = int(rhetjd_nums[0]) if len(rhetjd_nums) > 0 else None
        baths = int(rhetjd_nums[1]) if len(rhetjd_nums) > 1 else None
        cars = int(rhetjd_nums[2]) if len(rhetjd_nums) > 2 else None

        # ── Property Type ───────────────────────────────────────────────────
        name_m = re.search(r'itemProp="name" content="([^"]+)"', block)
        prop_type = name_m.group(1) if name_m else None

        # ── Sold date (may be empty for some listings) ───────────────────────
        date_m = re.search(
            r'(?:sold| Sold )[^<]{0,30}(\d{1,2}\s+\w+\s+\d{4})',
            block
        )
        sold_date = date_m.group(1) if date_m else None

        if full_address or price:
            listings.append({
                'address': full_address,
                'price': price,
                'priceStr': price_str,
                'beds': beds,
                'baths': baths,
                'cars': cars,
                'soldDate': sold_date,
                'propertyType': prop_type,
            })

    return listings


# ─── /api/health ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "aussie-property-api"}


@app.get("/api/debug/scrape")
def debug_scrape(slug: str = Query(...)):
    """Debug: return raw HTML length and listing IDs found from allhomes."""
    url = f"https://www.allhomes.com.au/sold/{slug}/"
    try:
        r = httpx.get(url, headers=HEADERS, timeout=15)
        html = r.text
        listing_ids = re.findall(
            r'id="allhomes-search-listing-card-listing-details-(\d+)"',
            html
        )
        prices_found = re.findall(r'\$(\d{3}(?:,\d{3})+)', html[:500000])
        return {
            "url": url,
            "status_code": r.status_code,
            "html_length": len(html),
            "listing_ids_found": len(listing_ids),
            "price_count_in_first_500k": len(prices_found),
            "first_price": prices_found[0] if prices_found else None,
        }
    except Exception as e:
        return {"url": url, "error": str(e)}


# ─── /api/autosuggest ─────────────────────────────────────────────────────────

@app.get("/api/autosuggest")
def autosuggest(q: str = Query(..., min_length=2)):
    """
    Address autosuggest via Nominatim (OpenStreetMap).
    Returns: {suggestions: [{label, lat, lon, type}]}
    """
    suggestions = []
    try:
        r = httpx.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": q,
                "format": "json",
                "addressdetails": 1,
                "limit": 6,
                "countrycodes": "au",
            },
            headers=USER_AGENT,
            timeout=8,
        )
        r.raise_for_status()
    except Exception:
        return {"suggestions": []}

    for item in r.json():
        addr = item.get("address", {})
        atype = item.get("type", "place")

        label_parts = []
        if addr.get("house_number") and addr.get("road"):
            label_parts.append(f"{addr['house_number']} {addr['road']}")
        elif addr.get("neighbourhood"):
            label_parts.append(addr["neighbourhood"])
        elif addr.get("suburb"):
            label_parts.append(addr["suburb"])
        if addr.get("suburb") and addr.get("house_number"):
            pass  # already included
        elif addr.get("suburb"):
            label_parts.append(addr["suburb"])
        elif addr.get("city"):
            label_parts.append(addr["city"])
        elif addr.get("town"):
            label_parts.append(addr["town"])
        if addr.get("state"):
            label_parts.append(_state_name_to_abbr(addr["state"]))
        if addr.get("postcode"):
            label_parts.append(addr["postcode"])

        label = ", ".join(label_parts) if label_parts else item.get("display_name", "")[:100]

        if "australia" in item.get("display_name", "").lower():
            suggestions.append({
                "label": label,
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "type": atype,
            })

    return {"suggestions": suggestions}


# ─── /api/property ────────────────────────────────────────────────────────────

@app.get("/api/property")
def get_property(address: str = Query(...)):
    """
    Fetch sold history for a property address.
    Address format: '5 Smith St, Carlton VIC 3053' (minimum: 'Carlton VIC 3053')

    Returns: {
      source, address, slug, propertyType, beds, baths, cars, landArea,
      currentPrice, soldPrices (list), estimatedRange {min,max}, totalSold, searchUrl
    }
    """
    slug = _slug_from_address(address)
    sold_prices = []
    estimated_range = None

    if slug:
        raw_listings = _scrape_sold_listings(slug)

        for item in raw_listings:
            price = item.get('price')
            date = item.get('soldDate', '')[:10] if item.get('soldDate') else ''

            sold_prices.append({
                'price': price,
                'date': date,
                'address': item.get('address', ''),
                'beds': item.get('beds'),
                'baths': item.get('baths'),
                'cars': item.get('cars'),
                'propertyType': item.get('propertyType'),
            })

        # Compute estimated price range from valid sold prices
        valid_prices = [p["price"] for p in sold_prices if p["price"] and p["price"] > 50000]
        if len(valid_prices) >= 2:
            estimated_range = {
                "min": min(valid_prices),
                "max": max(valid_prices),
            }

    current = sold_prices[0] if sold_prices else {}

    return {
        "source": "allhomes",
        "address": address,
        "slug": slug,
        "propertyType": current.get("propertyType"),
        "beds": current.get("beds"),
        "baths": current.get("baths"),
        "cars": current.get("cars"),
        "landArea": current.get("landArea"),
        "currentPrice": current.get("price"),
        "soldPrices": [p for p in sold_prices[:20] if p["price"]],
        "estimatedRange": estimated_range,
        "totalSold": len(sold_prices),
        "searchUrl": f"https://www.allhomes.com.au/sold/{slug}/" if slug else "",
    }