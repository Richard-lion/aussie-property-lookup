from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import urllib.request, urllib.error, urllib.parse, re, json

app = FastAPI(title="Aussie Property API", version="1.4.0")

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
    "Upgrade-Insecure-Requests": "1",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
}

USER_AGENT = {"User-Agent": "AussiePropertyLookup/1.0"}

GRAPHQL_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Referer": "https://www.allhomes.com.au/sold/carlton-vic-3053/",
    "Origin": "https://www.allhomes.com.au",
}


# ─── helpers ───────────────────────────────────────────────────────────────────

def _make_request(url: str, headers: dict = None, timeout: int = 15) -> str | None:
    """Make HTTP request using stdlib urllib, return text or None on failure."""
    h = headers or HEADERS
    try:
        req = urllib.request.Request(url, headers=h)
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read()
            # Handle gzip/deflate
            encoding = r.headers.get('Content-Encoding', '')
            if encoding in ('gzip', 'deflate'):
                import gzip, zlib
                try:
                    raw = gzip.decompress(raw)
                except:
                    try:
                        raw = zlib.decompress(raw)
                    except:
                        raw = r.read()
            return raw.decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return None
    except Exception:
        return None


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


def _scrape_allhomes_html(slug: str) -> list[dict]:
    """Scrape sold listings from allhomes.com.au/sold/{slug}/ HTML."""
    url = f"https://www.allhomes.com.au/sold/{slug}/"
    html = _make_request(url)
    if not html:
        return []

    listings = []
    # Discovery: allhomes uses id="allhomes-search-listing-card-listing-details-{numeric_id}"
    listing_ids = re.findall(
        r'id="allhomes-search-listing-card-listing-details-(\d+)"',
        html
    )

    for lid in listing_ids:
        id_str = f'id="allhomes-search-listing-card-listing-details-{lid}"'
        start = html.find(id_str)
        if start < 0:
            continue

        # Find end of this block
        end = html.find('id="allhomes-search-listing-card-listing-details-', start + 10)
        block = html[start:end if end > 0 else start + 15000]

        # Address
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

        # Price
        price_m = re.search(r'\$(\d{3}(?:,\d{3})+|\d{6}(?!\d))', block)
        price_str = price_m.group(0) if price_m else None
        price = _parse_price(price_str)

        # Beds / Baths / Cars
        rhetjd_nums = re.findall(r'class="css-rhetjd">(\d+)</span>', block)
        beds = int(rhetjd_nums[0]) if len(rhetjd_nums) > 0 else None
        baths = int(rhetjd_nums[1]) if len(rhetjd_nums) > 1 else None
        cars = int(rhetjd_nums[2]) if len(rhetjd_nums) > 2 else None

        # Property Type
        name_m = re.search(r'itemProp="name" content="([^"]+)"', block)
        prop_type = name_m.group(1) if name_m else None

        # Sold date
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


def _fetch_allhomes_graphql(slug: str) -> list[dict]:
    """Try allhomes GraphQL API."""
    query = {
        "operationName": "updateHistoryForLocality",
        "extensions": {
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "d16064a1e14de8b8192be6bece8e2bb0dec81e1d46d0736461fd8c9484211996"
            }
        },
        "variables": {
            "localities": [{"slug": slug, "state": "VIC", "suburb": "Carlton", "postCode": "3053"}],
            "duration": " sold",
            "page": 1,
            "pageSize": 20,
            "sort": " dateDesc"
        }
    }

    # Try without persisted query
    query2 = {
        "query": """query updateHistoryForLocality($localities:[LocalityInput!]!,$filters:HistoryFilterInput,$duration:HistoryDurationEnum,$sort:HistorySortInput,$page:Int!,$pageSize:Int!){updateHistoryForLocality(localities:$localities,filters:$filters,duration:$duration,sort:$sort,page:$page,pageSize:$pageSize){results{listings{listingId price displayPrice beds baths cars parking area newDevelopment sourceUrl}pagination{page pageSize total totalPages}}}}""",
        "variables": {
            "localities": [{"slug": slug, "state": "VIC", "suburb": "Carlton", "postCode": "3053"}],
            "duration": "SOLD",
            "page": 1,
            "pageSize": 20,
            "sort": {"field": "date", "direction": "DESC"}
        },
        "operationName": "updateHistoryForLocality"
    }

    for q in [query, query2]:
        try:
            data = json.dumps(q).encode()
            req = urllib.request.Request(
                "https://www.allhomes.com.au/graphql",
                data=data,
                headers=GRAPHQL_HEADERS
            )
            with urllib.request.urlopen(req, timeout=10) as r:
                resp = json.loads(r.read())
                if "errors" not in resp or resp["errors"][0].get("extensions", {}).get("code") != "PersistedQueryNotFound":
                    # Check for valid data
                    listings_data = resp.get("data", {}).get("updateHistoryForLocality", {}).get("results", {}).get("listings", [])
                    if listings_data:
                        return [{
                            "address": f"{l.get('displayAddress', l.get('sourceUrl', ''))}",
                            "price": l.get("price"),
                            "priceStr": l.get("displayPrice"),
                            "beds": l.get("beds"),
                            "baths": l.get("baths"),
                            "cars": l.get("cars"),
                            "propertyType": l.get("propertyType"),
                            "listingId": l.get("listingId"),
                        } for l in listings_data]
        except Exception:
            pass

    return []


