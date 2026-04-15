# scripts/crime_analytics_ml.py
"""
Crime Analytics ML Module
Handles:
1. Historical crime data aggregation and cleaning
2. Time-series forecasting for future crime trends
3. Crime hotspot identification and severity scoring
4. District-level analytics and comparisons
"""

import pandas as pd
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.preprocessing import PolynomialFeatures
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
from datetime import datetime, timedelta
import json
from pathlib import Path
import pickle
import warnings

warnings.filterwarnings('ignore')

# Crime type mappings - VALUES MUST BE UPPERCASE to match preprocessed dataframe
CRIME_TYPES = {
    'rape': 'RAPE',
    'kidnapping': 'KIDNAPPING AND ABDUCTION',
    'dowry_death': 'DOWRY DEATHS',
    'assault_women': 'ASSAULT ON WOMEN WITH INTENT TO OUTRAGE HER MODESTY',
    'insult_modesty': 'INSULT TO MODESTY OF WOMEN',
    'cruelty_husband': 'CRUELTY BY HUSBAND OR HIS RELATIVES',
    'importation_girls': 'IMPORTATION OF GIRLS'
}

CRIME_SEVERITY = {
    'rape': 4,
    'kidnapping': 4,
    'dowry_death': 4,
    'assault_women': 2,
    'insult_modesty': 2,
    'cruelty_husband': 2,
    'importation_girls': 6,
}


