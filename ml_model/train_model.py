
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
import sklearn

from sklearn.model_selection import train_test_split
from sklearn.tree import DecisionTreeClassifier
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)


FEATURE_COLUMNS = [
    "current_stock",
    "minimum_stock",
    "average_daily_usage",
    "average_daily_waste",
    "lead_time_days",
]

TARGET_COLUMN = "stock_status"

CLASS_LABELS = [
    "Restock",
    "Sufficient",
    "Excess",
]


def json_serializer(obj):
    """
    Konversi tipe data NumPy/Pandas agar bisa
    disimpan menggunakan json.dump().
    """
    if isinstance(obj, np.integer):
        return int(obj)

    if isinstance(obj, np.floating):
        return float(obj)

    if isinstance(obj, np.bool_):
        return bool(obj)

    if isinstance(obj, np.ndarray):
        return obj.tolist()

    if isinstance(obj, pd.Timestamp):
        return obj.isoformat()

    raise TypeError(
        f"Object of type {type(obj).__name__} "
        "is not JSON serializable"
    )


def train_model(
    dataset_path: str,
    model_path: str,
    metrics_path: str,
    test_size: float = 0.2,
    seed: int = 42,
    max_depth: int = 8,
) -> None:

    if not 0 < test_size < 1:
        raise ValueError(
            "test_size harus lebih dari 0 "
            "dan kurang dari 1."
        )

    if max_depth < 1:
        raise ValueError(
            "max_depth minimal 1."
        )

    dataset_file = Path(dataset_path)

    if not dataset_file.is_file():
        raise FileNotFoundError(
            f"Dataset tidak ditemukan: {dataset_file}"
        )

    dataset = pd.read_csv(dataset_file)

    required_columns = set(
        FEATURE_COLUMNS + [TARGET_COLUMN]
    )

    missing = required_columns - set(dataset.columns)

    if missing:
        raise ValueError(
            "Kolom dataset tidak lengkap: "
            f"{sorted(missing)}"
        )

    if dataset.empty:
        raise ValueError("Dataset kosong.")

    X = dataset[FEATURE_COLUMNS].copy()
    y = dataset[TARGET_COLUMN].copy()

    # Validasi fitur numerik.
    for column in FEATURE_COLUMNS:
        X[column] = pd.to_numeric(
            X[column],
            errors="raise",
        )

    if X.isna().any().any():
        raise ValueError(
            "Dataset memiliki nilai fitur kosong."
        )

    if not np.isfinite(X.to_numpy()).all():
        raise ValueError(
            "Dataset memiliki nilai fitur tidak valid."
        )

    if (X < 0).any().any():
        raise ValueError(
            "Fitur numerik tidak boleh negatif."
        )

    if not np.all(
        X["lead_time_days"]
        == np.floor(X["lead_time_days"])
    ):
        raise ValueError(
            "lead_time_days harus bilangan bulat."
        )

    # Validasi label.
    if y.isna().any():
        raise ValueError(
            "Label stock_status tidak boleh kosong."
        )

    unknown_labels = set(y.unique()) - set(CLASS_LABELS)

    if unknown_labels:
        raise ValueError(
            f"Label tidak dikenal: {sorted(unknown_labels)}"
        )

    class_counts = y.value_counts()

    if set(class_counts.index) != set(CLASS_LABELS):
        raise ValueError(
            "Dataset harus memiliki ketiga kelas: "
            "Restock, Sufficient, dan Excess."
        )

    if (class_counts < 2).any():
        raise ValueError(
            "Setiap kelas minimal memiliki 2 sampel."
        )

    # Pembagian training dan testing.
    try:
        X_train, X_test, y_train, y_test = (
            train_test_split(
                X,
                y,
                test_size=test_size,
                random_state=seed,
                stratify=y,
            )
        )
    except ValueError as error:
        raise ValueError(
            "Gagal membagi dataset. Periksa jumlah "
            "sampel tiap kelas dan test_size."
        ) from error

    # Training Decision Tree Classifier.
    model = DecisionTreeClassifier(
        criterion="gini",
        max_depth=max_depth,
        min_samples_leaf=5,
        random_state=seed,
    )

    model.fit(X_train, y_train)

    # Evaluasi pada data testing.
    predictions = model.predict(X_test)

    accuracy = accuracy_score(
        y_test,
        predictions,
    )

    report = classification_report(
        y_test,
        predictions,
        labels=CLASS_LABELS,
        output_dict=True,
        zero_division=0,
    )

    matrix = confusion_matrix(
        y_test,
        predictions,
        labels=CLASS_LABELS,
    )

    feature_importances = {
        feature: float(importance)
        for feature, importance in zip(
            FEATURE_COLUMNS,
            model.feature_importances_,
        )
    }

    # Metadata hasil training.
    metadata = {
        "model_type": "DecisionTreeClassifier",
        "dataset_type": "synthetic_rule_labeled",
        "created_at_utc": datetime.now(
            timezone.utc
        ).isoformat(),
        "scikit_learn_version": sklearn.__version__,
        "features": FEATURE_COLUMNS,
        "classes": CLASS_LABELS,
        "training_samples": int(len(X_train)),
        "testing_samples": int(len(X_test)),
        "random_seed": int(seed),
        "test_size": float(test_size),
        "max_depth": int(max_depth),
        "actual_tree_depth": int(model.get_depth()),
        "leaf_count": int(model.get_n_leaves()),
        "accuracy": float(accuracy),
        "classification_report": report,
        "confusion_matrix": matrix.tolist(),
        "feature_importances": feature_importances,
        "limitations": (
            "Model trained and tested on synthetic "
            "data labeled by predefined inventory rules. "
            "Metrics do not establish real-world "
            "demand forecasting accuracy."
        ),
    }

    model_output = Path(model_path)
    metrics_output = Path(metrics_path)

    model_output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    metrics_output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Simpan model bersama konfigurasi fitur.
    model_bundle = {
        "model": model,
        "feature_columns": FEATURE_COLUMNS,
        "class_labels": CLASS_LABELS,
        "model_type": "DecisionTreeClassifier",
        "dataset_type": "synthetic_rule_labeled",
    }

    joblib.dump(
        model_bundle,
        model_output,
    )

    # Simpan metrics sebagai JSON.
    with open(
        metrics_output,
        "w",
        encoding="utf-8",
    ) as file:
        json.dump(
            metadata,
            file,
            indent=2,
            ensure_ascii=False,
            default=json_serializer,
            allow_nan=False,
        )

    # Output terminal.
    print("\n=== PANTRYOVEN AI TRAINING ===")

    print(f"Total dataset : {len(dataset)}")
    print(f"Training data : {len(X_train)}")
    print(f"Testing data  : {len(X_test)}")

    print("\n=== MODEL ===")
    print("Algorithm : Decision Tree Classifier")
    print(f"Max depth : {max_depth}")
    print(f"Tree depth: {model.get_depth()}")
    print(f"Leaves    : {model.get_n_leaves()}")

    print("\n=== EVALUATION ===")
    print(f"Accuracy: {accuracy:.4f}")

    print(
        classification_report(
            y_test,
            predictions,
            labels=CLASS_LABELS,
            zero_division=0,
        )
    )

    print("Confusion matrix:")
    print(
        pd.DataFrame(
            matrix,
            index=CLASS_LABELS,
            columns=CLASS_LABELS,
        ).to_string()
    )

    print("\n=== FEATURE IMPORTANCE ===")

    for feature, importance in sorted(
        feature_importances.items(),
        key=lambda item: item[1],
        reverse=True,
    ):
        print(f"{feature}: {importance:.4f}")

    print("\n=== SAVED FILES ===")
    print(f"Model   : {model_output}")
    print(f"Metrics : {metrics_output}")

    print(
        "\nCatatan: Evaluasi ini menggunakan "
        "label sintetis berbasis aturan, "
        "bukan permintaan nyata."
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Train PantryOven Decision Tree "
            "stock classification model."
        )
    )

    parser.add_argument(
        "--dataset",
        default="ml_model/data/training_dataset.csv",
    )

    parser.add_argument(
        "--model",
        default="ml_model/models/stock_classifier.joblib",
    )

    parser.add_argument(
        "--metrics",
        default="ml_model/models/training_metrics.json",
    )

    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=42,
    )

    parser.add_argument(
        "--max-depth",
        type=int,
        default=8,
    )

    args = parser.parse_args()

    train_model(
        dataset_path=args.dataset,
        model_path=args.model,
        metrics_path=args.metrics,
        test_size=args.test_size,
        seed=args.seed,
        max_depth=args.max_depth,
    )
