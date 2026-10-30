"""
Single-File Streamlit Dashboard (app.py)
----------------------------------------
Runs a clean Streamlit dashboard loading 'valuation_results.csv' with optimized
sidebar controls (selectbox & radio) to prevent multiselect overflow.
"""

import math
import numpy as np
import pandas as pd
import streamlit as st

st.set_page_config(
    page_title="IPL Auction Valuation & Bid Ceiling Analytics",
    page_icon="🏏",
    layout="wide",
    initial_sidebar_state="expanded",
)

DEFAULT_PURSE_CR = 120.0


@st.cache_data
def load_valuation_data(csv_path: str = "valuation_results.csv") -> pd.DataFrame:
    df = pd.read_csv(csv_path)

    if "sold_price_cr" in df.columns and "gap_percentage" in df.columns:
        df["predicted_price_cr"] = df["sold_price_cr"] / (1.0 + df["gap_percentage"] / 100.0)
    else:
        df["predicted_price_cr"] = DEFAULT_PURSE_CR * np.exp(df["predicted_ln_price"])

    if "residual" not in df.columns and "ln_price_to_purse" in df.columns:
        df["residual"] = df["ln_price_to_purse"] - df["predicted_ln_price"]

    def classify_status(row) -> str:
        if int(row["is_outlier"]) == 1:
            return "Undervalued Outlier" if row["z_score"] < 0 else "Overvalued Outlier"
        return "Fair Band"

    df["valuation_status"] = df.apply(classify_status, axis=1)
    return df


def compute_bid_ceiling(
    row: pd.Series,
    risk_posture: str = "Balanced (Standard Franchise Risk)",
    purse_cr: float = DEFAULT_PURSE_CR,
) -> dict:
    fair_price_cr = float(row["predicted_price_cr"]) * (purse_cr / DEFAULT_PURSE_CR)
    pred_ln = float(row["predicted_ln_price"])
    z_val = float(row["z_score"])
    residual = float(row.get("residual", 0.0))

    sigma_log = min(max(abs(residual / z_val), 0.35), 0.95) if abs(z_val) > 0.05 else 0.65

    posture_map = {
        "Conservative (Value-First)": 0.25,
        "Balanced (Standard Franchise Risk)": 0.60,
        "Aggressive (Marquee Role Priority)": 1.00,
    }
    alpha_z = posture_map.get(risk_posture, 0.60)

    clamped_z = max(-2.0, min(2.0, z_val))
    sentiment_adj = (
        clamped_z * 0.12 * sigma_log if clamped_z < 0 else clamped_z * 0.18 * sigma_log
    )

    conservative_cr = max(0.20, purse_cr * math.exp(pred_ln - 0.25 * sigma_log))
    ceiling_cr = max(conservative_cr, purse_cr * math.exp(pred_ln + alpha_z * sigma_log + sentiment_adj))
    walk_away_cr = max(
        ceiling_cr,
        purse_cr * math.exp(pred_ln + (alpha_z + 0.45) * sigma_log + max(0.0, sentiment_adj)),
    )

    return {
        "fair_price_cr": round(fair_price_cr, 2),
        "conservative_cr": round(conservative_cr, 2),
        "ceiling_cr": round(ceiling_cr, 2),
        "walk_away_cr": round(walk_away_cr, 2),
        "ceiling_purse_pct": round((ceiling_cr / purse_cr) * 100.0, 2),
    }


try:
    df_all = load_valuation_data("valuation_results.csv")
except FileNotFoundError:
    st.error("File 'valuation_results.csv' not found. Please place 'valuation_results.csv' next to app.py.")
    st.stop()


# ---------------------------------------------------------------------------
# Sidebar Filters (Using clean selectbox & radio to prevent tag overflow)
# ---------------------------------------------------------------------------
st.sidebar.header("Auction Filter Controls")
st.sidebar.caption("Step 5: Random Forest LOGO-CV (2022–2024)")

available_years = sorted(df_all["year"].unique().tolist())
selected_years = st.sidebar.multiselect(
    "Filter by Year",
    options=available_years,
    default=available_years,
)

available_archetypes = sorted(df_all["dominant_archetype"].dropna().unique().tolist())
archetype_choice = st.sidebar.selectbox(
    "Filter by Dominant Archetype",
    options=["All Archetypes"] + available_archetypes,
    index=0,
)

