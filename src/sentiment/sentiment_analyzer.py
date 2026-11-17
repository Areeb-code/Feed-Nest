
import pandas as pd
from transformers import pipeline

MODEL_NAME = "Horizon-Labs/multilingual-sentiment-small"

_sentiment_pipeline = None


def get_sentiment_pipeline():
    global _sentiment_pipeline

    if _sentiment_pipeline is None:
        _sentiment_pipeline = pipeline(
            "text-classification",
            model=MODEL_NAME,
            device=-1
        )

    return _sentiment_pipeline


def analyze_sentiment(df: pd.DataFrame) -> pd.DataFrame:
    if df is None or df.empty:
        raise ValueError("No feedback data provided.")

    if "cleaned_text" not in df.columns:
        raise ValueError("Missing required column: cleaned_text.")

    texts = df["cleaned_text"].astype("string").str.strip()

    if texts.isna().any() or texts.eq("").any():
        raise ValueError("Dataset contains empty reviews.")

    classifier = get_sentiment_pipeline()

    predictions = classifier(
        texts.tolist(),
        batch_size=8,
        truncation=True,
        max_length=512
    )

    result_df = df.copy()

    result_df["sentiment"] = [
        prediction["label"].lower()
        for prediction in predictions
    ]

    result_df["sentiment_score"] = [
        round(float(prediction["score"]), 4)
        for prediction in predictions
    ]

    return result_df
