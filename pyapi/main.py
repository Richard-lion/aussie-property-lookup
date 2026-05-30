from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Aussie Property API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/property")
def get_property(address: str):
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
    }

@app.get("/api/suburb/{suburb}/{state}/{postcode}")
def get_suburb(suburb: str, state: str, postcode: str):
    return {
        "medianPrice": None,
        "medianChange": None,
        "volume6m": 0,
        "rentalYield": None,
        "vacancyRate": None,
    }

from api import router as api_router
app.include_router(api_router, prefix="/api/v1")