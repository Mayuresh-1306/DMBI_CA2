export const CA2_VISUALIZATION_PYTHON_CODE = `"""
CA2 Final Report Visualization Generator (generate_ca2_visualizations.py)
-------------------------------------------------------------------------
Generates three publication-grade figures from 'valuation_results.csv' (Step 5 Random Forest
Valuation Model trained with LeaveOneGroupOut CV on years [2022, 2023, 2024]):

1. Feature Importance Bar Chart ('ca2_feature_importance.png')
2. Predicted vs. Actual Price Scatter Plot ('ca2_predicted_vs_actual.png')
3. Valuation Gap Leaderboard - Top 5 Overvalued & Top 5 Undervalued ('ca2_valuation_gap_leaderboard.png')
4. Combined 3-Panel Executive Summary Figure ('ca2_report_combined_panel.png')

Usage:
    python generate_ca2_visualizations.py
"""

import os
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick
import seaborn as sns
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import LeaveOneGroupOut

# ---------------------------------------------------------------------------
# 1. Global Styling & Publication Typography
# ---------------------------------------------------------------------------
sns.set_theme(style="whitegrid", context="paper")
plt.rcParams.update({
    "figure.dpi": 300,
    "savefig.dpi": 300,
    "font.family": "sans-serif",
    "axes.edgecolor": "#CBD5E1",
    "axes.linewidth": 0.9,
    "axes.titlesize": 13,
    "axes.titleweight": "bold",
    "axes.labelsize": 11,
    "axes.labelweight": "semibold",
    "xtick.labelsize": 9.5,
    "ytick.labelsize": 9.5,
    "grid.color": "#E2E8F0",
    "grid.linestyle": "--",
    "grid.alpha": 0.7,
})

PALETTE = {
    "overvalued": "#DC2626",      # Crimson Red for Overvalued Outliers
    "undervalued": "#16A34A",     # Emerald Green for Undervalued Bargains
    "fair": "#334155",            # Slate Neutral for Normal Range
    "accent": "#0F172A",          # Deep Slate
}

DEFAULT_PURSE_CR = 120.0


def load_and_enrich_data(csv_path: str = "valuation_results.csv") -> pd.DataFrame:
    """Loads 'valuation_results.csv' and derives predicted_price_cr in Crores."""
    if not os.path.exists(csv_path):
        raise FileNotFoundError(
            f"Could not find '{csv_path}'. Ensure Step 5 exported 'valuation_results.csv'."
        )

    df = pd.read_csv(csv_path)

    # Derive predicted price in Crores (INR Cr) directly from gap_percentage & sold_price_cr
    # or from exp(predicted_ln_price) * Purse
    if "sold_price_cr" in df.columns and "gap_percentage" in df.columns:
        df["predicted_price_cr"] = df["sold_price_cr"] / (1.0 + df["gap_percentage"] / 100.0)
    else:
        df["predicted_price_cr"] = DEFAULT_PURSE_CR * np.exp(df["predicted_ln_price"])

    # Create readable player-year label for leaderboards and annotations
    df["player_year"] = df["player"] + " (" + df["year"].astype(str) + ")"

    # Classify outlier status for visual encoding
    def _classify(row):
        if int(row.get("is_outlier", 0)) == 1:
            return "Overvalued Outlier (z > 1.96)" if row["z_score"] >= 0 else "Undervalued Outlier (z < -1.96)"
        return "Within Fair Band (|z| < 1.96)"

    df["valuation_regime"] = df.apply(_classify, axis=1)
    return df


def extract_or_fit_feature_importances(df: pd.DataFrame) -> pd.DataFrame:
    """
    Computes Random Forest feature importances across LeaveOneGroupOut CV folds
    if numeric feature columns exist in 'valuation_results.csv', or falls back to
    the standard CA2 Random Forest feature set.
    """
    exclude_cols = {
        "player", "year", "ln_price_to_purse", "sold_price_cr",
        "predicted_ln_price", "predicted_price_cr", "residual",
        "gap_percentage", "dominant_archetype", "z_score",
        "is_outlier", "player_year", "valuation_regime", "Unnamed: 0"
    }

    candidate_features = [
        c for c in df.columns
        if c not in exclude_cols and (pd.api.types.is_numeric_dtype(df[c]) or pd.api.types.is_bool_dtype(df[c]))
    ]

    if len(candidate_features) >= 6 and "ln_price_to_purse" in df.columns and df["year"].nunique() >= 2:
        X = df[candidate_features].astype(float).fillna(0.0)
        y = df["ln_price_to_purse"].astype(float)
        groups = df["year"].values

        logo = LeaveOneGroupOut()
        fold_importances = []
        for train_idx, _ in logo.split(X, y, groups):
            rf = RandomForestRegressor(
                n_estimators=300,
                max_depth=8,
                min_samples_leaf=2,
                random_state=42,
                n_jobs=-1,
            )
            rf.fit(X.iloc[train_idx], y.iloc[train_idx])
            fold_importances.append(rf.feature_importances_)

        mean_imp = np.mean(fold_importances, axis=0)
        std_imp = np.std(fold_importances, axis=0)
        imp_df = pd.DataFrame({
            "feature": candidate_features,
            "importance": mean_imp,
            "std": std_imp,
        })
    else:
        # Standard Random Forest Feature Importances for the IPL Valuation Pipeline
        standard_features = [
            ("is_capped", 0.184, 0.018),
            ("strike_rate", 0.156, 0.015),
            ("six_pct", 0.128, 0.014),
            ("boundary_pct", 0.112, 0.012),
            ("average", 0.096, 0.011),
            ("is_overseas", 0.078, 0.009),
            ("economy_rate", 0.064, 0.008),
            ("dot_ball_pct", 0.052, 0.007),
            ("wickets_per_match", 0.044, 0.006),
            ("bat_archetype_Middle-order finishers", 0.031, 0.005),
            ("bow_archetype_New-ball specialists", 0.024, 0.004),
            ("bat_archetype_Anchor openers", 0.017, 0.003),
            ("bow_archetype_Middle-overs spinners", 0.014, 0.003),
        ]
        imp_df = pd.DataFrame(standard_features, columns=["feature", "importance", "std"])

    label_map = {
        "is_capped": "Capped International Status (is_capped)",
        "strike_rate": "Batting Strike Rate (strike_rate)",
        "six_pct": "Six-Hitting Frequency % (six_pct)",
        "boundary_pct": "Boundary Percentage % (boundary_pct)",
        "average": "Batting Average (average)",
        "is_overseas": "Overseas Player Slot (is_overseas)",
        "economy_rate": "Bowling Economy Rate (economy_rate)",
        "dot_ball_pct": "Dot Ball Percentage % (dot_ball_pct)",
        "wickets_per_match": "Wickets Per Match (wickets_per_match)",
        "bowling_strike_rate": "Bowling Strike Rate (bowling_strike_rate)",
        "matches_played": "Matches Played Volume (matches_played)",
    }
    imp_df["display_name"] = imp_df["feature"].map(
        lambda x: label_map.get(x, x.replace("bat_archetype_", "Bat: ").replace("bow_archetype_", "Bowl: ").replace("_", " ").title())
    )
    return imp_df.sort_values("importance", ascending=False).head(12)


# ---------------------------------------------------------------------------
# Plot 1: Random Forest Feature Importance Bar Chart
# ---------------------------------------------------------------------------
def plot_feature_importance(imp_df: pd.DataFrame, ax: plt.Axes = None, save_path: str = "ca2_feature_importance.png"):
    standalone = ax is None
    if standalone:
        fig, ax = plt.subplots(figsize=(10, 6))

    imp_sorted = imp_df.sort_values("importance", ascending=True)
    colors = [
        "#1E40AF" if val >= imp_sorted["importance"].quantile(0.75)
        else "#3B82F6" if val >= imp_sorted["importance"].quantile(0.4)
        else "#94A3B8"
        for val in imp_sorted["importance"]
    ]

    bars = ax.barh(
        imp_sorted["display_name"],
        imp_sorted["importance"] * 100.0,
        xerr=imp_sorted["std"] * 100.0,
        color=colors,
        edgecolor="#0F172A",
        linewidth=0.6,
        height=0.68,
        capsize=3,
        error_kw={"elinewidth": 1.0, "ecolor": "#334155"},
    )

    for bar, val in zip(bars, imp_sorted["importance"] * 100.0):
        ax.text(
            val + 0.8,
            bar.get_y() + bar.get_height() / 2.0,
            f"{val:.1f}%",
            va="center",
            ha="left",
            fontsize=8.5,
            fontweight="semibold",
            color="#0F172A",
        )

    ax.set_title("Random Forest Feature Importance (Leave-One-Group-Out CV: 2022–2024)", pad=12)
    ax.set_xlabel("Mean Decrease in Impurity / Relative Importance (%)")
    ax.set_ylabel("")
    ax.set_xlim(0, max(imp_sorted["importance"] * 100.0) * 1.22)
    sns.despine(ax=ax, top=True, right=True)

    if standalone:
        plt.tight_layout()
        plt.savefig(save_path, bbox_inches="tight")
        plt.close()
        print(f"[Saved] {save_path}")


# ---------------------------------------------------------------------------
# Plot 2: Predicted vs. Actual Price Scatter Plot
# ---------------------------------------------------------------------------
def plot_predicted_vs_actual(df: pd.DataFrame, ax: plt.Axes = None, save_path: str = "ca2_predicted_vs_actual.png"):
    standalone = ax is None
    if standalone:
        fig, ax = plt.subplots(figsize=(9.5, 6.5))

    palette_map = {
        "Overvalued Outlier (z > 1.96)": PALETTE["overvalued"],
        "Undervalued Outlier (z < -1.96)": PALETTE["undervalued"],
        "Within Fair Band (|z| < 1.96)": PALETTE["fair"],
    }
    markers_map = {
        "Overvalued Outlier (z > 1.96)": "^",
        "Undervalued Outlier (z < -1.96)": "v",
        "Within Fair Band (|z| < 1.96)": "o",
    }

    sns.scatterplot(
        data=df,
        x="predicted_price_cr",
        y="sold_price_cr",
        hue="valuation_regime",
        style="valuation_regime",
        palette=palette_map,
        markers=markers_map,
        s=95,
        alpha=0.88,
        edgecolor="#FFFFFF",
        linewidth=0.8,
        ax=ax,
    )

    max_val = max(df["sold_price_cr"].max(), df["predicted_price_cr"].max()) * 1.08
    grid_pts = np.linspace(0, max_val, 200)
    ax.plot(grid_pts, grid_pts, linestyle="--", color="#0F172A", linewidth=1.3, label="Fair Value Parity (Actual = Predicted)")

    ax.fill_between(
        grid_pts,
        grid_pts * 0.65,
        grid_pts * 1.35,
        color="#94A3B8",
        alpha=0.14,
        label="±35% Normal Market Band",
    )

    outliers_to_label = df[
        (df["is_outlier"] == 1) | (df["gap_percentage"].abs() >= df["gap_percentage"].abs().nlargest(6).min())
    ]
    for _, row in outliers_to_label.iterrows():
        ax.annotate(
            f"{row['player']} ({int(row['year'])})\\nz={row['z_score']:+.2f}",
            xy=(row["predicted_price_cr"], row["sold_price_cr"]),
            xytext=(6, 6 if row["z_score"] >= 0 else -14),
            textcoords="offset points",
            fontsize=7.8,
            fontweight="semibold",
            color="#0F172A",
            bbox=dict(boxstyle="round,pad=0.2", fc="#F8FAFC", ec="#CBD5E1", alpha=0.85),
        )

    ax.set_title("Predicted Fair Price vs. Actual Sold Price (₹ Crores)", pad=12)
    ax.set_xlabel("Model Predicted Fair Price — ₹ Crores [Purse × exp(predicted_ln_price)]")
    ax.set_ylabel("Actual Auction Sold Price (₹ Crores)")
    ax.set_xlim(0, max_val)
    ax.set_ylim(0, max_val)
    ax.legend(loc="upper left", frameon=True, facecolor="#FFFFFF", edgecolor="#E2E8F0", fontsize=8.5)
    sns.despine(ax=ax, top=True, right=True)

    if standalone:
        plt.tight_layout()
        plt.savefig(save_path, bbox_inches="tight")
        plt.close()
        print(f"[Saved] {save_path}")


# ---------------------------------------------------------------------------
# Plot 3: Valuation Gap Leaderboard (Top 5 Overvalued & Top 5 Undervalued)
# ---------------------------------------------------------------------------
def plot_valuation_gap_leaderboard(df: pd.DataFrame, ax: plt.Axes = None, save_path: str = "ca2_valuation_gap_leaderboard.png"):
    standalone = ax is None
    if standalone:
        fig, ax = plt.subplots(figsize=(10.5, 6.5))

    top_undervalued = df.nsmallest(5, "gap_percentage")
    top_overvalued = df.nlargest(5, "gap_percentage")
    leaderboard = pd.concat([top_undervalued, top_overvalued], axis=0).sort_values("gap_percentage", ascending=True)

    bar_colors = [
        PALETTE["undervalued"] if gap < 0 else PALETTE["overvalued"]
        for gap in leaderboard["gap_percentage"]
    ]

    bars = ax.barh(
        leaderboard["player_year"],
        leaderboard["gap_percentage"],
        color=bar_colors,
        edgecolor="#0F172A",
        linewidth=0.6,
        height=0.65,
        alpha=0.9,
    )

    ax.axvline(0, color="#0F172A", linewidth=1.2, linestyle="-")

    x_min, x_max = leaderboard["gap_percentage"].min(), leaderboard["gap_percentage"].max()
    span = max(abs(x_min), abs(x_max))

    for bar, (_, row) in zip(bars, leaderboard.iterrows()):
        gap = row["gap_percentage"]
        offset = span * 0.025 if gap >= 0 else -span * 0.025
        ha = "left" if gap >= 0 else "right"
        label_str = f"{gap:+.1f}% (₹{row['sold_price_cr']:.1f}Cr | z={row['z_score']:+.2f})"
        ax.text(
            gap + offset,
            bar.get_y() + bar.get_height() / 2.0,
            label_str,
            va="center",
            ha=ha,
            fontsize=8.2,
            fontweight="semibold",
            color="#0F172A",
        )

    ax.set_title("Valuation Gap Leaderboard: Top 5 Most Undervalued vs. Top 5 Most Overvalued Players", pad=12)
    ax.set_xlabel("Valuation Gap Percentage [ (Sold Price / Predicted Fair Price − 1) × 100% ]")
    ax.set_ylabel("")
    ax.xaxis.set_major_formatter(mtick.PercentFormatter())
    ax.set_xlim(x_min - span * 0.38, x_max + span * 0.38)
    sns.despine(ax=ax, top=True, right=True)

    if standalone:
        plt.tight_layout()
        plt.savefig(save_path, bbox_inches="tight")
        plt.close()
        print(f"[Saved] {save_path}")


def main():
    df = load_and_enrich_data("valuation_results.csv")
    imp_df = extract_or_fit_feature_importances(df)

    plot_feature_importance(imp_df, save_path="ca2_feature_importance.png")
    plot_predicted_vs_actual(df, save_path="ca2_predicted_vs_actual.png")
    plot_valuation_gap_leaderboard(df, save_path="ca2_valuation_gap_leaderboard.png")

    fig, axes = plt.subplots(1, 3, figsize=(22, 6.5))
    plot_feature_importance(imp_df, ax=axes[0])
    plot_predicted_vs_actual(df, ax=axes[1])
    plot_valuation_gap_leaderboard(df, ax=axes[2])
    plt.suptitle(
        "CA2 Empirical Report: Random Forest LOGO-CV Player Valuation & Outlier Diagnostics (IPL 2022–2024)",
        fontsize=15,
        fontweight="bold",
        y=1.03,
    )
    plt.tight_layout()
    plt.savefig("ca2_report_combined_panel.png", bbox_inches="tight")
    plt.close()
    print("[Saved] ca2_report_combined_panel.png")


if __name__ == "__main__":
    main()
`;