class CrimeAnalyticsEngine:
    """Main analytics engine for crime data processing and predictions"""
    
    def __init__(self, csv_path: str):
        """
        Initialize with CSV file path
        
        Args:
            csv_path: Path to crimes_against_women.csv
        """
        self.df = pd.read_csv(csv_path)
        self.models = {}
        self.scaler_params = {}
        self.forecast_years = 3  # Predict 3 years ahead
        
    def preprocess_data(self) -> pd.DataFrame:
        """Clean and prepare data for analysis"""
        df = self.df.copy()
        
        # Standardize column names to UPPERCASE
        df.columns = df.columns.str.strip().str.upper()
        
        # Handle missing values
        for col in CRIME_TYPES.values():
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)
        
        df['YEAR'] = pd.to_numeric(df['YEAR'], errors='coerce').fillna(2001)
        df['STATE/UT'] = df.get('STATE/UT', '').str.strip().str.upper()
        df['DISTRICT'] = df.get('DISTRICT', '').str.strip().str.upper()
        
        return df
    
    def get_state_district_stats(self, state: str, district: str = None) -> dict:
        """
        Get comprehensive crime statistics for a state or district
        """
        df = self.preprocess_data()
        state_upper = state.strip().upper()
        district_upper = district.strip().upper() if district else None
        
        # Filter by state
        state_df = df[df['STATE/UT'] == state_upper]
        
        if district_upper:
            state_df = state_df[state_df['DISTRICT'] == district_upper]
        
        if state_df.empty:
            return {'error': f'No data found for {state_upper}' + (f' - {district_upper}' if district_upper else '')}
        
        # Calculate statistics
        stats = {}
        for crime_key, crime_name in CRIME_TYPES.items():
            if crime_name in state_df.columns:
                total = state_df[crime_name].sum()
                yearly = state_df.groupby('YEAR')[crime_name].sum().to_dict()
                stats[crime_key] = {
                    'total': int(total),
                    'yearly': {int(k): int(v) for k, v in yearly.items()},
                    'severity': CRIME_SEVERITY[crime_key],
                    'avg_per_year': float(total / len(state_df['YEAR'].unique())) if len(state_df['YEAR'].unique()) > 0 else 0
                }
        
        return {
            'state': state_upper,
            'district': district_upper,
            'years_covered': sorted(state_df['YEAR'].unique().tolist()),
            'crimes': stats,
            'total_records': int(state_df.shape[0])
        }
    
    def forecast_crime_trends(self, state: str, district: str = None, 
                            crime_type: str = 'rape', years_ahead: int = 3) -> dict:
        """
        Forecast future crime trends using polynomial regression
        """
        if years_ahead < 1:
            return {'error': 'years_ahead must be 1 or greater'}
        
        df = self.preprocess_data()
        state_upper = state.strip().upper()
        district_upper = district.strip().upper() if district else None
        
        state_df = df[df['STATE/UT'] == state_upper]
        if district_upper:
            state_df = state_df[state_df['DISTRICT'] == district_upper]
        
        if state_df.empty:
            return {'error': 'No data found'}
        
        crime_name = CRIME_TYPES.get(crime_type)
        if crime_name not in state_df.columns:
            return {'error': f'Crime type {crime_type} not found'}
        
        # Aggregate by year
        yearly_data = state_df.groupby('YEAR')[crime_name].sum().reset_index()
        yearly_data = yearly_data.sort_values('YEAR')
        
        if len(yearly_data) < 3:
            return {'error': 'Insufficient historical data for forecasting'}
        
        # Prepare data
        X = yearly_data['YEAR'].values.reshape(-1, 1)
        y = yearly_data[crime_name].values
        
        # Normalize years for better predictions
        year_min, year_max = X.min(), X.max()
        X_norm = (X - year_min) / (year_max - year_min)
        
        # Fit polynomial regression (degree 2 for smooth trends)
        poly = PolynomialFeatures(degree=2)
        X_poly = poly.fit_transform(X_norm)
        
        model = LinearRegression()
        model.fit(X_poly, y)
        
        # Calculate historical metrics
        y_pred_hist = model.predict(X_poly)
        mae = mean_absolute_error(y, y_pred_hist)
        r2 = r2_score(y, y_pred_hist)
        
        # Forecast future years
        future_years = np.arange(year_max + 1, year_max + years_ahead + 1)
        X_future_norm = (future_years.reshape(-1, 1) - year_min) / (year_max - year_min)
        X_future_poly = poly.transform(X_future_norm)
        y_future = model.predict(X_future_poly)
        
        # Ensure no negative predictions
        y_future = np.maximum(y_future, 0)
        
        # Calculate trend
        recent_avg = y[-3:].mean()
        future_avg = y_future.mean()
        trend_direction = 'increasing' if future_avg > recent_avg else 'decreasing'
        trend_magnitude = abs(future_avg - recent_avg) / recent_avg * 100 if recent_avg > 0 else 0
        
        return {
            'state': state_upper,
            'district': district_upper,
            'crime_type': crime_type,
            'historical': {
                'years': yearly_data['YEAR'].tolist(),
                'values': yearly_data[crime_name].tolist(),
            },
            'forecast': {
                'years': future_years.tolist(),
                'values': np.maximum(y_future, 0).tolist(),
            },
            'metrics': {
                'mean_absolute_error': float(mae),
                'r2_score': float(r2),
                'trend_direction': trend_direction,
                'trend_magnitude_percent': float(trend_magnitude),
                'confidence': 'high' if r2 > 0.7 else 'medium' if r2 > 0.4 else 'low'
            }
        }
    
    def get_hotspots(self, state: str = None, limit: int = 10) -> dict:
        """
        Identify crime hotspots (districts with highest crime concentrations)
        """
        df = self.preprocess_data()
        
        if state:
            df = df[df['STATE/UT'] == state.strip().upper()]
        
        # Calculate risk score for each district
        hotspots = []
        for (state_name, district_name), group in df.groupby(['STATE/UT', 'DISTRICT']):
            # Sum all crime types
            total_crimes = 0
            crime_breakdown = {}
            
            for crime_key, crime_name in CRIME_TYPES.items():
                if crime_name in group.columns:
                    count = group[crime_name].sum()
                    crime_breakdown[crime_key] = int(count)
                    total_crimes += count * CRIME_SEVERITY[crime_key]  # Weighted by severity
            
            if total_crimes > 0:
                # Calculate severity average
                severity_score = total_crimes / sum(CRIME_SEVERITY.values())
                
                hotspots.append({
                    'state': state_name,
                    'district': district_name,
                    'total_crimes': int(group[[v for v in CRIME_TYPES.values() if v in group.columns]].sum().sum()),
                    'severity_score': float(severity_score),
                    'crime_breakdown': crime_breakdown,
                    'years_data': int(len(group))
                })
        
        # Sort by severity and return top hotspots
        hotspots = sorted(hotspots, key=lambda x: x['severity_score'], reverse=True)
        return {
            'hotspots': hotspots[:limit],
            'total_identified': len(hotspots)
        }
    
    def compare_districts(self, state: str, districts: list) -> dict:
        """
        Compare crime statistics across multiple districts
        """
        state_upper = state.strip().upper()
        comparison = {
            'state': state_upper,
            'districts': {}
        }
        
        for district in districts:
            stats = self.get_state_district_stats(state_upper, district)
            if 'error' not in stats:
                comparison['districts'][district.strip().upper()] = stats['crimes']
        
        return comparison
    
    def get_temporal_trends(self, state: str, district: str = None) -> dict:
        """
        Get year-over-year trends for all crime types
        """
        df = self.preprocess_data()
        state_upper = state.strip().upper()
        district_upper = district.strip().upper() if district else None
        
        state_df = df[df['STATE/UT'] == state_upper]
        if district_upper:
            state_df = state_df[state_df['DISTRICT'] == district_upper]
        
        trends = {'state': state_upper, 'district': district_upper, 'trends': {}}
        
        for crime_key, crime_name in CRIME_TYPES.items():
            if crime_name in state_df.columns:
                yearly = state_df.groupby('YEAR')[crime_name].sum()
                trend_data = {
                    'years': yearly.index.tolist(),
                    'values': yearly.values.tolist(),
                }
                
                # Calculate year-over-year change
                if len(yearly) > 1:
                    yoy_change = yearly.pct_change().mean() * 100
                    trend_data['yoy_change_percent'] = float(yoy_change)
                
                trends['trends'][crime_key] = trend_data
        
        return trends


