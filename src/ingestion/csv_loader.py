
import pandas as pd


def load_csv(source):
    """
    Load a CSV file and perform basic validation.
    """

    if source is None:
        raise ValueError("No CSV file was provided.")

    try:
        df = pd.read_csv(source)

    except pd.errors.EmptyDataError:
        raise ValueError("The uploaded CSV file is empty.")

    except Exception as e:
        raise ValueError(f"Could not read the CSV file: {e}")

    if df.empty:
        raise ValueError("The CSV file contains no records.")

    if len(df.columns) == 0:
        raise ValueError("The CSV file contains no columns.")

    return df