if archetype_choice == "All Archetypes":
    selected_archetypes = available_archetypes
else:
    selected_archetypes = [archetype_choice]

outlier_filter = st.sidebar.radio(
    "Outlier Display Filter",
    options=[
        "All Players",
        "Outliers Only (is_outlier == 1)",
        "Undervalued Outliers (z < 0)",
        "Overvalued Outliers (z > 0)",
    ],
    index=0,
)

franchise_purse = st.sidebar.slider(
    "Franchise Total Purse (₹ Crores)",
    min_value=80.0,
    max_value=150.0,
    value=120.0,
    step=5.0,
)

filtered_df = df_all[
    (df_all["year"].isin(selected_years))
    & (df_all["dominant_archetype"].isin(selected_archetypes))
].copy()

if outlier_filter == "Outliers Only (is_outlier == 1)":
    filtered_df = filtered_df[filtered_df["is_outlier"] == 1]
elif outlier_filter == "Undervalued Outliers (z < 0)":
    filtered_df = filtered_df[(filtered_df["is_outlier"] == 1) & (filtered_df["z_score"] < 0)]
elif outlier_filter == "Overvalued Outliers (z > 0)":
    filtered_df = filtered_df[(filtered_df["is_outlier"] == 1) & (filtered_df["z_score"] > 0)]


# ---------------------------------------------------------------------------
# Main Header & Summary KPIs
# ---------------------------------------------------------------------------
st.title("🏏 IPL Player Valuation & Bid Ceiling Decision System")
st.markdown(
    "Empirical Random Forest valuation model trained with **Leave-One-Group-Out Cross-Validation (LOGO-CV)** "
    "across the 2022, 2023, and 2024 IPL auctions."
)

kpi1, kpi2, kpi3, kpi4 = st.columns(4)
kpi1.metric("Filtered Player-Seasons", f"{len(filtered_df)}")
kpi2.metric("Statistical Outliers (|z| ≥ 1.96)", f"{int((filtered_df['is_outlier'] == 1).sum())}")
kpi3.metric(
    "Undervalued Bargains (Green)",
    f"{int(((filtered_df['is_outlier'] == 1) & (filtered_df['z_score'] < 0)).sum())}",
)
kpi4.metric(
    "Overvalued Premiums (Red)",
    f"{int(((filtered_df['is_outlier'] == 1) & (filtered_df['z_score'] > 0)).sum())}",
)

st.divider()


# ---------------------------------------------------------------------------
# Section 1: Main Valuation Dataframe with Red/Green Outlier Highlighting
# ---------------------------------------------------------------------------
st.subheader("1. Player Valuation Matrix (Outliers Highlighted in Green / Red)")
st.caption(
    "Green rows indicate statistically significant undervalued bargains (is_outlier == 1 and z_score < 0). "
    "Red rows indicate statistically significant overvalued auction premiums (is_outlier == 1 and z_score > 0)."
)

display_cols = [
    "player",
    "year",
    "dominant_archetype",
    "sold_price_cr",
    "predicted_price_cr",
    "predicted_ln_price",
    "gap_percentage",
    "z_score",
    "is_outlier",
    "valuation_status",
]
display_cols = [c for c in display_cols if c in filtered_df.columns]


def highlight_outliers(row: pd.Series):
    if int(row.get("is_outlier", 0)) == 1:
        if float(row.get("z_score", 0.0)) < 0:
            return ["background-color: rgba(22, 163, 74, 0.18); color: #14532D; font-weight: 600;"] * len(row)
        else:
            return ["background-color: rgba(220, 38, 38, 0.18); color: #7F1D1D; font-weight: 600;"] * len(row)
    return [""] * len(row)


styled_df = (
    filtered_df[display_cols]
    .sort_values(by=["is_outlier", "z_score"], ascending=[False, True])
    .style.apply(highlight_outliers, axis=1)
    .format({
        "sold_price_cr": "₹{:.2f} Cr",
        "predicted_price_cr": "₹{:.2f} Cr",
        "predicted_ln_price": "{:.4f}",
        "gap_percentage": "{:+.2f}%",
        "z_score": "{:+.3f}",
    })
)

st.dataframe(styled_df, use_container_width=True, height=400)

