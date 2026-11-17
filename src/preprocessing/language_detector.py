
import pandas as pd
from lingua import Language, LanguageDetectorBuilder


# Languages relevant to our initial use case
detector = LanguageDetectorBuilder.from_languages(
    Language.ENGLISH,
    Language.URDU,
    Language.ARABIC,
    Language.HINDI,
    Language.FRENCH,
    Language.SPANISH,
    Language.GERMAN
).build()


def detect_languages(df: pd.DataFrame) -> pd.DataFrame:
    """
    Detect the language of each review.
    """

    if df is None or df.empty:
        raise ValueError("No feedback data provided.")

    if "cleaned_text" not in df.columns:
        raise ValueError("Missing required column: cleaned_text.")

    result = df.copy()

    def detect(text):
        if not isinstance(text, str) or not text.strip():
            return "unknown"

        language = detector.detect_language_of(text)

        if language is None:
            return "unknown"

        return language.name.lower()

    result["language"] = result["cleaned_text"].apply(detect)

    return result
