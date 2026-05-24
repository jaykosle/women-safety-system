# ml-service/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import psycopg2
import os
import csv
import json
import math
from pathlib import Path
import numpy as np
import pandas as pd
import xgboost as xgb
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

# ── XGBoost risk prediction model ────────────────────────────────────────────
# Trained by ml-service/train_risk_model.py. See TRAINING.md for retraining.

MODEL_DIR = Path(__file__).resolve().parent

class _ModelBundle:
    """Loads trained XGBoost regressor + classifier + district lookups once."""
    def __init__(self) -> None:
        self.ready = False
        meta_path = MODEL_DIR / "risk_model_meta.json"
        if not meta_path.exists():
            print("[predict-risk] No trained model found; falling back to heuristic.")
            return
        try:
            with open(meta_path) as f:
                self.meta = json.load(f)
            self.feature_cols = self.meta["feature_cols"]
            self.int_to_level = {int(k): v for k, v in self.meta["int_to_level"].items()}

            self.reg = xgb.XGBRegressor()
            self.reg.load_model(str(MODEL_DIR / "risk_model.json"))

            self.clf = xgb.XGBClassifier()
            self.clf.load_model(str(MODEL_DIR / "risk_classifier.json"))

            self.centroids = pd.read_csv(MODEL_DIR / "district_centroids.csv")
            self.ncrb = pd.read_csv(MODEL_DIR / "district_ncrb.csv").set_index(
                ["state_u", "district_u"]
            )
            self._cent_lat = self.centroids["lat"].to_numpy()
            self._cent_lng = self.centroids["lng"].to_numpy()
            self.ready = True
            print(f"[predict-risk] Loaded XGBoost model "
                  f"(MAE={self.meta['metrics']['regressor_mae']}, "
                  f"R2={self.meta['metrics']['regressor_r2']})")
        except Exception as e:
            print(f"[predict-risk] Model load failed: {e}; falling back to heuristic.")

    def nearest_district(self, lat: float, lng: float):
        d2 = (self._cent_lat - lat) ** 2 + (self._cent_lng - lng) ** 2
        idx = int(np.argmin(d2))
        return self.centroids.iloc[idx]["state_u"], self.centroids.iloc[idx]["district_u"]

    def ncrb_features(self, state_u: str, district_u: str) -> dict:
        try:
            row = self.ncrb.loc[(state_u, district_u)]
            return row.to_dict()
        except KeyError:
            # Unknown district → zero out NCRB features
            return {c: 0.0 for c in self.ncrb.columns}

_MODEL = _ModelBundle()


class PredictRequest(BaseModel):
    lat: float
    lng: float

SEVERITY_WEIGHTS = {"LOW": 1, "MEDIUM": 2, "HIGH": 4, "CRITICAL": 6}
NIGHT_MULTIPLIER = 1.4
RADIUS_DEG = 0.003
RADIUS_KM_AREA = math.pi * 0.3 ** 2  # ~0.28 sq km (300m radius)

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


def _spatial_features(rows):
    """Compute (crime_density, crime_count, night_crime_rate) from nearby records."""
    if not rows:
        return 0.0, 0, 0.0
    total_cases = sum(r[2] for r in rows)
    night_cases = sum(r[2] for r in rows if r[1] in ("NIGHT", "EVENING"))
    crime_count = len(rows)
    crime_density = total_cases / RADIUS_KM_AREA
    night_rate = (night_cases / total_cases) if total_cases else 0.0
    return crime_density, crime_count, night_rate


def _heuristic_score(rows, crime_density, night_rate):
    """Original hand-tuned scorer — used as a fallback when the model can't load."""
    total_weight = 0
    for severity, time_of_day, case_count in rows:
        w = SEVERITY_WEIGHTS.get(severity, 1) * case_count
        if time_of_day in ("NIGHT", "EVENING"):
            w *= NIGHT_MULTIPLIER
        total_weight += w
    return min(100, total_weight * 2)


