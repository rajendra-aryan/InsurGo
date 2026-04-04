import pandas as pd

UNKNOWN_FEATURE_DEFAULT = 0

MODEL_DEFAULTS = {
    # Defaults are only used when a model-expected feature is absent from payload.
    # Values mirror backend fallback behavior to keep inference robust:
    # temperature/speed unknown -> 0, no GPS movement info -> 500m and non-low-movement.
    # Backend normally supplies distance_moved_m explicitly (150m with GPS / 500m without GPS),
    # so 500 here is a no-context fallback only when upstream omitted the field.
    # high_risk_zone defaults to 0 unless explicitly inferred upstream.
    "temperature": 0,
    "speed_kmh": 0,
    "distance_moved_m": 500,
    "low_movement": 0,
    "high_risk_zone": 0,
}


def predict_premium(data, model):
    expected_features = list(getattr(model, "feature_names_in_", []))
    if expected_features:
        row = {
            feature: data.get(feature, MODEL_DEFAULTS.get(feature, UNKNOWN_FEATURE_DEFAULT))
            for feature in expected_features
        }
        df = pd.DataFrame([row], columns=expected_features)
    else:
        df = pd.DataFrame([data])
    prediction = model.predict(df)[0]
    return round(prediction, 2)
