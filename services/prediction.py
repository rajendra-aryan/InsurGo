import pandas as pd

def predict_premium(data, model):
    df = pd.DataFrame([data])
    prediction = model.predict(df)[0]
    return round(prediction, 2)