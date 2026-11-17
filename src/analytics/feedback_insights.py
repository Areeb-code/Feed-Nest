
import pandas as pd


def generate_insights(df: pd.DataFrame, topic_names: dict) -> dict:
    if df is None or df.empty:
        raise ValueError("No feedback data provided.")

    required_columns = ["topic_id", "sentiment"]

    for column in required_columns:
        if column not in df.columns:
            raise ValueError(f"Missing required column: {column}.")

    total_reviews = len(df)

    # Overall sentiment distribution
    sentiment_distribution = (
        df["sentiment"]
        .value_counts()
        .to_dict()
    )

    # Calculate metrics for each discovered topic
    topic_metrics = []

    for topic_id, group in df.groupby("topic_id"):
        topic_id = int(topic_id)

        if topic_id == -1:
            continue

        total = len(group)

        negative_count = int(
            (group["sentiment"] == "negative").sum()
        )

        topic_metrics.append({
            "topic_id": topic_id,
            "topic_name": topic_names.get(
                topic_id, "Uncategorized Feedback"
            ),
            "total_reviews": total,
            "negative_reviews": negative_count,
            "negative_percentage": round(
                (negative_count / total) * 100, 2
            )
        })

    # Show topics with the highest negative percentage first
    topic_metrics.sort(
        key=lambda item: item["negative_percentage"],
        reverse=True
    )

    return {
        "total_reviews": total_reviews,
        "sentiment_distribution": sentiment_distribution,
        "topic_metrics": topic_metrics
    }
