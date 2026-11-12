
import argparse
from pathlib import Path

import numpy as np
import pandas as pd


# ==========================================
# CONFIGURATION
# ==========================================

FEATURE_COLUMNS = [
    "current_stock",
    "minimum_stock",
    "average_daily_usage",
    "average_daily_waste",
    "lead_time_days",
]

LABEL_COLUMN = "stock_status"

VALID_LABELS = {
    "Restock",
    "Sufficient",
    "Excess",
}

DEFAULT_SAMPLES = 5000
DEFAULT_SEED = 42

SAFETY_BUFFER_DAYS = 3
EXCESS_COVERAGE_DAYS = 45


# ==========================================
# STOCK CLASSIFICATION RULES
# ==========================================

def classify_stock(
    current_stock: float,
    minimum_stock: float,
    average_daily_usage: float,
    average_daily_waste: float,
    lead_time_days: int,
) -> str:
    """
    Aturan simulasi untuk membuat label training.

    RESTOCK:
    Stok berada di bawah atau sama dengan
    reorder threshold.

    SUFFICIENT:
    Stok berada di atas reorder threshold,
    tetapi belum mencapai excess threshold.

    EXCESS:
    Stok melebihi excess threshold,
    selama tidak memenuhi aturan restock.

    Catatan:
    Label berasal dari aturan simulasi,
    bukan observasi operasional nyata.
    """

    values = [
        current_stock,
        minimum_stock,
        average_daily_usage,
        average_daily_waste,
    ]

    if any(
        not np.isfinite(value) or value < 0
        for value in values
    ):
        raise ValueError(
            "Nilai stok, minimum, penggunaan, "
            "dan waste harus finite dan >= 0."
        )

    if (
        isinstance(lead_time_days, (bool, np.bool_))
        or not isinstance(
            lead_time_days,
            (int, np.integer),
        )
        or not 1 <= lead_time_days <= 365
    ):
        raise ValueError(
            "lead_time_days harus integer 1-365."
        )

    daily_depletion = (
        average_daily_usage
        + average_daily_waste
    )

    reorder_threshold = max(
        minimum_stock,
        daily_depletion
        * (lead_time_days + SAFETY_BUFFER_DAYS),
    )

    if current_stock <= reorder_threshold:
        return "Restock"

    excess_threshold = max(
        minimum_stock * 2,
        daily_depletion * EXCESS_COVERAGE_DAYS,
    )

    if current_stock > excess_threshold:
        return "Excess"

    return "Sufficient"


# ==========================================
# DATASET GENERATION
# ==========================================

def generate_dataset(
    samples: int = DEFAULT_SAMPLES,
    seed: int = DEFAULT_SEED,
) -> pd.DataFrame:
    """
    Membuat dataset sintetis untuk
    PantryOven Decision Tree Classifier.
    """

    if samples < 100:
        raise ValueError(
            "Jumlah samples minimal 100."
        )

    rng = np.random.default_rng(seed)

    # --------------------------------------
    # STEP 1: GENERATE BASE FEATURES
    # --------------------------------------

    minimum_stock = rng.uniform(
        2,
        50,
        samples,
    ).round(2)

    average_daily_usage = rng.uniform(
        0.1,
        15,
        samples,
    ).round(3)

    average_daily_waste = rng.uniform(
        0,
        2,
        samples,
    ).round(3)

    lead_time_days = rng.integers(
        1,
        15,
        samples,
    )

    daily_depletion = (
        average_daily_usage
        + average_daily_waste
    )

    # --------------------------------------
    # STEP 2: CALCULATE THRESHOLDS
    # --------------------------------------

    reorder_threshold = np.maximum(
        minimum_stock,
        daily_depletion
        * (
            lead_time_days
            + SAFETY_BUFFER_DAYS
        ),
    )

    excess_threshold = np.maximum(
        minimum_stock * 2,
        daily_depletion
        * EXCESS_COVERAGE_DAYS,
    )

    # --------------------------------------
    # STEP 3: GENERATE STOCK VARIATIONS
    # --------------------------------------

    stock_multiplier = rng.uniform(
        0,
        65,
        samples,
    )

    current_stock = (
        daily_depletion
        * stock_multiplier
    ).round(2)

    # Variasi di sekitar minimum stock.
    near_minimum = (
        rng.random(samples) < 0.20
    )

    current_stock[near_minimum] = (
        minimum_stock[near_minimum]
        * rng.uniform(
            0.4,
            2.5,
            near_minimum.sum(),
        )
    ).round(2)

    # Variasi di sekitar reorder threshold.
    near_reorder = (
        rng.random(samples) < 0.20
    )

    current_stock[near_reorder] = (
        reorder_threshold[near_reorder]
        * rng.uniform(
            0.8,
            1.2,
            near_reorder.sum(),
        )
    ).round(2)

    # Variasi di sekitar excess threshold.
    near_excess = (
        rng.random(samples) < 0.20
    )

    current_stock[near_excess] = (
        excess_threshold[near_excess]
        * rng.uniform(
            0.8,
            1.2,
            near_excess.sum(),
        )
    ).round(2)

    # --------------------------------------
    # STEP 4: VECTORIZE LABEL GENERATION
    # --------------------------------------

    labels = np.where(
        current_stock <= reorder_threshold,
        "Restock",
        np.where(
            current_stock > excess_threshold,
            "Excess",
            "Sufficient",
        ),
    )

    # --------------------------------------
    # STEP 5: BUILD DATAFRAME
    # --------------------------------------

    dataset = pd.DataFrame(
        {
            "current_stock": current_stock,
            "minimum_stock": minimum_stock,
            "average_daily_usage":
                average_daily_usage,
            "average_daily_waste":
                average_daily_waste,
            "lead_time_days":
                lead_time_days,
            LABEL_COLUMN: labels,
        }
    )

    # --------------------------------------
    # STEP 6: VALIDATE DATASET
    # --------------------------------------

    validate_dataset(dataset)

    return dataset


