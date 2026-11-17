
import pandas as pd


REQUIRED_COLUMNS = ["review_text"]

OPTIONAL_COLUMNS = [
    "rating",
    "date",
    "product",
    "source"
]


def map_columns(df: pd.DataFrame, mapping: dict) -> pd.DataFrame:
    """
    Rename uploaded CSV columns to Feed Nest's standard names.

    Args:
        df: Uploaded feedback DataFrame.
        mapping: Dictionary mapping original column names
                 to Feed Nest column names.

    Returns:
        DataFrame with standardized column names.
    """

    if df is None or df.empty:
        raise ValueError("No data available for column mapping.")

    if not isinstance(mapping, dict):
        raise ValueError("Column mapping must be a dictionary.")

    valid_targets = REQUIRED_COLUMNS + OPTIONAL_COLUMNS

    for original, target in mapping.items():

        if original not in df.columns:
            raise ValueError(
                f"Column '{original}' does not exist in the CSV."
            )

        if target not in valid_targets:
            raise ValueError(
                f"'{target}' is not a supported Feed Nest column."
            )

    targets = list(mapping.values())

    if len(targets) != len(set(targets)):
        raise ValueError("Multiple CSV columns cannot map to the same field.")

    if "review_text" not in targets:
        raise ValueError("A column must be mapped to 'review_text'.")

    mapped_df = df.rename(columns=mapping).copy()

    return mapped_df
