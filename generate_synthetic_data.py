import pandas as pd
import numpy as np
import json
import time

# ============================================================
# DISTRICT COORDINATES (centroid lat/lng for Indian districts)
# ============================================================
DISTRICT_COORDS = {
    # Andhra Pradesh
    "ADILABAD": (19.6641, 78.5320), "ANANTAPUR": (14.6819, 77.6006),
    "CHITTOOR": (13.2172, 79.1003), "CUDDAPAH": (14.4674, 78.8241),
    "EAST GODAVARI": (17.3850, 81.9340), "GUNTUR": (16.3067, 80.4365),
    "HYDERABAD CITY": (17.3850, 78.4867), "KARIMNAGAR": (18.4386, 79.1288),
    "KHAMMAM": (17.2473, 80.1514), "KRISHNA": (16.6010, 80.6480),
    "KURNOOL": (15.8281, 78.0373), "MAHABOOBNAGAR": (16.7448, 77.9886),
    "MEDAK": (18.0533, 78.2655), "NALGONDA": (17.0575, 79.2671),
    "NELLORE": (14.4426, 79.9865), "NIZAMABAD": (18.6725, 78.0940),
    "PRAKASHAM": (15.3367, 79.5941), "RANGA REDDY": (17.3678, 78.4340),
    "SRIKAKULAM": (18.2949, 83.8938), "VIJAYAWADA": (16.5062, 80.6480),
    "VISAKHAPATNAM": (17.6868, 83.2185), "VIZIANAGARAM": (18.1167, 83.4167),
    "WARANGAL": (17.9784, 79.5941),
    # Uttar Pradesh
    "AGRA": (27.1767, 78.0081), "ALIGARH": (27.8974, 78.0880),
    "ALLAHABAD": (25.4358, 81.8463), "AZAMGARH": (26.0737, 83.1837),
    "BAREILLY": (28.3670, 79.4304), "KANPUR": (26.4499, 80.3319),
    "LUCKNOW": (26.8467, 80.9462), "MATHURA": (27.4924, 77.6737),
    "MEERUT": (28.9845, 77.7064), "MORADABAD": (28.8386, 78.7733),
    "VARANASI": (25.3176, 82.9739), "GORAKHPUR": (26.7606, 83.3732),
    "GHAZIABAD": (28.6692, 77.4538), "JHANSI": (25.4484, 78.5685),
    "SITAPUR": (27.5635, 80.6834), "FAIZABAD": (26.7754, 82.1457),
    # Madhya Pradesh
    "BHOPAL": (23.2599, 77.4126), "GWALIOR": (26.2183, 78.1828),
    "INDORE": (22.7196, 75.8577), "JABALPUR": (23.1815, 79.9864),
    "REWA": (24.5362, 81.2964), "SAGAR": (23.8388, 78.7378),
    "SATNA": (24.5694, 80.8322), "UJJAIN": (23.1765, 75.7885),
    "MORENA": (26.4965, 77.9935), "RATLAM": (23.3315, 75.0367),
    # Rajasthan
    "JAIPUR": (26.9124, 75.7873), "JODHPUR": (26.2389, 73.0243),
    "KOTA": (25.2138, 75.8648), "AJMER": (26.4499, 74.6399),
    "BIKANER": (28.0229, 73.3119), "UDAIPUR": (24.5854, 73.7125),
    "ALWAR": (27.5530, 76.6346), "BHARATPUR": (27.2152, 77.4938),
    # Maharashtra
    "MUMBAI": (19.0760, 72.8777), "PUNE": (18.5204, 73.8567),
    "NAGPUR": (21.1458, 79.0882), "NASHIK": (19.9975, 73.7898),
    "AURANGABAD": (19.8762, 75.3433), "SOLAPUR": (17.6805, 75.9064),
    "KOLHAPUR": (16.7050, 74.2433), "THANE": (19.2183, 72.9781),
    "AHMEDNAGAR": (19.0952, 74.7496), "AMRAVATI": (20.9374, 77.7796),
    # West Bengal
    "KOLKATA": (22.5726, 88.3639), "HOWRAH": (22.5958, 88.2636),
    "HOOGHLY": (22.9000, 88.3997), "MURSHIDABAD": (24.1800, 88.2700),
    "NADIA": (23.4700, 88.5600), "BURDWAN": (23.2324, 87.8615),
    "MIDNAPORE": (22.4257, 87.3216), "MALDA": (25.0108, 88.1438),
    "DINAJPUR": (25.6200, 88.6300), "JALPAIGURI": (26.5454, 88.7182),
    # Bihar
    "PATNA": (25.5941, 85.1376), "GAYA": (24.7955, 85.0002),
    "MUZAFFARPUR": (26.1209, 85.3647), "BHAGALPUR": (25.2425, 86.9842),
    "DARBHANGA": (26.1542, 85.8918), "ROHTAS": (24.9500, 84.0500),
    "NALANDA": (25.1374, 85.4438), "SARAN": (25.9200, 84.7400),
    # Delhi
    "DELHI": (28.6139, 77.2090), "NORTH DELHI": (28.7041, 77.1025),
    "SOUTH DELHI": (28.5245, 77.1855), "EAST DELHI": (28.6508, 77.2794),
    "WEST DELHI": (28.6517, 77.0580), "CENTRAL DELHI": (28.6448, 77.2167),
    "NEW DELHI": (28.6139, 77.2090),
    # Karnataka
    "BANGALORE": (12.9716, 77.5946), "MYSORE": (12.2958, 76.6394),
    "GULBARGA": (17.3297, 76.8343), "BELGAUM": (15.8497, 74.4977),
    "MANGALORE": (12.9141, 74.8560), "HUBLI": (15.3647, 75.1240),
    "BELLARY": (15.1394, 76.9214), "SHIMOGA": (13.9299, 75.5681),
    # Tamil Nadu
    "CHENNAI": (13.0827, 80.2707), "COIMBATORE": (11.0168, 76.9558),
    "MADURAI": (9.9252, 78.1198), "TIRUCHIRAPPALLI": (10.7905, 78.7047),
    "SALEM": (11.6643, 78.1460), "TIRUNELVELI": (8.7139, 77.7567),
    "VELLORE": (12.9165, 79.1325), "ERODE": (11.3410, 77.7172),
    # Gujarat
    "AHMEDABAD": (23.0225, 72.5714), "SURAT": (21.1702, 72.8311),
    "VADODARA": (22.3072, 73.1812), "RAJKOT": (22.3039, 70.8022),
    "BHAVNAGAR": (21.7645, 72.1519), "JAMNAGAR": (22.4707, 70.0577),
    "GANDHINAGAR": (23.2156, 72.6369), "ANAND": (22.5645, 72.9289),
    # Kerala
    "THIRUVANANTHAPURAM": (8.5241, 76.9366), "ERNAKULAM": (9.9816, 76.2999),
    "KOZHIKODE": (11.2588, 75.7804), "THRISSUR": (10.5276, 76.2144),
    "KANNUR": (11.8745, 75.3704), "KOLLAM": (8.8932, 76.6141),
    "PALAKKAD": (10.7867, 76.6548), "MALAPPURAM": (11.0510, 76.0711),
    # Odisha
    "BHUBANESWAR": (20.2961, 85.8245), "CUTTACK": (20.4625, 85.8830),
    "SAMBALPUR": (21.4669, 83.9812), "BERHAMPUR": (19.3150, 84.7941),
    "KORAPUT": (18.8135, 82.7110), "BALASORE": (21.4942, 86.9334),
    # Haryana
    "GURGAON": (28.4595, 77.0266), "FARIDABAD": (28.4089, 77.3178),
    "AMBALA": (30.3782, 76.7767), "HISAR": (29.1492, 75.7217),
    "ROHTAK": (28.8955, 76.6066), "PANIPAT": (29.3909, 76.9635),
    # Punjab
    "AMRITSAR": (31.6340, 74.8723), "LUDHIANA": (30.9010, 75.8573),
    "JALANDHAR": (31.3260, 75.5762), "PATIALA": (30.3398, 76.3869),
    "BATHINDA": (30.2110, 74.9455),
    # Jharkhand
    "RANCHI": (23.3441, 85.3096), "DHANBAD": (23.7957, 86.4304),
    "JAMSHEDPUR": (22.8046, 86.2029), "BOKARO": (23.6693, 86.1511),
    # Chhattisgarh
    "RAIPUR": (21.2514, 81.6296), "BILASPUR": (22.0797, 82.1391),
    "DURG": (21.1904, 81.2849), "KORBA": (22.3595, 82.7501),
    # Assam
    "GUWAHATI": (26.1445, 91.7362), "DIBRUGARH": (27.4728, 94.9120),
    "SILCHAR": (24.8333, 92.7789), "JORHAT": (26.7509, 94.2037),
    # Himachal Pradesh
    "SHIMLA": (31.1048, 77.1734), "KANGRA": (32.0998, 76.2691),
    "MANDI": (31.7090, 76.9320), "SOLAN": (30.9045, 77.0967),
    # Uttarakhand
    "DEHRADUN": (30.3165, 78.0322), "HARIDWAR": (29.9457, 78.1642),
    "NAINITAL": (29.3803, 79.4636), "UDHAM SINGH NAGAR": (28.9744, 79.5130),
}

