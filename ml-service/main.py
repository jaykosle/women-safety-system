# ml-service/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg2
import os
import csv
import math
from dotenv import load_dotenv

load_dotenv("../.env")
load_dotenv("../.env.local")  # fallback

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_URL = os.getenv("DATABASE_URL")

# ── Load CSV data at startup ──────────────────────────────────────────────────
CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "crimes_against_women.csv")

CRIME_COLUMN_MAP = {
    "rape": "Rape",
    "kidnapping": "Kidnapping and Abduction",
    "dowry_death": "Dowry Deaths",
    "assault_women": "Assault on women with intent to outrage her modesty",
    "insult_modesty": "Insult to modesty of Women",
    "cruelty_husband": "Cruelty by Husband or his Relatives",
    "importation_girls": "Importation of Girls",
}

SEVERITY_MAP = {
    "rape": 10,
    "kidnapping": 8,
    "dowry_death": 9,
    "assault_women": 7,
    "insult_modesty": 5,
    "cruelty_husband": 8,
    "importation_girls": 9,
}

def load_csv():
    rows = []
    try:
        with open(CSV_PATH, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                rows.append(row)
    except Exception as e:
        print(f"CSV load error: {e}")
    return rows

CSV_DATA = load_csv()
print(f"Loaded {len(CSV_DATA)} CSV rows")

# ── Existing risk prediction endpoint ────────────────────────────────────────
class PredictRequest(BaseModel):
    lat: float
    lng: float

SEVERITY_WEIGHTS = {"LOW": 1, "MEDIUM": 2, "HIGH": 4, "CRITICAL": 6}
NIGHT_MULTIPLIER = 1.4
RADIUS_DEG = 0.003

def get_features(lat, lng):
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    cur.execute("""
        SELECT severity, "timeOfDay", "caseCount"
        FROM crime_records
        WHERE latitude BETWEEN %s AND %s
          AND longitude BETWEEN %s AND %s
    """, (lat - RADIUS_DEG, lat + RADIUS_DEG, lng - RADIUS_DEG, lng + RADIUS_DEG))
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows

@app.post("/predict-risk")
def predict_risk(req: PredictRequest):
    rows = get_features(req.lat, req.lng)
    if not rows:
        return {"risk_score": 10.0, "risk_level": "SAFE", "crime_density": 0.0, "night_crime_rate": 0.0}

    total_weight = 0
    night_count = 0
    for severity, time_of_day, case_count in rows:
        w = SEVERITY_WEIGHTS.get(severity, 1) * case_count
        if time_of_day in ("NIGHT", "EVENING"):
            w *= NIGHT_MULTIPLIER
            night_count += case_count
        total_weight += w

    total_cases = sum(r[2] for r in rows)
    night_crime_rate = night_count / total_cases if total_cases else 0
    crime_density = total_cases / (3.14 * 0.3 ** 2)
    risk_score = min(100, total_weight * 2)

    if risk_score < 30:   level = "SAFE"
    elif risk_score < 60: level = "MODERATE"
    elif risk_score < 80: level = "HIGH"
    else:                 level = "CRITICAL"

    return {
        "risk_score": round(risk_score, 2),
        "risk_level": level,
        "crime_density": round(crime_density, 4),
        "night_crime_rate": round(night_crime_rate, 4)
    }

# ── Analytics endpoints ───────────────────────────────────────────────────────

class StateStatsRequest(BaseModel):
    state: str
    district: Optional[str] = None

@app.post("/api/state-stats")
def state_stats(req: StateStatsRequest):
    state = req.state.upper().strip()
    district = req.district.upper().strip() if req.district else None

    filtered = [
        r for r in CSV_DATA
        if r["STATE/UT"].upper().strip() == state
        and (district is None or r["DISTRICT"].upper().strip() == district)
    ]

    if not filtered:
        return {"error": f"No data found for state: {state}"}

    years_covered = sorted(set(int(r["Year"]) for r in filtered))
    crimes: dict = {}

    for key, col in CRIME_COLUMN_MAP.items():
        yearly: dict = {}
        for r in filtered:
            yr = int(r["Year"])
            val = int(r.get(col, 0) or 0)
            yearly[yr] = yearly.get(yr, 0) + val

        total = sum(yearly.values())
        avg = total / len(yearly) if yearly else 0

        crimes[key] = {
            "total": total,
            "yearly": yearly,
            "severity": SEVERITY_MAP.get(key, 5),
            "avg_per_year": round(avg, 1),
        }

    return {
        "state": state,
        "district": district,
        "years_covered": years_covered,
        "crimes": crimes,
        "total_records": len(filtered),
    }

class TrendsRequest(BaseModel):
    state: str
    district: Optional[str] = None

@app.post("/api/trends")
def trends(req: TrendsRequest):
    state = req.state.upper().strip()
    district = req.district.upper().strip() if req.district else None

    filtered = [
        r for r in CSV_DATA
        if r["STATE/UT"].upper().strip() == state
        and (district is None or r["DISTRICT"].upper().strip() == district)
    ]

    if not filtered:
        return {"error": f"No data found for state: {state}"}

    yearly_totals: dict = {}
    for r in filtered:
        yr = int(r["Year"])
        total = sum(int(r.get(col, 0) or 0) for col in CRIME_COLUMN_MAP.values())
        yearly_totals[yr] = yearly_totals.get(yr, 0) + total

    years = sorted(yearly_totals.keys())
    values = [yearly_totals[y] for y in years]

    trend = "increasing"
    if len(values) >= 2:
        trend = "increasing" if values[-1] > values[0] else "decreasing"

    return {
        "state": state,
        "years": years,
        "total_crimes": values,
        "trend": trend,
    }

class ForecastRequest(BaseModel):
    state: str
    district: Optional[str] = None
    crime_type: str = "rape"
    years_ahead: int = 3

@app.post("/api/forecast")
def forecast(req: ForecastRequest):
    state = req.state.upper().strip()
    crime_type = req.crime_type
    col = CRIME_COLUMN_MAP.get(crime_type)

    if not col:
        return {"error": f"Unknown crime type: {crime_type}"}

    filtered = [
        r for r in CSV_DATA
        if r["STATE/UT"].upper().strip() == state
    ]

    if not filtered:
        return {"error": f"No data found for state: {state}"}

    yearly: dict = {}
    for r in filtered:
        yr = int(r["Year"])
        val = int(r.get(col, 0) or 0)
        yearly[yr] = yearly.get(yr, 0) + val

    years = sorted(yearly.keys())
    values = [yearly[y] for y in years]

    if len(years) < 2:
        return {"error": "Not enough data for forecast"}

    # Simple linear regression
    n = len(years)
    mean_x = sum(years) / n
    mean_y = sum(values) / n
    num = sum((years[i] - mean_x) * (values[i] - mean_y) for i in range(n))
    den = sum((years[i] - mean_x) ** 2 for i in range(n))
    slope = num / den if den != 0 else 0
    intercept = mean_y - slope * mean_x

    last_year = years[-1]
    forecast_years = list(range(last_year + 1, last_year + 1 + req.years_ahead))
    forecast_values = [max(0, round(slope * y + intercept)) for y in forecast_years]

    # Simple R2
    ss_res = sum((values[i] - (slope * years[i] + intercept)) ** 2 for i in range(n))
    ss_tot = sum((v - mean_y) ** 2 for v in values)
    r2 = 1 - ss_res / ss_tot if ss_tot != 0 else 0

    mae = sum(abs(values[i] - (slope * years[i] + intercept)) for i in range(n)) / n

    pct_change = ((forecast_values[-1] - values[-1]) / values[-1] * 100) if values[-1] != 0 else 0

    return {
        "state": state,
        "crime_type": crime_type,
        "historical": {"years": years, "values": values},
        "forecast": {"years": forecast_years, "values": forecast_values},
        "metrics": {
            "mean_absolute_error": round(mae, 1),
            "r2_score": round(r2, 3),
            "trend_direction": "increasing" if slope > 0 else "decreasing",
            "trend_magnitude_percent": round(abs(pct_change), 1),
            "confidence": "high" if r2 > 0.7 else "medium" if r2 > 0.4 else "low",
        }
    }

class HotspotsRequest(BaseModel):
    state: Optional[str] = None
    limit: int = 10

@app.post("/api/hotspots")
def hotspots(req: HotspotsRequest):
    state = req.state.upper().strip() if req.state else None

    filtered = [
        r for r in CSV_DATA
        if state is None or r["STATE/UT"].upper().strip() == state
    ]

    district_data: dict = {}
    for r in filtered:
        key = (r["STATE/UT"].upper().strip(), r["DISTRICT"].upper().strip())
        if key not in district_data:
            district_data[key] = {"total": 0, "breakdown": {}}
        for crime_key, col in CRIME_COLUMN_MAP.items():
            val = int(r.get(col, 0) or 0)
            district_data[key]["total"] += val
            district_data[key]["breakdown"][crime_key] = district_data[key]["breakdown"].get(crime_key, 0) + val

    hotspot_list = []
    for (st, dist), data in district_data.items():
        severity_score = sum(
            data["breakdown"].get(k, 0) * SEVERITY_MAP.get(k, 5)
            for k in CRIME_COLUMN_MAP
        )
        hotspot_list.append({
            "state": st,
            "district": dist,
            "total_crimes": data["total"],
            "severity_score": round(severity_score, 1),
            "crime_breakdown": data["breakdown"],
        })

    hotspot_list.sort(key=lambda x: x["severity_score"], reverse=True)
    return hotspot_list[:req.limit]