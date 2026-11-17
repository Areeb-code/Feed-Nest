
import pandas as pd


def profile_dataset(df: pd.DataFrame) -> dict:
    """
    Generate an overview of an uploaded feedback dataset.
    """

    if df is None or df.empty:
        raise ValueError("No dataset available for profiling.")

    if "review_text" not in df.columns:
        raise ValueError("Missing required column: review_text.")

    total_reviews = len(df)

    # Missing values
    missing_values = df.isnull().sum().to_dict()

    # Language distribution
    language_distribution = {}

    if "language" in df.columns:
        language_distribution = (
            df["language"]
            .fillna("unknown")
            .value_counts(normalize=True)
            .mul(100)
            .round(2)
            .to_dict()
        )

    # Rating statistics
    rating_stats = None

    if "rating" in df.columns:
        ratings = pd.to_numeric(df["rating"], errors="coerce").dropna()

        if not ratings.empty:
            rating_stats = {
                "average": round(float(ratings.mean()), 2),
                "minimum": float(ratings.min()),
                "maximum": float(ratings.max()),
                "count": int(len(ratings))
            }

    # Date range
    date_range = None

    if "date" in df.columns:
        dates = pd.to_datetime(df["date"], errors="coerce").dropna()

        if not dates.empty:
            date_range = {
                "start": str(dates.min().date()),
                "end": str(dates.max().date())
            }

    # Dataset warnings
    warnings = []

    if missing_values.get("review_text", 0) > 0:
        warnings.append("Some reviews have missing text.")

    if "rating" not in df.columns:
        warnings.append("Rating information is unavailable.")

    if "date" not in df.columns:
        warnings.append("Date information is unavailable.")

    return {
        "total_reviews": total_reviews,
        "columns": list(df.columns),
        "missing_values": missing_values,
        "language_distribution": language_distribution,
        "rating_statistics": rating_stats,
        "date_range": date_range,
        "warnings": warnings
    }