# Crime type column mapping
CRIME_COLUMNS = {
    "Rape": "RAPE",
    "Kidnapping and Abduction": "KIDNAPPING_ABDUCTION",
    "Dowry Deaths": "DOWRY_DEATH",
    "Assault on women with intent to outrage her modesty": "ASSAULT_ON_WOMEN",
    "Insult to modesty of Women": "INSULT_TO_MODESTY",
    "Cruelty by Husband or his Relatives": "CRUELTY_BY_HUSBAND",
    "Importation of Girls": "IMPORTATION_OF_GIRLS",
}

SEVERITY_MAP = {
    "RAPE": "HIGH",
    "KIDNAPPING_ABDUCTION": "HIGH",
    "DOWRY_DEATH": "HIGH",
    "ASSAULT_ON_WOMEN": "MEDIUM",
    "INSULT_TO_MODESTY": "MEDIUM",
    "CRUELTY_BY_HUSBAND": "MEDIUM",
    "IMPORTATION_OF_GIRLS": "CRITICAL",
}

TIME_WEIGHTS = [0.10, 0.15, 0.30, 0.45]
TIME_LABELS = ["MORNING", "AFTERNOON", "EVENING", "NIGHT"]

def get_coords(district, state):
    """Get coordinates for a district, with fallback"""
    # Try exact match
    d = district.strip().upper()
    if d in DISTRICT_COORDS:
        return DISTRICT_COORDS[d]
    
    # Try partial match
    for key in DISTRICT_COORDS:
        if key in d or d in key:
            return DISTRICT_COORDS[key]
    
    # State-level fallback coords
    STATE_FALLBACK = {
        "ANDHRA PRADESH": (15.9129, 79.7400),
        "UTTAR PRADESH": (26.8467, 80.9462),
        "MADHYA PRADESH": (22.9734, 78.6569),
        "MAHARASHTRA": (19.7515, 75.7139),
        "WEST BENGAL": (22.9868, 87.8550),
        "BIHAR": (25.0961, 85.3131),
        "RAJASTHAN": (27.0238, 74.2179),
        "KARNATAKA": (15.3173, 75.7139),
        "TAMIL NADU": (11.1271, 78.6569),
        "GUJARAT": (22.2587, 71.1924),
        "DELHI": (28.6139, 77.2090),
        "KERALA": (10.8505, 76.2711),
        "ODISHA": (20.9517, 85.0985),
        "HARYANA": (29.0588, 76.0856),
        "PUNJAB": (31.1471, 75.3412),
        "JHARKHAND": (23.6102, 85.2799),
        "CHHATTISGARH": (21.2787, 81.8661),
        "ASSAM": (26.2006, 92.9376),
    }
    s = state.strip().upper()
    if s in STATE_FALLBACK:
        lat, lng = STATE_FALLBACK[s]
        # Add small random offset so not all points stack
        return (lat + np.random.uniform(-0.5, 0.5),
                lng + np.random.uniform(-0.5, 0.5))
    
    # Last resort - center of India
    return (20.5937 + np.random.uniform(-1, 1),
            78.9629 + np.random.uniform(-1, 1))

