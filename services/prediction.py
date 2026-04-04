import pandas as pd

def predict_premium(data, model):
    expected_features = list(getattr(model, "feature_names_in_", []))
    if expected_features:
        row = {feature: data.get(feature, 0) for feature in expected_features}
        df = pd.DataFrame([row], columns=expected_features)
    else:
        df = pd.DataFrame([data])
    prediction = model.predict(df)[0]
    return round(prediction, 2)