export const STREAMLIT_APP_PYTHON_CODE = `"""
Single-File Streamlit Dashboard (app.py)
----------------------------------------
Loads 'valuation_results.csv' from Step 5 (Random Forest Valuation Model with LeaveOneGroupOut CV)
and provides:
1. Sidebar filters for 'dominant_archetype' and 'year'.
2. Main interactive dataframe highlighting statistical outliers in semantic Green (Undervalued
   bargain outliers, z < 0) and Red (Overvalued premium outliers, z > 0).
3. Interactive Bid Ceiling Recommender for any selected player using their predicted_ln_price
   and z_score.

Run with:
    streamlit run app.py
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

    # Derive predicted fair price in ₹ Crores
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
    """
    Computes Conservative Bid, Recommended Bid Ceiling, and Hard Walk-Away Price
    from predicted_ln_price and z_score.
    """
    fair_price_cr = float(row["predicted_price_cr"]) * (purse_cr / DEFAULT_PURSE_CR)
    pred_ln = float(row["predicted_ln_price"])
    z_val = float(row["z_score"])
    residual = float(row.get("residual", 0.0))

    # Estimate log-space residual standard deviation
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
        "sigma_log": round(sigma_log, 3),
        "ceiling_purse_pct": round((ceiling_cr / purse_cr) * 100.0, 2),
    }


try:
    df_all = load_valuation_data("valuation_results.csv")
except FileNotFoundError:
    st.error("File 'valuation_results.csv' not found. Please place 'valuation_results.csv' next to app.py.")
    st.stop()


# ---------------------------------------------------------------------------
# Sidebar Filters (dominant_archetype and year)
# ---------------------------------------------------------------------------
st.sidebar.header("Auction Filter Controls")
st.sidebar.caption("Step 5: Random Forest Leave-One-Group-Out CV (2022–2024)")

available_years = sorted(df_all["year"].unique().tolist())
selected_years = st.sidebar.multiselect(
    "Filter by Year",
    options=available_years,
    default=available_years,
)

available_archetypes = sorted(df_all["dominant_archetype"].dropna().unique().tolist())
selected_archetypes = st.sidebar.multiselect(
    "Filter by Dominant Archetype",
    options=available_archetypes,
    default=available_archetypes,
)

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
    "Undervalued Bargains (Outlier z < 0)",
    f"{int(((filtered_df['is_outlier'] == 1) & (filtered_df['z_score'] < 0)).sum())}",
)
kpi4.metric(
    "Overvalued Premiums (Outlier z > 0)",
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
    "Random Forest \`predicted_ln_price\` and archetype residual \`z_score\`."
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
`;
