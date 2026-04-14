import pandas as pd

df = pd.read_csv("synthetic_crime_data.csv")

print("=== VALIDATION REPORT ===\n")

# 1. Row count
print(f"✅ Total records: {len(df)}")

# 2. Check for nulls
nulls = df.isnull().sum()
print(f"\n📋 Null values:\n{nulls}")

# 3. Crime type distribution
print(f"\n📊 Crime type distribution:\n{df['crimeType'].value_counts()}")

# 4. Severity distribution
print(f"\n⚠️  Severity distribution:\n{df['severity'].value_counts()}")

# 5. Time of day distribution
print(f"\n🕐 Time of day distribution:\n{df['timeOfDay'].value_counts()}")

# 6. Coordinate sanity check (India bounds: lat 8-37, lng 68-97)
out_of_bounds = df[
    (df['latitude'] < 8) | (df['latitude'] > 37) |
    (df['longitude'] < 68) | (df['longitude'] > 97)
]
print(f"\n🗺️  Points outside India bounds: {len(out_of_bounds)}")
if len(out_of_bounds) > 0:
    print(out_of_bounds[['district','state','latitude','longitude']].head())

# 7. Top 10 highest crime districts
print(f"\n🔴 Top 10 crime districts:")
print(df.groupby(['district','state']).size().sort_values(ascending=False).head(10))

# 8. Year range
print(f"\n📅 Year range: {df['year'].min()} - {df['year'].max()}")

print("\n=== VALIDATION COMPLETE ===")