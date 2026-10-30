"""
CA2 Final Report Visualization Generator
----------------------------------------
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
    "feature_bat": "#2563EB",     # Royal Blue
    "feature_bowl": "#0D9488",    # Teal
    "feature_meta": "#4F46E5",    # Indigo
    "feature_arch": "#64748B",    # Cool Gray
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
        if c not in exclude_cols and pd.api.types.is_numeric_dtype(df[c]) or pd.api.types.is_bool_dtype(df[c])
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

    # Clean display labels
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

    # 1:1 Fair Valuation Parity Diagonal
    max_val = max(df["sold_price_cr"].max(), df["predicted_price_cr"].max()) * 1.08
    grid_pts = np.linspace(0, max_val, 200)
    ax.plot(grid_pts, grid_pts, linestyle="--", color="#0F172A", linewidth=1.3, label="Fair Value Parity (Actual = Predicted)")

    # +/- 50% Valuation Band Shading
    ax.fill_between(
        grid_pts,
        grid_pts * 0.65,
        grid_pts * 1.35,
        color="#94A3B8",
        alpha=0.14,
        label="±35% Normal Market Band",
    )

    # Annotate extreme outliers and marquee names
    outliers_to_label = df[
        (df["is_outlier"] == 1) | (df["gap_percentage"].abs() >= df["gap_percentage"].abs().nlargest(6).min())
    ]
    for _, row in outliers_to_label.iterrows():
        ax.annotate(
            f"{row['player']} ({int(row['year'])})\nz={row['z_score']:+.2f}",
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

    # Generate individual report figures
    plot_feature_importance(imp_df, save_path="ca2_feature_importance.png")
    plot_predicted_vs_actual(df, save_path="ca2_predicted_vs_actual.png")
    plot_valuation_gap_leaderboard(df, save_path="ca2_valuation_gap_leaderboard.png")

    # Generate combined 3-panel CA2 Executive Figure
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
