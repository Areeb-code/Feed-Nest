
import pandas as pd
import numpy as np

from sentence_transformers import SentenceTransformer


MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_model = None


def generate_embeddings(df: pd.DataFrame) -> np.ndarray:
    """
    Convert customer reviews into semantic embeddings.

    Returns:
        numpy.ndarray: One embedding vector per review.
    """

    global _model

    if df is None or df.empty:
        raise ValueError("No feedback data provided.")

    if "cleaned_text" not in df.columns:
        raise ValueError("Missing required column: cleaned_text.")

    texts = df["cleaned_text"].astype("string").str.strip()

    if texts.isna().any() or texts.eq("").any():
        raise ValueError("Dataset contains empty cleaned reviews.")

    if _model is None:
        _model = SentenceTransformer(
            MODEL_NAME,
            device="cpu"
        )

    embeddings = _model.encode(
        texts.tolist(),
        batch_size=16,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True
    )

    return embeddings
