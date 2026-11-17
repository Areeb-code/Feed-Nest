
def generate_topic_names(topic_model):
    """
    Generate readable names for BERTopic topics
    using their representative keywords.
    """

    if topic_model is None:
        raise ValueError("No trained topic model provided.")

    topic_info = topic_model.get_topic_info()

    topic_names = {}

    for _, row in topic_info.iterrows():

        topic_id = int(row["Topic"])

        # Ignore outliers
        if topic_id == -1:
            continue

        topic_words = topic_model.get_topic(topic_id)

        if not topic_words:
            topic_names[topic_id] = "Uncategorized Feedback"
            continue

        # Extract the five most representative words
        keywords = [
            word for word, score in topic_words[:5]
        ]

        # Create a readable initial label
        name = " ".join(keywords[:3]).title()

        topic_names[topic_id] = name

    return topic_names
