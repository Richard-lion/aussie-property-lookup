from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
import httpx, re

app = FastAPI(title="Aussie Property API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "application/json",
}

USER_AGENT = {"User-Agent": "AussiePropertyLookup/1.0"}


# ─── helpers ───────────────────────────────────────────────────────────────────

def _slug_from_address(address: str) -> str | None:
    """
    Extract 'suburb-state-postcode' slug from an address string.
    E.g. '5 Smith St, Carlton VIC 3053' -> 'carlton-vic-3053'
    """
    m = re.search(
        r"(\w+)\s+(VIC|NSW|QLD|SA|WA|TAS|ACT)\s+(\d{4})",
        address, re.IGNORECASE
    )
    if m:
        return f"{m.group(1).lower()}-{m.group(2).lower()}-{m.group(3)}"
    return None


def _state_name_to_abbr(state: str) -> str:
    mapping = {
        "victoria": "VIC", "new south wales": "NSW", "queensland": "QLD",
        "south australia": "SA", "western australia": "WA",
        "tasmania": "TAS", "australian capital territory": "ACT",
    }
    return mapping.get(state.lower(), state.upper())


def _fetch_allhomes_history(slug: str, page: int = 1, page_size: int = 20) -> dict:
    """Query allhomes GraphQL for sold history of a locality."""
    import json as _json, urllib.parse as _urllib
    try:
        variables = _json.dumps({
            "locality": {"slug": slug, "type": "DIVISION"},
            "filters": {"beds": {"lower": 0}, "baths": {"lower": 0}, "parks": {"lower": 0}},
            "duration": {"unit": "ALL"},
            "sort": {"type": "SOLD_AGE", "order": "DESC"},
            "page": page,
            "pageSize": page_size,
        })
        extensions = _json.dumps({
            "persistedQuery": {
                "version": 1,
                "sha256Hash": "d16064a1e14de8b8192be6bece8e2bb0dec81e1d46d0736461fd8c9484211996",
            }
        })
        # Build URL with manually-encoded JSON strings (no double-encoding)
        query = _urllib.urlencode({
            "operationName": "updateHistoryForLocality",
            "variables": variables,
            "extensions": extensions,
        })
        r = httpx.get(
            f"https://www.allhomes.com.au/graphql?{query}",
            headers={
                **HEADERS,
                "x-apollo-operation-name": "updateHistoryForLocality",
            },
            timeout=15,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return {}


# ─── /api/health ──────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "aussie-property-api"}


# ─── /api/autosuggest ─────────────────────────────────────────────────────────

@app.get("/api/autosuggest")
def autosuggest(q: str = Query(..., min_length=2)):
    """
    Address autosuggest via Nominatim (OpenStreetMap).
    Falls back to postcode/locality level when street-level not found.
    Returns: {suggestions: [{label, lat, lon, type}]}
    type values: "address" | "suburb" | "postcode" | "city"
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

        # Build clean label from address components
        label_parts = []
        # House number + road
        if addr.get("house_number") and addr.get("road"):
            label_parts.append(f"{addr['house_number']} {addr['road']}")
        elif addr.get("neighbourhood") or addr.get("suburb"):
            label_parts.append(addr.get("neighbourhood") or addr.get("suburb"))
        # Locality / city
        if addr.get("suburb"):
            label_parts.append(addr["suburb"])
        elif addr.get("city"):
            label_parts.append(addr["city"])
        elif addr.get("town"):
            label_parts.append(addr["town"])
        elif addr.get("locality"):
            label_parts.append(addr["locality"])
        # State abbreviation
        if addr.get("state"):
            label_parts.append(_state_name_to_abbr(addr["state"]))
        # Postcode
        if addr.get("postcode"):
            label_parts.append(addr["postcode"])

        label = ", ".join(label_parts) if label_parts else item.get("display_name", "")[:100]

        # Only include Australian results
        if item.get("display_name", "").endswith(", Australia") or "australia" in item.get("display_name", "").lower():
            suggestions.append({
                "label": label,
                "lat": float(item["lat"]),
                "lon": float(item["lon"]),
                "type": atype,
            })

    return {"suggestions": suggestions}


# ─── /api/property ────────────────────────────────────────────────────────────

@app.get("/api/debug/allhomes")
def debug_allhomes(slug: str = Query(default="carlton-vic-3053")):
    """Debug endpoint: test allhomes GraphQL directly from Render."""
    import json as _json, urllib.parse as _urllib
    variables = _json.dumps({
        "locality": {"slug": slug, "type": "DIVISION"},
        "filters": {"beds": {"lower": 0}, "baths": {"lower": 0}, "parks": {"lower": 0}},
        "duration": {"unit": "ALL"},
        "sort": {"type": "SOLD_AGE", "order": "DESC"},
        "page": 1, "pageSize": 5,
    })
    extensions = _json.dumps({
        "persistedQuery": {
            "version": 1,
            "sha256Hash": "d16064a1e14de8b8192be6bece8e2bb0dec81e1d46d0736461fd8c9484211996",
        }
    })
    query = _urllib.urlencode({
        "operationName": "updateHistoryForLocality",
        "variables": variables,
        "extensions": extensions,
    })
    try:
        r = httpx.get(
            f"https://www.allhomes.com.au/graphql?{query}",
            headers={
                **HEADERS,
                "x-apollo-operation-name": "updateHistoryForLocality",
            },
            timeout=15,
        )
        return {
            "status_code": r.status_code,
            "text": r.text[:500],
        }
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/property")
def get_property(address: str = Query(...)):
    """
    Fetch property details and recent sold history for an address.
    1. Extracts suburb/state/postcode slug from address.
    2. Queries allhomes GraphQL for sold history of that locality.
    3. Returns sold price records and estimated price range.

    Expected address format: '5 Smith St, Carlton VIC 3053'
    Minimum required: 'Carlton VIC 3053' (suburb + postcode)
    """
    slug = _slug_from_address(address)
    sold_prices = []
    estimated_range = None

    if slug:
        data = _fetch_allhomes_history(slug, page_size=30)
        nodes = (
            data.get("data", {})
            .get("historyForLocality", {})
            .get("nodes", [])
        )

        for node in nodes:
            transfer = node.get("transfer", {})
            features = node.get("features", {})
            listing = node.get("listing", {})

            line1 = node.get("address", {}).get("line1", "")
            price = transfer.get("price")
            date = node.get("date", "")[:10]
            beds = features.get("bedrooms")
            baths = features.get("bathrooms", {}).get("total")
            cars = features.get("parking", {}).get("total")
            prop_type = features.get("propertyType")
            land_area = transfer.get("blockSize")
            days_on_market = listing.get("daysOnMarket")

            sold_prices.append({
                "price": price,
                "date": date,
                "address": line1,
                "url": listing.get("url", ""),
                "beds": beds,
                "baths": baths,
                "cars": cars,
                "propertyType": prop_type,
                "landArea": land_area,
                "daysOnMarket": days_on_market,
            })

        # Compute estimated range from valid sold prices
        valid_prices = [p["price"] for p in sold_prices if p["price"] and p["price"] > 50000]
        if len(valid_prices) >= 2:
            estimated_range = {
                "min": min(valid_prices),
                "max": max(valid_prices),
            }

    # Use most recent sold record as representative "current" data
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
        "soldPrices": [
            {k: v for k, v in p.items() if k != "url"}
            for p in sold_prices[:20]
            if p["price"]
        ],
        "estimatedRange": estimated_range,
        "totalSold": len(sold_prices),
        "searchUrl": f"https://www.allhomes.com.au/buy/search?query={address}",
    }