def generate_points(district, state, crime_type, count, year):
    """Generate synthetic crime point records"""
    if count <= 0:
        return []
    
    base_lat, base_lng = get_coords(district, state)
    points = []
    sigma = 0.12  # ~13km spread
    
    # Cap at 1 points per crime type per district per year to avoid DB overload
    capped_count = min(int(count), 1)
    
    for _ in range(capped_count):
        lat = float(np.random.normal(base_lat, sigma))
        lng = float(np.random.normal(base_lng, sigma))
        time_of_day = np.random.choice(TIME_LABELS, p=TIME_WEIGHTS)
        
        points.append({
            "district": district.strip().title(),
            "state": state.strip().title(),
            "latitude": round(lat, 6),
            "longitude": round(lng, 6),
            "crimeType": crime_type,
            "severity": SEVERITY_MAP[crime_type],
            "year": int(year),
            "timeOfDay": time_of_day,
            "caseCount": 1,
            "source": "synthetic",
        })
    
    return points

# ============================================================
# MAIN
# ============================================================
print("Reading CSV...")
df = pd.read_csv("crimes_against_women.csv")
print(f"Loaded {len(df)} rows")

all_points = []
skipped_districts = set()
total_rows = len(df)

for idx, row in df.iterrows():
    if idx % 500 == 0:
        print(f"Processing row {idx}/{total_rows}...")
    
    district = str(row.get("DISTRICT", "")).strip()
    state = str(row.get("STATE/UT", "")).strip()
    year = row.get("Year", 2001)
    
    if not district or district == "nan":
        continue
    
    # Check if we have coords for this district
    if district.upper() not in DISTRICT_COORDS:
        skipped_districts.add(f"{district} ({state})")
    
    for col, crime_type in CRIME_COLUMNS.items():
        try:
            count = int(row.get(col, 0))
        except (ValueError, TypeError):
            count = 0
        
        points = generate_points(district, state, crime_type, count, year)
        all_points.extend(points)

# Save to CSV
print(f"\nGenerated {len(all_points)} synthetic crime points")
output_df = pd.DataFrame(all_points)
output_df.to_csv("synthetic_crime_data.csv", index=False)
print("✅ Saved to synthetic_crime_data.csv")

# Save skipped districts for reference
if skipped_districts:
    print(f"\n⚠️  {len(skipped_districts)} districts used state fallback coords:")
    for d in sorted(list(skipped_districts))[:20]:
        print(f"   - {d}")
    print("   (These still get points, just less precise location)")

print("\nDone! Next step: seed this data into your database.")