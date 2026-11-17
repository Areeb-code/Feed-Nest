
def detect_emerging_topics(
    current_topics: list,
    previous_topics: list,
    min_reviews: int = 5,
    similarity_threshold: float = 0.3
) -> list:

    def get_keywords(topic):
        return {
            str(word).lower().strip()
            for word in topic.get("keywords", [])
            if str(word).strip()
        }

    emerging_topics = []

    previous_keyword_sets = [
        get_keywords(topic)
        for topic in previous_topics
    ]

    for topic in current_topics:
        keywords = get_keywords(topic)
        review_count = topic.get("review_count", 0)

        if not keywords or review_count < min_reviews:
            continue

        max_similarity = 0.0

        for previous_keywords in previous_keyword_sets:
            if not previous_keywords:
                continue

            intersection = keywords & previous_keywords
            union = keywords | previous_keywords

            similarity = len(intersection) / len(union)

            max_similarity = max(
                max_similarity,
                similarity
            )

        if max_similarity < similarity_threshold:
            emerging_topics.append({
                "topic_name": topic.get(
                    "topic_name", "Unnamed Topic"
                ),
                "keywords": sorted(keywords),
                "review_count": review_count,
                "similarity_to_previous": round(
                    max_similarity, 3
                )
            })

    return emerging_topics
