
import argparse
from pathlib import Path

import numpy as np
import pandas as pd


TRANSACTION_SIGNS = {
    "stock_in": 1,
    "stock_out": -1,
    "usage": -1,
    "waste": -1,
}


def preprocess_inventory(
    items_path: str,
    transactions_path: str,
    window_days: int = 30,
    as_of: str | None = None,
) -> pd.DataFrame:
    if window_days <= 0:
        raise ValueError("window_days harus lebih dari 0.")

    items = pd.read_csv(
        items_path,
        dtype={"id": str},
    )

    transactions = pd.read_csv(
        transactions_path,
        dtype={
            "item_id": str,
            "transaction_type": str,
        },
    )

    required_items = {
        "id",
        "name",
        "category",
        "unit",
        "initial_stock",
        "minimum_stock",
    }

    required_transactions = {
        "item_id",
        "transaction_type",
        "quantity",
        "created_at",
    }

    missing_items = required_items - set(items.columns)
    if missing_items:
        raise ValueError(
            f"Kolom items tidak ada: {sorted(missing_items)}"
        )

    missing_transactions = (
        required_transactions - set(transactions.columns)
    )
    if missing_transactions:
        raise ValueError(
            "Kolom transaksi tidak ada: "
            f"{sorted(missing_transactions)}"
        )

    if (
        items["id"].isna().any()
        or items["id"].duplicated().any()
    ):
        raise ValueError("ID item kosong atau duplikat.")

    if transactions["item_id"].isna().any():
        raise ValueError("Ada item_id transaksi yang kosong.")

    for column in ["initial_stock", "minimum_stock"]:
        items[column] = pd.to_numeric(
            items[column],
            errors="raise",
        )

        if (
            not np.isfinite(items[column]).all()
            or (items[column] < 0).any()
        ):
            raise ValueError(
                f"Nilai {column} tidak valid."
            )

    transactions["quantity"] = pd.to_numeric(
        transactions["quantity"],
        errors="raise",
    )

    transactions["created_at"] = pd.to_datetime(
        transactions["created_at"],
        utc=True,
        errors="raise",
    )

    if (
        not np.isfinite(transactions["quantity"]).all()
        or (transactions["quantity"] <= 0).any()
    ):
        raise ValueError(
            "Quantity transaksi harus positif."
        )

    if transactions["created_at"].isna().any():
        raise ValueError(
            "Tanggal transaksi tidak valid."
        )

    if not transactions["item_id"].isin(items["id"]).all():
        raise ValueError(
            "Ada transaksi dengan item_id tidak dikenal."
        )

    if not transactions["transaction_type"].isin(
        TRANSACTION_SIGNS
    ).all():
        raise ValueError(
            "Ditemukan transaction_type tidak dikenal."
        )

    reference = (
        pd.Timestamp(as_of)
        if as_of
        else pd.Timestamp.now(tz="UTC")
    )

    if pd.isna(reference):
        raise ValueError("Tanggal as_of tidak valid.")

    if reference.tzinfo is None:
        reference = reference.tz_localize("UTC")
    else:
        reference = reference.tz_convert("UTC")

    if (transactions["created_at"] > reference).any():
        raise ValueError(
            "Ada transaksi setelah tanggal as_of."
        )

    # 1. Hitung perubahan stok sesuai view Supabase.
    transactions["signed_quantity"] = (
        transactions["quantity"]
        * transactions["transaction_type"].map(
            TRANSACTION_SIGNS
        )
    )

    net_changes = (
        transactions.groupby("item_id")["signed_quantity"]
        .sum()
        .rename("net_change")
    )

    # 2. Tentukan periode analisis.
    start_date = reference - pd.Timedelta(
        days=window_days
    )

    recent_transactions = transactions[
        (transactions["created_at"] >= start_date)
        & (transactions["created_at"] <= reference)
    ].copy()

    # 3. Pisahkan transaksi berdasarkan jenisnya.
    recent_usage = recent_transactions[
        recent_transactions["transaction_type"] == "usage"
    ]

    recent_waste = recent_transactions[
        recent_transactions["transaction_type"] == "waste"
    ]

    recent_stock_out = recent_transactions[
        recent_transactions["transaction_type"] == "stock_out"
    ]

    recent_stock_in = recent_transactions[
        recent_transactions["transaction_type"] == "stock_in"
    ]

    def sum_quantity(
        data: pd.DataFrame,
        column_name: str,
    ) -> pd.Series:
        return (
            data.groupby("item_id")["quantity"]
            .sum()
            .rename(column_name)
        )

    usage_totals = sum_quantity(
        recent_usage,
        "total_usage",
    )

    waste_totals = sum_quantity(
        recent_waste,
        "total_waste",
    )

    stock_out_totals = sum_quantity(
        recent_stock_out,
        "total_stock_out",
    )

    stock_in_totals = sum_quantity(
        recent_stock_in,
        "total_stock_in",
    )

    # 4. Gabungkan hasil preprocessing.
    result = items[
        [
            "id",
            "name",
            "category",
            "unit",
            "initial_stock",
            "minimum_stock",
        ]
    ].copy()

    result = result.join(
        net_changes,
        on="id",
    )

    for totals in [
        usage_totals,
        waste_totals,
        stock_out_totals,
        stock_in_totals,
    ]:
        result = result.join(
            totals,
            on="id",
        )

    numeric_columns = [
        "net_change",
        "total_usage",
        "total_waste",
        "total_stock_out",
        "total_stock_in",
    ]

    result[numeric_columns] = (
        result[numeric_columns].fillna(0)
    )

    # 5. Hitung stok aktual.
    result["current_stock"] = (
        result["initial_stock"]
        + result["net_change"]
    )

    # 6. Hitung rata-rata penggunaan produksi.
    result["average_daily_usage"] = (
        result["total_usage"] / window_days
    )

    # 7. Hitung rata-rata waste.
    result["average_daily_waste"] = (
        result["total_waste"] / window_days
    )

    # 8. Hitung rasio waste terhadap usage + waste.
    total_consumption = (
        result["total_usage"]
        + result["total_waste"]
    )

    result["waste_rate"] = np.where(
        total_consumption > 0,
        result["total_waste"]
        / total_consumption.replace(0, np.nan),
        np.nan,
    )

    # 9. Hitung estimasi cakupan stok untuk produksi.
    result["stock_coverage_days"] = (
        result["current_stock"]
        / result["average_daily_usage"].replace(
            0,
            np.nan,
        )
    )

    # 10. Catat keberadaan riwayat penggunaan.
    result["has_usage_history"] = result["id"].isin(
        transactions.loc[
            transactions["transaction_type"] == "usage",
            "item_id",
        ]
    )

    # 11. Catat keberadaan riwayat waste.
    result["has_waste_history"] = result["id"].isin(
        transactions.loc[
            transactions["transaction_type"] == "waste",
            "item_id",
        ]
    )

    # 12. Tandai item dengan stok rendah.
    result["is_low_stock"] = (
        result["current_stock"]
        <= result["minimum_stock"]
    )

    result["as_of_utc"] = reference.isoformat()

    return result.drop(
        columns=["net_change"]
    )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description=(
            "Preprocessing data inventory PantryOven "
            "untuk machine learning."
        )
    )

    parser.add_argument(
        "--items",
        required=True,
    )

    parser.add_argument(
        "--transactions",
        required=True,
    )

    parser.add_argument(
        "--output",
        default="ml_model/data/inventory_features.csv",
    )

    parser.add_argument(
        "--window-days",
        type=int,
        default=30,
    )

    parser.add_argument(
        "--as-of",
        default=None,
    )

    args = parser.parse_args()

    result = preprocess_inventory(
        items_path=args.items,
        transactions_path=args.transactions,
        window_days=args.window_days,
        as_of=args.as_of,
    )

    output = Path(args.output)
    output.parent.mkdir(
        parents=True,
        exist_ok=True,
    )

    result.to_csv(
        output,
        index=False,
    )

    print(
        f"\nPreprocessing berhasil: {len(result)} item"
    )

    print(
        result[
            [
                "name",
                "current_stock",
                "minimum_stock",
                "average_daily_usage",
                "average_daily_waste",
                "waste_rate",
                "stock_coverage_days",
                "is_low_stock",
            ]
        ].to_string(index=False)
    )
