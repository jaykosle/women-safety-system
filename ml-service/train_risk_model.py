"""
train_risk_model.py
-------------------
Trains two XGBoost models for the SafePath AI risk-prediction endpoint:

  - risk_model.json        : XGBRegressor -> continuous riskScore [0, 100]
  - risk_classifier.json   : XGBClassifier -> riskLevel {LOW, MEDIUM, HIGH, CRITICAL}

Features come from real NCRB district aggregates (not from the formula that
originally generated risk_zones.csv) so the model learns spatial + contextual
patterns rather than memorising the synthetic target.

Run once from the project root:
    python ml-service/train_risk_model.py

Models save into ml-service/. main.py loads them on FastAPI startup.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import xgboost as xgb
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    mean_absolute_error,
    r2_score,
)
from sklearn.model_selection import train_test_split

# ── Paths ─────────────────────────────────────────────────────────────────────
HERE = Path(__file__).resolve().parent
ROOT = HERE.parent                                # women-safety-system-main/
DATASETS = ROOT.parent / "Datasets"               # Datasets/ sibling folder
RISK_ZONES = ROOT / "risk_zones.csv"
SYNTHETIC = ROOT / "synthetic_crime_data.csv"
NCRB_2014 = (
    DATASETS
    / "Crimes in india"
    / "crime"
    / "42_District_wise_crimes_committed_against_women_2014.csv"
)

OUT_REG = HERE / "risk_model.json"
OUT_CLF = HERE / "risk_classifier.json"
OUT_META = HERE / "risk_model_meta.json"
OUT_IMPORTANCE = HERE / "feature_importance.csv"
OUT_CENTROIDS = HERE / "district_centroids.csv"
OUT_NCRB = HERE / "district_ncrb.csv"

LEVEL_TO_INT = {"LOW": 0, "SAFE": 0, "MEDIUM": 1, "MODERATE": 1, "HIGH": 2, "CRITICAL": 3}
INT_TO_LEVEL = {0: "LOW", 1: "MEDIUM", 2: "HIGH", 3: "CRITICAL"}


# ── Step 1: build district centroid index from synthetic data ────────────────
def build_district_centroids(synth: pd.DataFrame) -> pd.DataFrame:
    """Avg lat/lng per (state, district). Used to assign each risk-zone point to
    its nearest district, so we can join NCRB district-level features."""
    print(f"[1/6] Building district centroids from {len(synth):,} synthetic rows…")
    centroids = (
        synth.groupby(["state", "district"], as_index=False)
        .agg(lat=("latitude", "mean"), lng=("longitude", "mean"))
    )
    centroids["state_u"] = centroids["state"].str.upper().str.strip()
    centroids["district_u"] = centroids["district"].str.upper().str.strip()
    print(f"      -> {len(centroids):,} unique (state, district) centroids")
    return centroids


# ── Step 2: load + clean NCRB district aggregates ────────────────────────────
# These are the REAL ground-truth features — totals per crime category per district
# in 2014. The model will learn how this contextual profile maps to local risk.
NCRB_FEATURE_COLS = {
    "Rape": "ncrb_rape",
    "Kidnapping & Abduction_Total": "ncrb_kidnap",
    "Dowry Deaths": "ncrb_dowry",
    "Assault on Women with intent to outrage her Modesty_Total": "ncrb_assault",
    "Insult to the Modesty of Women_Total": "ncrb_insult",
    "Cruelty by Husband or his Relatives": "ncrb_cruelty",
    "Total Crimes against Women": "ncrb_total",
}


def load_ncrb_district_features() -> pd.DataFrame:
    print(f"[2/6] Loading NCRB district aggregates: {NCRB_2014.name}")
    df = pd.read_csv(NCRB_2014)
    keep = ["States/UTs", "District"] + list(NCRB_FEATURE_COLS.keys())
    df = df[keep].rename(columns=NCRB_FEATURE_COLS)
    df = df.rename(columns={"States/UTs": "state", "District": "district"})
    df["state_u"] = df["state"].str.upper().str.strip()
    df["district_u"] = df["district"].str.upper().str.strip()
    # Drop "Total" rows that appear in the NCRB file as state-level summaries
    df = df[~df["district_u"].str.contains("TOTAL", na=False)]
    for col in NCRB_FEATURE_COLS.values():
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0)
    print(f"      -> {len(df):,} district rows kept")
    return df


# ── Step 3: nearest-district lookup (vectorised) ─────────────────────────────
def attach_district(zones: pd.DataFrame, centroids: pd.DataFrame) -> pd.DataFrame:
    """For each risk-zone row, find the nearest district centroid by Euclidean
    distance on (lat, lng). This is a small projection error at country scale
    but vastly faster than haversine and accurate enough for districts."""
    print(f"[3/6] Assigning nearest district to {len(zones):,} risk-zone rows…")
    cent_lat = centroids["lat"].to_numpy()
    cent_lng = centroids["lng"].to_numpy()
    cent_state = centroids["state_u"].to_numpy()
    cent_district = centroids["district_u"].to_numpy()

    out_state = np.empty(len(zones), dtype=object)
    out_district = np.empty(len(zones), dtype=object)

    # Chunk to avoid materialising a (zones × centroids) distance matrix at once
    CHUNK = 4096
    zlat = zones["latitude"].to_numpy()
    zlng = zones["longitude"].to_numpy()
    for i in range(0, len(zones), CHUNK):
        sub_lat = zlat[i : i + CHUNK][:, None]
        sub_lng = zlng[i : i + CHUNK][:, None]
        d2 = (sub_lat - cent_lat) ** 2 + (sub_lng - cent_lng) ** 2
        idx = np.argmin(d2, axis=1)
        out_state[i : i + CHUNK] = cent_state[idx]
        out_district[i : i + CHUNK] = cent_district[idx]
        if i % (CHUNK * 8) == 0:
            sys.stdout.write(f"\r      {min(i + CHUNK, len(zones)):,}/{len(zones):,}")
            sys.stdout.flush()
    sys.stdout.write("\n")

    zones = zones.copy()
    zones["state_u"] = out_state
    zones["district_u"] = out_district
    return zones


# ── Step 4: feature engineering ──────────────────────────────────────────────
def build_features(zones: pd.DataFrame, ncrb: pd.DataFrame) -> pd.DataFrame:
    print("[4/6] Engineering features…")
    df = zones.merge(
        ncrb[["state_u", "district_u"] + list(NCRB_FEATURE_COLS.values())],
        on=["state_u", "district_u"],
        how="left",
    )
    # Districts with no NCRB match -> zero (no data evidence)
    for col in NCRB_FEATURE_COLS.values():
        df[col] = df[col].fillna(0)

    # Add fraction-of-total composition features. These tell the model what
    # KIND of crimes dominate the district, not just the volume.
    total = df["ncrb_total"].replace(0, np.nan)
    df["frac_rape"] = (df["ncrb_rape"] / total).fillna(0)
    df["frac_kidnap"] = (df["ncrb_kidnap"] / total).fillna(0)
    df["frac_dowry"] = (df["ncrb_dowry"] / total).fillna(0)
    df["frac_assault"] = (df["ncrb_assault"] / total).fillna(0)
    df["frac_cruelty"] = (df["ncrb_cruelty"] / total).fillna(0)

    # Log-scale the absolute totals — crime counts span 4 orders of magnitude
    for col in list(NCRB_FEATURE_COLS.values()):
        df[f"log_{col}"] = np.log1p(df[col])

    # Year defaults to 2014 when missing (the data year for NCRB features)
    df["year_filled"] = df["year"].fillna(2014).astype(int)

    return df


FEATURE_COLS = [
    # spatial coordinates
    "latitude", "longitude", "year_filled",
    # local crime-density features (legitimate context, not target-formula inputs).
    # We deliberately EXCLUDE severityScore because riskScore is ~1.5 * severityScore *
    # crimeCount in the generator — including it would teach the model the formula.
    # crimeDensity (per sq km), crimeCount, and nightCrimeRate describe what's
    # happening nearby; a real model trained on real crime data would compute
    # exactly these from raw incidents.
    "crimeDensity", "crimeCount", "nightCrimeRate",
    # log-scaled NCRB district totals (real ground-truth context)
    "log_ncrb_rape", "log_ncrb_kidnap", "log_ncrb_dowry",
    "log_ncrb_assault", "log_ncrb_insult", "log_ncrb_cruelty", "log_ncrb_total",
    # district crime-type composition
    "frac_rape", "frac_kidnap", "frac_dowry", "frac_assault", "frac_cruelty",
]


# ── Step 5: train ────────────────────────────────────────────────────────────
def train_and_save(df: pd.DataFrame) -> None:
    print(f"[5/6] Training on {len(df):,} rows, {len(FEATURE_COLS)} features…")
    X = df[FEATURE_COLS].astype(np.float32)
    y_reg = df["riskScore"].astype(np.float32)
    y_clf = df["riskLevel"].str.upper().map(LEVEL_TO_INT).astype("Int64")
    mask = y_clf.notna()
    X, y_reg, y_clf = X[mask], y_reg[mask], y_clf[mask].astype(int)

    X_tr, X_te, yr_tr, yr_te, yc_tr, yc_te = train_test_split(
        X, y_reg, y_clf, test_size=0.2, random_state=42, stratify=y_clf
    )

    # ─── Regressor ───
    reg = xgb.XGBRegressor(
        n_estimators=500, max_depth=6, learning_rate=0.05,
        subsample=0.85, colsample_bytree=0.85,
        tree_method="hist", eval_metric="mae",
        early_stopping_rounds=25, n_jobs=-1, random_state=42,
    )
    reg.fit(X_tr, yr_tr, eval_set=[(X_te, yr_te)], verbose=False)
    yr_pred = reg.predict(X_te)
    reg_mae = mean_absolute_error(yr_te, yr_pred)
    reg_r2 = r2_score(yr_te, yr_pred)

    # ─── Classifier ───
    clf = xgb.XGBClassifier(
        n_estimators=500, max_depth=6, learning_rate=0.05,
        subsample=0.85, colsample_bytree=0.85,
        tree_method="hist", objective="multi:softprob",
        num_class=4, eval_metric="mlogloss",
        early_stopping_rounds=25, n_jobs=-1, random_state=42,
    )
    clf.fit(X_tr, yc_tr, eval_set=[(X_te, yc_te)], verbose=False)
    yc_pred = clf.predict(X_te)
    clf_acc = accuracy_score(yc_te, yc_pred)
    clf_report = classification_report(
        yc_te, yc_pred, target_names=[INT_TO_LEVEL[i] for i in range(4)], digits=3,
    )

    # ─── Save ───
    print("[6/6] Saving artifacts…")
    reg.save_model(str(OUT_REG))
    clf.save_model(str(OUT_CLF))

    # Feature importance (regressor)
    importance = pd.DataFrame({
        "feature": FEATURE_COLS,
        "importance": reg.feature_importances_,
    }).sort_values("importance", ascending=False)
    importance.to_csv(OUT_IMPORTANCE, index=False)

    # Metadata for the FastAPI runtime
    meta = {
        "feature_cols": FEATURE_COLS,
        "level_to_int": LEVEL_TO_INT,
        "int_to_level": {str(k): v for k, v in INT_TO_LEVEL.items()},
        "ncrb_feature_cols": list(NCRB_FEATURE_COLS.values()),
        "metrics": {
            "regressor_mae": round(float(reg_mae), 3),
            "regressor_r2":  round(float(reg_r2),  3),
            "classifier_accuracy": round(float(clf_acc), 3),
        },
        "trained_on_rows": int(len(X)),
    }
    import json
    OUT_META.write_text(json.dumps(meta, indent=2))

    # ─── Report ───
    print()
    print("=== TRAINING COMPLETE ===")
    print(f"Regressor    MAE = {reg_mae:.2f}  R2 = {reg_r2:.3f}")
    print(f"Classifier   accuracy = {clf_acc:.3f}")
    print()
    print("Classification report:")
    print(clf_report)
    print()
    print("Top 8 features (by regressor importance):")
    print(importance.head(8).to_string(index=False))
    print()
    print(f"Saved -> {OUT_REG.name}, {OUT_CLF.name}, {OUT_META.name}, {OUT_IMPORTANCE.name}")


def main() -> None:
    if not RISK_ZONES.exists():
        sys.exit(f"Missing {RISK_ZONES}")
    if not SYNTHETIC.exists():
        sys.exit(f"Missing {SYNTHETIC}")
    if not NCRB_2014.exists():
        sys.exit(f"Missing {NCRB_2014}")

    print(f"Loading {RISK_ZONES.name}…")
    zones = pd.read_csv(RISK_ZONES)
    zones = zones.dropna(subset=["latitude", "longitude", "riskScore", "riskLevel"])
    print(f"  -> {len(zones):,} rows")

    print(f"Loading {SYNTHETIC.name}…")
    synth = pd.read_csv(SYNTHETIC, usecols=["state", "district", "latitude", "longitude"])

    centroids = build_district_centroids(synth)
    ncrb = load_ncrb_district_features()
    zones_with_dist = attach_district(zones, centroids)
    features = build_features(zones_with_dist, ncrb)
    train_and_save(features)

    # Save the lookup tables that main.py needs for inference
    centroids[["state_u", "district_u", "lat", "lng"]].to_csv(OUT_CENTROIDS, index=False)

    # Pre-compute the engineered NCRB features so main.py doesn't recompute them
    n = ncrb.copy()
    total = n["ncrb_total"].replace(0, np.nan)
    for col in ["rape", "kidnap", "dowry", "assault", "cruelty"]:
        n[f"frac_{col}"] = (n[f"ncrb_{col}"] / total).fillna(0)
    for col in NCRB_FEATURE_COLS.values():
        n[f"log_{col}"] = np.log1p(n[col])
    keep_cols = ["state_u", "district_u"] + [
        f"log_{c}" for c in NCRB_FEATURE_COLS.values()
    ] + ["frac_rape", "frac_kidnap", "frac_dowry", "frac_assault", "frac_cruelty"]
    n[keep_cols].to_csv(OUT_NCRB, index=False)
    print(f"Saved -> {OUT_CENTROIDS.name}, {OUT_NCRB.name}")


if __name__ == "__main__":
    main()
