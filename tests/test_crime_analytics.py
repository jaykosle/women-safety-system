# tests/test_crime_analytics.py
"""
Tests for Crime Analytics ML Engine
Run: pytest test_crime_analytics.py -v
"""

import pytest
import sys
import os
sys.path.insert(0, '/home/claude')
# This adds the 'scripts' folder to the path dynamically
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'scripts')))

from crime_analytics_ml import CrimeAnalyticsEngine

import pandas as pd
import tempfile

# Sample data for testing
SAMPLE_CSV_DATA = """STATE/UT,DISTRICT,Year,Rape,Kidnapping and Abduction,Dowry Deaths,Assault on women with intent to outrage her modesty,Insult to modesty of Women,Cruelty by Husband or his Relatives,Importation of Girls
ANDHRA PRADESH,HYDERABAD CITY,2001,50,30,16,149,34,175,0
ANDHRA PRADESH,HYDERABAD CITY,2002,55,32,18,152,36,180,1
ANDHRA PRADESH,HYDERABAD CITY,2003,60,35,20,155,38,185,2
ANDHRA PRADESH,HYDERABAD CITY,2004,65,37,22,158,40,190,2
ANDHRA PRADESH,HYDERABAD CITY,2005,70,40,24,160,42,195,3
ANDHRA PRADESH,VIJAYAWADA,2001,40,25,12,120,28,140,0
ANDHRA PRADESH,VIJAYAWADA,2002,45,27,14,125,30,145,0
ANDHRA PRADESH,VIJAYAWADA,2003,50,30,16,130,32,150,1
ANDHRA PRADESH,VIZIANAGARAM,2001,30,20,10,90,20,100,0
ANDHRA PRADESH,VIZIANAGARAM,2002,35,22,12,95,22,105,0
UTTAR PRADESH,LUCKNOW,2001,80,50,30,200,50,250,2
UTTAR PRADESH,LUCKNOW,2002,90,55,35,210,55,260,3
UTTAR PRADESH,KANPUR,2001,70,45,25,180,45,220,1
UTTAR PRADESH,KANPUR,2002,80,50,30,190,50,230,2
"""

@pytest.fixture
def engine():
    """Create a temporary CSV file and engine for testing"""
    with tempfile.NamedTemporaryFile(mode='w', suffix='.csv', delete=False) as f:
        f.write(SAMPLE_CSV_DATA)
        csv_path = f.name
    
    engine = CrimeAnalyticsEngine(csv_path)
    yield engine
    
    # Cleanup
    os.unlink(csv_path)

class TestDataPreprocessing:
    """Test data preprocessing functionality"""
    
    def test_preprocess_handles_missing_values(self, engine):
        """Ensure missing values are handled correctly"""
        df = engine.preprocess_data()
        assert df.isnull().sum().sum() == 0, "Should have no null values after preprocessing"
    
    def test_preprocess_standardizes_state_names(self, engine):
        """Ensure state names are standardized to uppercase"""
        df = engine.preprocess_data()
        states = df['STATE/UT'].unique()
        assert all(s == s.upper() for s in states), "All states should be uppercase"
    
    def test_preprocess_converts_years_to_numeric(self, engine):
        """Ensure years are numeric"""
        df = engine.preprocess_data()
        assert df['YEAR'].dtype in ['int64', 'float64'], "Years should be numeric"

class TestStateStats:
    """Test state statistics functionality"""
    
    def test_get_state_stats(self, engine):
        """Test retrieving statistics for a state"""
        stats = engine.get_state_district_stats('ANDHRA PRADESH')
        assert stats['state'] == 'ANDHRA PRADESH'
        assert 'crimes' in stats
        assert stats['total_records'] > 0
    
    def test_get_district_stats(self, engine):
        """Test retrieving statistics for a specific district"""
        stats = engine.get_state_district_stats('ANDHRA PRADESH', 'HYDERABAD CITY')
        assert stats['state'] == 'ANDHRA PRADESH'
        assert stats['district'] == 'HYDERABAD CITY'
    
    def test_invalid_state_returns_error(self, engine):
        """Test that invalid state returns error"""
        stats = engine.get_state_district_stats('INVALID STATE')
        assert 'error' in stats
    
    def test_crime_totals_are_correct(self, engine):
        """Test that crime totals are calculated correctly"""
        stats = engine.get_state_district_stats('ANDHRA PRADESH', 'HYDERABAD CITY')
        rape_total = stats['crimes']['rape']['total']
        # Based on sample data: 50+55+60+65+70 = 300
        assert rape_total == 300, f"Expected 300 rapes, got {rape_total}"

