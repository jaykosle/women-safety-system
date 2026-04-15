# scripts/ml_service.py
"""
FastAPI service for Crime Analytics
Run: uvicorn ml_service:app --reload --host 0.0.0.0 --port 8000

Environment variables:
- CSV_PATH: Path to crimes_against_women.csv
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import sys

# Add the Python module to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

from crime_analytics_ml import CrimeAnalyticsEngine

# Initialize FastAPI app
app = FastAPI(title="Crime Analytics ML Service", version="1.0.0")

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load data
csv_path = os.getenv('CSV_PATH', 'crimes_against_women.csv')
engine = CrimeAnalyticsEngine(csv_path)

# ─── Request/Response Models ──────────────────────────────────────────────────

class StateStatsRequest(BaseModel):
    state: str
    district: Optional[str] = None

class ForecastRequest(BaseModel):
    state: str
    district: Optional[str] = None
    crime_type: str = 'rape'
    years_ahead: int = 3

class HotspotsRequest(BaseModel):
    state: Optional[str] = None
    limit: int = 10

class DistrictsRequest(BaseModel):
    state: str
    district: Optional[str] = None

class CompareDistrictsRequest(BaseModel):
    state: str
    districts: List[str]

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.post("/api/state-stats")
async def get_state_stats(req: StateStatsRequest):
    """Get comprehensive crime statistics for a state or district"""
    try:
        result = engine.get_state_district_stats(req.state, req.district)
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/forecast")
async def forecast_trends(req: ForecastRequest):
    """Forecast future crime trends"""
    try:
        result = engine.forecast_crime_trends(
            req.state,
            req.district,
            req.crime_type,
            req.years_ahead
        )
        if 'error' in result:
            raise HTTPException(status_code=400, detail=result['error'])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/hotspots")
async def get_hotspots(req: HotspotsRequest):
    """Identify and return crime hotspots"""
    try:
        result = engine.get_hotspots(req.state, req.limit)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/trends")
async def get_temporal_trends(req: DistrictsRequest):
    """Get year-over-year temporal trends"""
    try:
        result = engine.get_temporal_trends(req.state, req.district)
        if 'error' in result:
            raise HTTPException(status_code=404, detail=result['error'])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/compare-districts")
async def compare_districts(req: CompareDistrictsRequest):
    """Compare crime statistics across districts"""
    try:
        result = engine.compare_districts(req.state, req.districts)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok",
        "service": "Crime Analytics ML Service",
        "csv_loaded": engine.df.shape[0] > 0
    }

if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000)