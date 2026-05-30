from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Aussie Property API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "aussie-property-api"}

@app.get("/api/property")
def get_property(address: str):
    """Property listing + sold data from allhomes.com.au"""
    import httpx, bs4, re

    def _scrape(url: str) -> dict:
        try:
            r = httpx.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=10)
            soup = bs4.BeautifulSoup(r.text, "lxml")
            # Extract key property details from allhomes HTML
            # (placeholder — returns mock until full scraper is wired up)
            return {}
        except Exception:
            return {}

    search_url = f"https://www.allhomes.com.au/buy/search?query={address}"
    allhomes_data = _scrape(search_url)

    return {
        "source": "allhomes",
        "address": address,
        "beds": None,
        "baths": None,
        "cars": None,
        "landArea": None,
        "yearBuilt": None,
        "currentPrice": None,
        "soldPrices": [],
        "estimatedRange": None,
        "suburbStats": None,
        "searchUrl": search_url,
    }

@app.get("/api/suburb/{suburb}/{state}/{postcode}")
def get_suburb(suburb: str, state: str, postcode: str):
    return {
        "suburb": suburb,
        "state": state,
        "postcode": postcode,
        "medianPrice": None,
        "medianChange": None,
        "volume6m": 0,
        "rentalYield": None,
        "vacancyRate": None,
    }