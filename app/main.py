import json
from pathlib import Path

import numpy as np
import pandas as pd

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.encoders import jsonable_encoder
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from src.pipeline.analysis_pipeline import analyze_feedback
from app.database import (
    initialize_database,
    save_analysis,
    get_analysis,
    get_analysis_history,
)


STATIC_DIR = Path(__file__).resolve().parent / "static"

app = FastAPI(
    title="Feed Nest API",
    description="Customer Feedback Intelligence Platform",
    version="1.0.0",
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.on_event("startup")
def startup():
    """Prepare the local database when the API starts."""
    initialize_database()


@app.get("/", include_in_schema=False)
def home():
    """Serve the Feed Nest frontend."""
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/api/health")
def health_check():
    return {
        "message": "Feed Nest API is running",
        "status": "running",
    }


@app.post("/analyze")
def analyze_dataset(
    file: UploadFile = File(...),
    column_mapping: str = Form(...),
):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Only CSV files are supported.",
        )

    try:
        mapping = json.loads(column_mapping)
        if not isinstance(mapping, dict):
            raise ValueError("Mapping must be a JSON object.")
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(
            status_code=400,
            detail="Invalid column mapping.",
        )

    try:
        file.file.seek(0)
        results = analyze_feedback(
            source=file.file,
            column_mapping=mapping,
        )

        analyzed_df = results["analyzed_data"]
        topic_info_df = results["topic_info"]

        analyzed_data = (
            analyzed_df.astype(object)
            .where(pd.notna(analyzed_df), None)
            .to_dict(orient="records")
        )
        topic_info = (
            topic_info_df.astype(object)
            .where(pd.notna(topic_info_df), None)
            .to_dict(orient="records")
        )

        response = {
            "dataset_profile": results["dataset_profile"],
            "analyzed_data": analyzed_data,
            "topic_info": topic_info,
            "topic_names": results["topic_names"],
            "insights": results["insights"],
            "emerging_topics": results["emerging_topics"],
            "topic_trends": results["topic_trends"],
            "recommendations": results["recommendations"],
        }

        encoded_response = jsonable_encoder(
            response,
            custom_encoder={
                pd.Timestamp: lambda value: value.isoformat(),
                np.integer: int,
                np.floating: float,
                np.bool_: bool,
            },
        )

        analysis_id = save_analysis(
            filename=file.filename,
            results=encoded_response,
        )

        return {
            "analysis_id": analysis_id,
            **encoded_response,
        }

    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error))
    except Exception as error:
        # Keep technical details in the server console, not in the browser response.
        print(f"Feed Nest analysis failed: {error}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during analysis. Check the backend console.",
        )
    finally:
        file.file.close()


@app.get("/analyses")
def analysis_history():
    return {"analyses": get_analysis_history()}


@app.get("/analyses/{analysis_id}")
def retrieve_analysis(analysis_id: int):
    result = get_analysis(analysis_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Analysis not found.")
    return result
