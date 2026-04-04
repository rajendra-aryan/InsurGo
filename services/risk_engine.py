def calculate_risk_score(data):
    rainfall_score = min(data["rainfall_mm"] / 100, 1)
    aqi_score = min(data["aqi"] / 300, 1)
    claim_score = 1 if data["claim_amount"] > 300 else 0
    location_score = min(data["ip_distance_km"] / 50, 1)

    risk_score = (
        0.4 * rainfall_score + 0.3 * aqi_score + 0.2 * claim_score + 0.1 * location_score
    )

    return round(risk_score, 3)