st.divider()


# ---------------------------------------------------------------------------
# Section 2: Bid Ceiling Recommender
# ---------------------------------------------------------------------------
st.subheader("2. Tactical Auction Bid Ceiling Recommender")
st.markdown(
    "Select a player-season record to compute recommended bid boundaries calibrated from their "
    "Random Forest `predicted_ln_price` and archetype residual `z_score`."
)

if filtered_df.empty:
    st.warning("No players match the current sidebar filter selection. Widen your filters in the sidebar.")
else:
    col_select, col_risk = st.columns([2, 1])

    filtered_df["selector_label"] = (
        filtered_df["player"]
        + " — "
        + filtered_df["year"].astype(str)
        + " ("
        + filtered_df["dominant_archetype"]
        + ")"
    )

    with col_select:
        chosen_label = st.selectbox(
            "Select Player & Season",
            options=filtered_df["selector_label"].tolist(),
        )

    with col_risk:
        risk_posture = st.selectbox(
            "Franchise Bidding Risk Posture",
            options=[
                "Conservative (Value-First)",
                "Balanced (Standard Franchise Risk)",
                "Aggressive (Marquee Role Priority)",
            ],
            index=1,
        )

    player_row = filtered_df[filtered_df["selector_label"] == chosen_label].iloc[0]
    rec = compute_bid_ceiling(player_row, risk_posture=risk_posture, purse_cr=franchise_purse)

    m1, m2, m3, m4 = st.columns(4)
    m1.metric(
        "Model Fair Valuation",
        f"₹{rec['fair_price_cr']:.2f} Cr",
        delta=f"ln(P/Purse) = {player_row['predicted_ln_price']:.3f}",
        delta_color="off",
    )
    m2.metric(
        "Opening / Value Target Bid",
        f"₹{rec['conservative_cr']:.2f} Cr",
        delta="-0.25σ Value Entry",
        delta_color="normal",
    )
    m3.metric(
        "Recommended Bid Ceiling",
        f"₹{rec['ceiling_cr']:.2f} Cr",
        delta=f"{rec['ceiling_purse_pct']:.1f}% of Purse",
        delta_color="off",
    )
    m4.metric(
        "Hard Walk-Away Price",
        f"₹{rec['walk_away_cr']:.2f} Cr",
        delta=f"Historical Sold: ₹{player_row['sold_price_cr']:.2f} Cr",
        delta_color="inverse" if player_row["sold_price_cr"] > rec["ceiling_cr"] else "normal",
    )

    z_val = float(player_row["z_score"])
    is_out = int(player_row["is_outlier"]) == 1
    if is_out and z_val < 0:
        st.success(
            f"**High-Alpha Undervalued Outlier (z = {z_val:+.2f}):** {player_row['player']} cleared at "
            f"₹{player_row['sold_price_cr']:.2f} Cr ({player_row['gap_percentage']:+.1f}% vs. model fair value "
            f"of ₹{rec['fair_price_cr']:.2f} Cr). Strong recommendation to bid proactively up to the "
            f"**₹{rec['ceiling_cr']:.2f} Cr** ceiling while capturing positive surplus value."
        )
    elif is_out and z_val > 0:
        st.error(
            f"**Overvalued Auction Premium Outlier (z = {z_val:+.2f}):** {player_row['player']} sold for "
            f"₹{player_row['sold_price_cr']:.2f} Cr ({player_row['gap_percentage']:+.1f}% above model fair value "
            f"of ₹{rec['fair_price_cr']:.2f} Cr). Enforce strict auction discipline: cap bids at "
            f"**₹{rec['ceiling_cr']:.2f} Cr** and exit bidding war above **₹{rec['walk_away_cr']:.2f} Cr**."
        )
    else:
        st.info(
            f"**Fair Market Valuation Regime (z = {z_val:+.2f}):** {player_row['player']} sold at "
            f"₹{player_row['sold_price_cr']:.2f} Cr against a fair value of ₹{rec['fair_price_cr']:.2f} Cr "
            f"({player_row['gap_percentage']:+.1f}% gap). Recommended bid ceiling is **₹{rec['ceiling_cr']:.2f} Cr** "
            f"with a hard walk-away limit at **₹{rec['walk_away_cr']:.2f} Cr**."
        )