@app.post("/predict-risk")
def predict_risk(req: PredictRequest):
    rows = get_features(req.lat, req.lng)
    crime_density, crime_count, night_rate = _spatial_features(rows)

    # No nearby data → safe default (matches old behaviour)
    if not rows:
        return {
            "risk_score": 10.0, "risk_level": "SAFE",
            "crime_density": 0.0, "night_crime_rate": 0.0,
            "source": "no_data",
        }

    # XGBoost path (preferred)
    if _MODEL.ready:
        state_u, district_u = _MODEL.nearest_district(req.lat, req.lng)
        ncrb_feats = _MODEL.ncrb_features(state_u, district_u)
        row = {
            "latitude":       req.lat,
            "longitude":      req.lng,
            "year_filled":    2014,
            "crimeDensity":   crime_density,
            "crimeCount":     crime_count,
            "nightCrimeRate": night_rate,
            **ncrb_feats,
        }
        X = pd.DataFrame([[row[c] for c in _MODEL.feature_cols]],
                         columns=_MODEL.feature_cols).astype(np.float32)
        risk_score = float(np.clip(_MODEL.reg.predict(X)[0], 0, 100))
        cls_int = int(_MODEL.clf.predict(X)[0])
        risk_level = _MODEL.int_to_level[cls_int]
        return {
            "risk_score": round(risk_score, 2),
            "risk_level": risk_level,
            "crime_density": round(crime_density, 4),
            "night_crime_rate": round(night_rate, 4),
            "district": district_u.title(),
            "state": state_u.title(),
            "source": "xgboost",
        }

    # Fallback heuristic (only if model files missing)
    risk_score = _heuristic_score(rows, crime_density, night_rate)
    if   risk_score < 30: level = "SAFE"
    elif risk_score < 60: level = "MODERATE"
    elif risk_score < 80: level = "HIGH"
    else:                 level = "CRITICAL"
    return {
        "risk_score": round(risk_score, 2),
        "risk_level": level,
        "crime_density": round(crime_density, 4),
        "night_crime_rate": round(night_rate, 4),
        "source": "heuristic",
    }


@app.post("/predict-risk-detailed")
def predict_risk_detailed(req: PredictRequest):
    """Same as /predict-risk but also returns class probabilities and top feature
    contributions for the prediction. Useful for the analytics dashboard."""
    if not _MODEL.ready:
        return {"error": "Model not loaded; run train_risk_model.py first."}

    rows = get_features(req.lat, req.lng)
    if not rows:
        return {"risk_score": 10.0, "risk_level": "SAFE", "source": "no_data"}

    crime_density, crime_count, night_rate = _spatial_features(rows)
    state_u, district_u = _MODEL.nearest_district(req.lat, req.lng)
    ncrb_feats = _MODEL.ncrb_features(state_u, district_u)
    row = {
        "latitude":       req.lat,
        "longitude":      req.lng,
        "year_filled":    2014,
        "crimeDensity":   crime_density,
        "crimeCount":     crime_count,
        "nightCrimeRate": night_rate,
        **ncrb_feats,
    }
    X = pd.DataFrame([[row[c] for c in _MODEL.feature_cols]],
                     columns=_MODEL.feature_cols).astype(np.float32)
    risk_score = float(np.clip(_MODEL.reg.predict(X)[0], 0, 100))
    proba = _MODEL.clf.predict_proba(X)[0]
    cls_int = int(np.argmax(proba))

    # Per-prediction feature contributions via XGBoost's predict with output_margin
    booster = _MODEL.reg.get_booster()
    dmatrix = xgb.DMatrix(X, feature_names=_MODEL.feature_cols)
    shap = booster.predict(dmatrix, pred_contribs=True)[0]
    # last element is the bias; drop it
    contributions = sorted(
        [(name, float(v)) for name, v in zip(_MODEL.feature_cols, shap[:-1])],
        key=lambda kv: abs(kv[1]), reverse=True,
    )[:5]

    return {
        "risk_score": round(risk_score, 2),
        "risk_level": _MODEL.int_to_level[cls_int],
        "class_probabilities": {
            _MODEL.int_to_level[i]: round(float(p), 3) for i, p in enumerate(proba)
        },
        "top_factors": [
            {"feature": name, "contribution": round(v, 3)}
            for name, v in contributions
        ],
        "district": district_u.title(),
        "state": state_u.title(),
        "source": "xgboost",
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