# ==========================================
# DATASET VALIDATION
# ==========================================

def validate_dataset(
    dataset: pd.DataFrame,
) -> None:
    """
    Memastikan dataset siap digunakan
    untuk proses training.
    """

    expected_columns = (
        FEATURE_COLUMNS + [LABEL_COLUMN]
    )

    if list(dataset.columns) != expected_columns:
        raise ValueError(
            "Struktur kolom dataset tidak sesuai."
        )

    if dataset.empty:
        raise ValueError(
            "Dataset tidak boleh kosong."
        )

    if dataset.isnull().any().any():
        raise ValueError(
            "Dataset mengandung missing values."
        )

    features = dataset[
        FEATURE_COLUMNS
    ].to_numpy(dtype=float)

    if not np.isfinite(features).all():
        raise ValueError(
            "Dataset mengandung nilai "
            "numerik tidak valid."
        )

    if (features < 0).any():
        raise ValueError(
            "Dataset mengandung nilai negatif."
        )

    labels = set(
        dataset[LABEL_COLUMN].unique()
    )

    if labels != VALID_LABELS:
        raise ValueError(
            "Dataset harus memiliki seluruh "
            "kelas Restock, Sufficient, Excess."
        )

    lead_time = dataset[
        "lead_time_days"
    ].to_numpy(dtype=float)

    if (
        (lead_time < 1).any()
        or (lead_time > 365).any()
        or (lead_time != np.floor(lead_time)).any()
    ):
        raise ValueError(
            "Nilai lead_time_days tidak valid."
        )

    # Pastikan seluruh label konsisten
    # dengan aturan simulasi.
    current_stock = dataset[
        "current_stock"
    ].to_numpy(dtype=float)

    minimum_stock = dataset[
        "minimum_stock"
    ].to_numpy(dtype=float)

    daily_depletion = (
        dataset["average_daily_usage"]
        .to_numpy(dtype=float)
        + dataset["average_daily_waste"]
        .to_numpy(dtype=float)
    )

    reorder_threshold = np.maximum(
        minimum_stock,
        daily_depletion
        * (lead_time + SAFETY_BUFFER_DAYS),
    )

    excess_threshold = np.maximum(
        minimum_stock * 2,
        daily_depletion * EXCESS_COVERAGE_DAYS,
    )

    expected_labels = np.where(
        current_stock <= reorder_threshold,
        "Restock",
        np.where(
            current_stock > excess_threshold,
            "Excess",
            "Sufficient",
        ),
    )

    if not np.array_equal(
        dataset[LABEL_COLUMN].to_numpy(),
        expected_labels,
    ):
        raise ValueError(
            "Label dataset tidak konsisten "
            "dengan aturan klasifikasi."
        )


# ==========================================
# DATASET SUMMARY
# ==========================================

def print_dataset_summary(
    dataset: pd.DataFrame,
    output: Path,
    seed: int,
) -> None:

    print("\n=== PantryOven Synthetic Dataset ===")

    print(f"Total samples: {len(dataset)}")
    print(f"Random seed: {seed}")
    print(f"Jumlah fitur: {len(FEATURE_COLUMNS)}")
    print(f"Lokasi file: {output}")

    print("\nDistribusi label:")

    distribution = (
        dataset[LABEL_COLUMN]
        .value_counts()
        .reindex(
            ["Restock", "Sufficient", "Excess"],
            fill_value=0,
        )
    )

    for label, count in distribution.items():
        percentage = (
            count / len(dataset) * 100
        )

        print(
            f"- {label}: "
            f"{count} ({percentage:.2f}%)"
        )

    print("\nStatistik fitur:")

    print(
        dataset[FEATURE_COLUMNS]
        .describe()
        .round(2)
        .to_string()
    )

    print("\nContoh data:")

    print(
        dataset.head(10).to_string(
            index=False
        )
    )

    print(
        "\nCatatan: dataset menggunakan "
        "aturan simulasi, bukan data "
        "operasional bakery nyata."
    )


# ==========================================
# CLI
# ==========================================

def main() -> None:

    parser = argparse.ArgumentParser(
        description=(
            "Generate synthetic training data "
            "for PantryOven stock classification."
        )
    )

    parser.add_argument(
        "--samples",
        type=int,
        default=DEFAULT_SAMPLES,
    )

    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
    )

    parser.add_argument(
        "--output",
        default="ml_model/data/training_dataset.csv",
    )

    args = parser.parse_args()

    dataset = generate_dataset(
        samples=args.samples,
        seed=args.seed,
    )

    output = Path(args.output)

    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    dataset.to_csv(
        output,
        index=False,
    )

    print_dataset_summary(
        dataset=dataset,
        output=output,
        seed=args.seed,
    )


if __name__ == "__main__":
    main()
