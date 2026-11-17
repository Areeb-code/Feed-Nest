
import pandas as pd


def clean_reviews(df: pd.DataFrame) -> pd.DataFrame:

    if df is None or df.empty:
        raise ValueError("No feedback data provided.")

    if "review_text" not in df.columns:
        raise ValueError("Missing required column: review_text.")

    cleaned_df = df.copy()

    # Remove reviews with missing text
    cleaned_df = cleaned_df.dropna(
        subset=["review_text"]
    )

    # Create a separate cleaned text column
    cleaned_df["cleaned_text"] = (
        cleaned_df["review_text"]
        .astype(str)
        .str.replace(r"\s+", " ", regex=True)
        .str.strip()
    )

    # Remove empty reviews
    cleaned_df = cleaned_df[
        cleaned_df["cleaned_text"] != ""
    ]

    # Remove duplicate reviews using cleaned text
    cleaned_df = cleaned_df.drop_duplicates(
        subset=["cleaned_text"],
        keep="first"
    )

    cleaned_df = cleaned_df.reset_index(drop=True)

    if cleaned_df.empty:
        raise ValueError(
            "No valid reviews remain after cleaning."
        )

    return cleaned_df
