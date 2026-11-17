
import pandas as pd
from bertopic import BERTopic
from umap import UMAP
from hdbscan import HDBSCAN
from sklearn.feature_extraction.text import CountVectorizer


def discover_topics(df: pd.DataFrame, embeddings):

    if df is None or df.empty:
        raise ValueError("No feedback data provided.")

    if "cleaned_text" not in df.columns:
        raise ValueError("Missing required column: cleaned_text.")

    documents = df["cleaned_text"].tolist()

    if len(documents) < 10:
        raise ValueError("At least 10 reviews are required.")

    if len(embeddings) != len(documents):
        raise ValueError(
            "Number of embeddings does not match number of reviews."
        )

    n_neighbors = min(15, len(documents) - 1)
    n_components = min(5, len(documents) - 2)

    umap_model = UMAP(
        n_neighbors=n_neighbors,
        n_components=n_components,
        min_dist=0.0,
        metric="cosine",
        random_state=42
    )

    hdbscan_model = HDBSCAN(
        min_cluster_size=5,
        min_samples=3,
        metric="euclidean",
        cluster_selection_method="eom",
        prediction_data=True
    )

    # No English-only stop-word restriction
    vectorizer_model = CountVectorizer(
        ngram_range=(1, 2),
        min_df=2,
        max_features=10000
    )

    topic_model = BERTopic(
        embedding_model=None,
        umap_model=umap_model,
        hdbscan_model=hdbscan_model,
        vectorizer_model=vectorizer_model,
        calculate_probabilities=False,
        verbose=True
    )

    topics, probabilities = topic_model.fit_transform(
        documents,
        embeddings
    )

    result_df = df.copy()
    result_df["topic_id"] = topics

    topic_info = topic_model.get_topic_info()

    return topic_model, result_df, topic_info
