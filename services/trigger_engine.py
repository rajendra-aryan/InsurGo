def check_triggers(data):

    triggers = []

    if data["rainfall_mm"] > 60:
        triggers.append("HEAVY_RAIN")

    if data["aqi"] > 300:
        triggers.append("POLLUTION")

    if data["distance_moved_m"] < 200 and data["is_active"] == 1:
        triggers.append("LOW_ACTIVITY")

    return {
        "triggered": len(triggers) > 0,
        "reasons": triggers
    }
