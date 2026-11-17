
import pandas as pd


def calculate_topic_trends(
    df: pd.DataFrame,
    date_column: str = "date"
) -> list:

    required_columns = ["topic_id", date_column]

    for column in required_columns:
        if column not in df.columns:
            raise ValueError(f"Missing required column: {column}.")

    data = df.copy()

    data[date_column] = pd.to_datetime(
        data[date_column],
        errors="coerce"
    )

    data = data.dropna(subset=[date_column])

    if data.empty:
        return []

    data["period"] = data[date_column].dt.to_period("M")

    trends = []

    for topic_id, group in data.groupby("topic_id"):

        if topic_id == -1:
            continue

        monthly_counts = (
            group.groupby("period")
            .size()
            .sort_index()
        )

        if len(monthly_counts) < 2:
            continue

        previous_count = int(monthly_counts.iloc[-2])
        current_count = int(monthly_counts.iloc[-1])

        if previous_count == 0:
            percentage_change = None
        else:
            percentage_change = round(
                ((current_count - previous_count)
                 / previous_count) * 100,
                2
            )

        trends.append({
            "topic_id": int(topic_id),
            "previous_month_reviews": previous_count,
            "current_month_reviews": current_count,
            "change_percentage": percentage_change
        })

    return trends