def save_model_cache(engine: CrimeAnalyticsEngine, output_dir: str = '.'):
    """Cache the engine for faster subsequent queries"""
    cache_path = Path(output_dir) / 'crime_engine.pkl'
    with open(cache_path, 'wb') as f:
        pickle.dump(engine, f)
    print(f"✅ Engine cached to {cache_path}")


def load_model_cache(cache_path: str = 'crime_engine.pkl') -> CrimeAnalyticsEngine:
    """Load cached engine"""
    with open(cache_path, 'rb') as f:
        return pickle.load(f)


if __name__ == '__main__':
    # Example usage
    print("Initializing Crime Analytics Engine...")
    engine = CrimeAnalyticsEngine('crimes_against_women.csv')
    
    # Example 1: Get state statistics
    print("\n1️⃣ State Statistics (Andhra Pradesh):")
    stats = engine.get_state_district_stats('ANDHRA PRADESH', 'HYDERABAD CITY')
    print(json.dumps(stats, indent=2))
    
    # Example 2: Forecast trends
    print("\n2️⃣ Forecasting rape trends (Andhra Pradesh, 3 years):")
    forecast = engine.forecast_crime_trends('ANDHRA PRADESH', crime_type='rape', years_ahead=3)
    print(json.dumps(forecast, indent=2))
    
    # Example 3: Get hotspots
    print("\n3️⃣ Top 5 Crime Hotspots:")
    hotspots = engine.get_hotspots(limit=5)
    print(json.dumps(hotspots, indent=2))
    
    # Example 4: Get temporal trends
    print("\n4️⃣ Temporal Trends (Andhra Pradesh):")
    temporal = engine.get_temporal_trends('ANDHRA PRADESH')
    print(json.dumps(temporal, indent=2))
    
    print("\n✅ All examples complete!")