
from src.ingestion.csv_loader import load_csv
from src.ingestion.column_mapper import map_columns
from src.ingestion.dataset_profiler import profile_dataset

from src.preprocessing.cleaner import clean_reviews
from src.preprocessing.language_detector import detect_languages

from src.discovery.embeddings import generate_embeddings
from src.discovery.topic_model import discover_topics
from src.discovery.topic_naming import generate_topic_names

from src.sentiment.sentiment_analyzer import analyze_sentiment

from src.analytics.feedback_insights import generate_insights
from src.analytics.topic_trends import detect_emerging_topics
from src.analytics.topic_volume_trends import calculate_topic_trends
from src.analytics.recommendations import generate_recommendations


def analyze_feedback(source, column_mapping, previous_topics=None):

    # 1. Load and map the uploaded CSV
    df = load_csv(source)
    df = map_columns(df, column_mapping)

    # 2. Clean feedback
    df = clean_reviews(df)

    # 3. Detect languages and profile the dataset
    df = detect_languages(df)
    dataset_profile = profile_dataset(df)

    # 4. Generate embeddings
    embeddings = generate_embeddings(df)

    # 5. Discover and name topics
    topic_model, df, topic_info = discover_topics(
        df, embeddings
    )

    topic_names = generate_topic_names(topic_model)

    # 6. Analyze sentiment
    df = analyze_sentiment(df)

    # 7. Generate business insights
    insights = generate_insights(df, topic_names)

    # 8. Generate recommendations
    recommendations = generate_recommendations(
        insights["topic_metrics"]
    )

    # 9. Prepare topics for emerging-topic detection
    current_topics = []

    for _, row in topic_info.iterrows():

        topic_id = int(row["Topic"])

        if topic_id == -1:
            continue

        keywords = topic_model.get_topic(topic_id) or []

        current_topics.append({
            "topic_name": topic_names.get(
                topic_id, "Uncategorized Feedback"
            ),
            "keywords": [word for word, score in keywords[:10]],
            "review_count": int(row["Count"])
        })

    # 10. Compare against previous analysis, if available
    emerging_topics = []

    if previous_topics is not None:
        emerging_topics = detect_emerging_topics(
            current_topics,
            previous_topics
        )

    # 11. Calculate monthly trends if dates are available
    topic_trends = []

    if "date" in df.columns:
        topic_trends = calculate_topic_trends(df)

    return {
        "dataset_profile": dataset_profile,
        "analyzed_data": df,
        "topic_info": topic_info,
        "topic_names": topic_names,
        "insights": insights,
        "emerging_topics": emerging_topics,
        "topic_trends": topic_trends,
        "recommendations": recommendations,
        "topic_model": topic_model
    }