# ─── /api/health ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "aussie-property-api"}


@app.get("/api/debug/scrape")
def debug_scrape(slug: str = Query(...)):
    """Debug: return raw HTML length and listing IDs found from allhomes."""
    url = f"https://www.allhomes.com.au/sold/{slug}/"
    html = _make_request(url)
    if not html:
        return {"url": url, "error": "request_failed"}
    listing_ids = re.findall(
        r'id="allhomes-search-listing-card-listing-details-(\d+)"',
        html
    )
    prices_found = re.findall(r'\$(\d{3}(?:,\d{3})+)', html[:500000])
    return {
        "url": url,
        "html_length": len(html),
        "listing_ids_found": len(listing_ids),
        "price_count": len(prices_found),
        "first_price": prices_found[0] if prices_found else None,
        "first_200": html[:200],
    }


# ─── /api/autosuggest ──────────────────────────────────────────────────────────

@app.get("/api/autosuggest")
def autosuggest(q: str = Query(..., min_length=2)):
    """Address autosuggest via Nominatim (OpenStreetMap)."""
    suggestions = []
    try:
        url = f"https://nominatim.openstreetmap.org/search?q={urllib.parse.quote(q)}&format=json&addressdetails=1&limit=6&countrycodes=au"
        req = urllib.request.Request(url, headers=USER_AGENT)
        with urllib.request.urlopen(req, timeout=8) as r:
            results = json.loads(r.read())
    except Exception:
        return {"suggestions": []}

    for item in results:
        addr = item.get("address", {})
        atype = item.get("type", "place")

        label_parts = []
        if addr.get("house_number") and addr.get("road"):
            label_parts.append(f"{addr['house_number']} {addr['road']}")
        elif addr.get("neighbourhood"):
            label_parts.append(addr["neighbourhood"])
        elif addr.get("suburb"):
            label_parts.append(addr["suburb"])
        if addr.get("suburb"):
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


# ─── /api/property ─────────────────────────────────────────────────────────────

@app.get("/api/property")
def get_property(address: str = Query(...)):
    """
    Fetch sold history for a property address.
    Tries: (1) allhomes GraphQL, (2) allhomes HTML parse.
    """
    slug = _slug_from_address(address)
    sold_prices = []
    source = "none"

    if slug:
        # Try GraphQL first (fast, structured data)
        raw = _fetch_allhomes_graphql(slug)
        if raw:
            sold_prices = raw
            source = "allhomes_graphql"
        else:
            # Fallback to HTML scrape
            raw = _scrape_allhomes_html(slug)
            if raw:
                sold_prices = raw
                source = "allhomes_html"

    # Build soldPrices list
    sold_list = []
    for item in sold_prices:
        price = item.get("price")
        date_str = ""
        if item.get("soldDate"):
            date_str = item.get("soldDate", "")[:10]

        sold_list.append({
            "price": price,
            "date": date_str,
            "address": item.get("address", ""),
            "beds": item.get("beds"),
            "baths": item.get("baths"),
            "cars": item.get("cars"),
            "propertyType": item.get("propertyType"),
        })

    # Compute estimated price range
    estimated_range = None
    valid_prices = [p["price"] for p in sold_list if p["price"] and p["price"] > 50000]
    if len(valid_prices) >= 2:
        estimated_range = {"min": min(valid_prices), "max": max(valid_prices)}

    current = sold_list[0] if sold_list else {}

    return {
        "source": source,
        "address": address,
        "slug": slug,
        "propertyType": current.get("propertyType"),
        "beds": current.get("beds"),
        "baths": current.get("baths"),
        "cars": current.get("cars"),
        "landArea": current.get("landArea"),
        "currentPrice": current.get("price"),
        "soldPrices": [p for p in sold_list[:20] if p["price"]],
        "estimatedRange": estimated_range,
        "totalSold": len(sold_list),
        "searchUrl": f"https://www.allhomes.com.au/sold/{slug}/" if slug else "",
    }