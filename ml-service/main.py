from fastapi import FastAPI
from pydantic import BaseModel
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv("../.env.local")

app = FastAPI()
DB_URL = os.getenv("DATABASE_URL")

class PredictRequest(BaseModel):
    lat: float
    lng: float

SEVERITY_WEIGHTS = {"LOW": 1, "MEDIUM": 2, "HIGH": 4, "CRITICAL": 6}
NIGHT_MULTIPLIER = 1.4
RADIUS_DEG = 0.003  # ~300m

def get_features(lat: float, lng: float):
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
    crime_density = total_cases / (3.14 * 0.3 ** 2)  # crimes per sq km approx
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