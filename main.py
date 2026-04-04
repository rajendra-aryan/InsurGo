from fastapi import FastAPI
import joblib

from services.risk_engine import calculate_risk_score
from services.trigger_engine import check_triggers
from services.prediction import predict_premium

app = FastAPI()

model = joblib.load("model/premium_model1B.pkl")


@app.get("/health")
def health():
    return {
        "status": "OK",
        "service": "insurgo-ml",
        "model_loaded": model is not None,
        "model_version": "premium_model1B.pkl",
    }


@app.post("/insurance-decision")
def insurance_decision(data: dict):

    risk_score = calculate_risk_score(data)
    data["risk_score"] = risk_score

    premium = predict_premium(data, model)

    trigger = check_triggers(data)

    return {
        "risk_score": risk_score,
        "predicted_premium": premium,
        "claim_triggered": trigger["triggered"],
        "reasons": trigger["reasons"]
    }