class TestForecasting:
    """Test ML forecasting functionality"""
    
    def test_forecast_returns_valid_structure(self, engine):
        """Test that forecast returns expected structure"""
        forecast = engine.forecast_crime_trends(
            'ANDHRA PRADESH',
            crime_type='rape',
            years_ahead=2
        )
        assert 'historical' in forecast
        assert 'forecast' in forecast
        assert 'metrics' in forecast
    
    def test_forecast_has_correct_years(self, engine):
        """Test that forecast has correct number of future years"""
        forecast = engine.forecast_crime_trends(
            'ANDHRA PRADESH',
            crime_type='rape',
            years_ahead=3
        )
        assert len(forecast['forecast']['years']) == 3
        assert len(forecast['forecast']['values']) == 3
    
    def test_forecast_values_are_positive(self, engine):
        """Test that forecast values are never negative"""
        forecast = engine.forecast_crime_trends(
            'ANDHRA PRADESH',
            crime_type='rape',
            years_ahead=3
        )
        assert all(v >= 0 for v in forecast['forecast']['values']), \
            "All forecast values should be >= 0"
    
    def test_forecast_insufficient_data_returns_error(self, engine):
        """Test that insufficient data returns error"""
        forecast = engine.forecast_crime_trends(
            'UTTAR PRADESH',
            'KANPUR',
            crime_type='rape',
            years_ahead=3
        )
        assert 'error' in forecast
    
    def test_forecast_has_metrics(self, engine):
        """Test that forecast includes quality metrics"""
        forecast = engine.forecast_crime_trends(
            'ANDHRA PRADESH',
            crime_type='rape',
            years_ahead=2
        )
        assert 'r2_score' in forecast['metrics']
        assert 'mean_absolute_error' in forecast['metrics']
        assert 'trend_direction' in forecast['metrics']
        assert 'confidence' in forecast['metrics']

class TestHotspots:
    """Test hotspot identification"""
    
    def test_get_hotspots_returns_list(self, engine):
        """Test that hotspots are returned as a list"""
        result = engine.get_hotspots(limit=5)
        assert 'hotspots' in result
        assert isinstance(result['hotspots'], list)
    
    def test_hotspots_sorted_by_severity(self, engine):
        """Test that hotspots are sorted by severity score"""
        result = engine.get_hotspots(limit=10)
        scores = [h['severity_score'] for h in result['hotspots']]
        assert scores == sorted(scores, reverse=True), \
            "Hotspots should be sorted by severity descending"
    
    def test_hotspots_have_required_fields(self, engine):
        """Test that each hotspot has required fields"""
        result = engine.get_hotspots(limit=1)
        if result['hotspots']:
            hotspot = result['hotspots'][0]
            assert 'state' in hotspot
            assert 'district' in hotspot
            assert 'total_crimes' in hotspot
            assert 'severity_score' in hotspot
            assert 'crime_breakdown' in hotspot
    
    def test_hotspots_respects_limit(self, engine):
        """Test that hotspots respects the limit parameter"""
        result = engine.get_hotspots(limit=3)
        assert len(result['hotspots']) <= 3

class TestTemporalTrends:
    """Test temporal trend analysis"""
    
    def test_get_temporal_trends_returns_data(self, engine):
        """Test that temporal trends are returned"""
        trends = engine.get_temporal_trends('ANDHRA PRADESH')
        assert 'trends' in trends
        assert isinstance(trends['trends'], dict)
    
    def test_temporal_trends_have_yearly_data(self, engine):
        """Test that trends include year-over-year changes"""
        trends = engine.get_temporal_trends('ANDHRA PRADESH')
        for crime_key, trend in trends['trends'].items():
            assert 'years' in trend
            assert 'values' in trend
            assert len(trend['years']) == len(trend['values'])

class TestComparisons:
    """Test district comparison functionality"""
    
    def test_compare_districts_returns_all_districts(self, engine):
        """Test that comparison includes all requested districts"""
        result = engine.compare_districts(
            'ANDHRA PRADESH',
            ['HYDERABAD CITY', 'VIJAYAWADA']
        )
        assert 'districts' in result
        assert 'HYDERABAD CITY' in result['districts']
        assert 'VIJAYAWADA' in result['districts']

class TestEdgeCases:
    """Test edge cases and error handling"""
    
    def test_empty_state_name(self, engine):
        """Test handling of empty state name"""
        stats = engine.get_state_district_stats('')
        assert 'error' in stats
    
    def test_case_insensitive_state_lookup(self, engine):
        """Test that state lookup is case-insensitive"""
        stats1 = engine.get_state_district_stats('ANDHRA PRADESH')
        stats2 = engine.get_state_district_stats('andhra pradesh')
        assert stats1['state'] == stats2['state']
    
    def test_negative_years_ahead_handled(self, engine):
        """Test that negative years_ahead is handled"""
        # Should either return error or default to 0
        forecast = engine.forecast_crime_trends(
            'ANDHRA PRADESH',
            crime_type='rape',
            years_ahead=-1
        )
        # Should either error or not crash
        assert isinstance(forecast, dict)

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])