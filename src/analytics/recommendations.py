
def generate_recommendations(
    topic_metrics: list,
    min_reviews: int = 5,
    negative_threshold: float = 40.0
) -> list:

    recommendations = []

    for topic in topic_metrics:

        name = topic.get(
            "topic_name", "Unknown Topic"
        )

        total = topic.get("total_reviews", 0)

        negative_percentage = topic.get(
            "negative_percentage", 0
        )

        if total < min_reviews:
            continue

        if negative_percentage >= negative_threshold:

            recommendations.append({
                "topic_name": name,
                "priority": "high",
                "message": (
                    f"{negative_percentage}% of feedback "
                    f"about {name} is negative. "
                    "Investigate this area."
                ),
                "evidence": {
                    "total_reviews": total,
                    "negative_percentage": negative_percentage
                }
            })

        elif negative_percentage >= 20:

            recommendations.append({
                "topic_name": name,
                "priority": "medium",
                "message": (
                    f"{name} has a noticeable amount of "
                    "negative feedback. Monitor this area."
                ),
                "evidence": {
                    "total_reviews": total,
                    "negative_percentage": negative_percentage
                }
            })

    return recommendations
