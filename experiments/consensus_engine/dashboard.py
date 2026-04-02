import streamlit as st
import pandas as pd
import json
import os
import random
import plotly.express as px
import plotly.graph_objects as go
from dataclasses import asdict

import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
sys.path.append(os.path.dirname(__file__))

# Import experiment modules
from data.mock_service import MockEnrichmentService
from pipeline.current_pipeline import run_current_pipeline
from pipeline.consensus_engine import run_consensus_engine
from training.train_model import train, TrainedModel
from data.synthetic_entities import generate_dataset, ALL_JURISDICTIONS

# Set page config for a premium feel
st.set_page_config(
    page_title="Worth AI | Consensus Engine Simulator",
    page_icon="🤖",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom CSS for modern look
st.markdown("""
    <style>
    .main { background-color: #f8f9fa; }
    .stMetric { background-color: #ffffff; padding: 15px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
    .stAlert { border-radius: 10px; }
    div[data-testid="stExpander"] { background-color: #ffffff; border-radius: 10px; border: 1px solid #e9ecef; }
    .delivery-box { 
        padding: 20px; 
        border-radius: 15px; 
        border: 1px solid #ddd; 
        margin-bottom: 20px; 
    }
    .current-delivery { border-left: 5px solid #ff4b4b; background-color: #fff5f5; }
    .future-delivery { border-left: 5px solid #2ecc71; background-color: #f4fff8; }
    </style>
    """, unsafe_allow_html=True)

# ---------------------------------------------------------------------------
# Data & Model Setup
# ---------------------------------------------------------------------------

@st.cache_resource
def get_model():
    # Attempt to load or train a demo model
    dataset = generate_dataset()
    return train(dataset, verbose=False)

model = get_model()
mocker = MockEnrichmentService()

# ---------------------------------------------------------------------------
# Sidebar Content
# ---------------------------------------------------------------------------

st.sidebar.image("https://worthai.com/wp-content/themes/worthai/assets/images/logo_worth_ai_dark.svg", width=180)
st.sidebar.title("Consensus Engine v1.0")
st.sidebar.markdown("---")

st.sidebar.info("This simulator compares **Current Worth AI** logic with the **New Consensus Engine**.")
st.sidebar.markdown("---")
st.sidebar.write("**Model Config**")
st.sidebar.caption("XGBoost Multi-class + Platt Scaling")
st.sidebar.caption("Features: 15 (Agreement, Staleness, Discrepancies)")

# ---------------------------------------------------------------------------
# Main Dashboard Logic
# ---------------------------------------------------------------------------

st.title("🤖 Industry Classification: Simulator & Dashboard")

tab1, tab2, tab3 = st.tabs(["🚀 Interactive Simulator", "📂 Batch Processing", "📊 Archetype Analysis"])

# ---------------------------------------------------------------------------
# Tab 1: Interactive Simulator
# ---------------------------------------------------------------------------
with tab1:
    st.header("New Entity Multi-Source Simulation")
    st.write("Enter business details to simulate a live API fetch (Opencorporates, ZoomInfo, Equifax, Trulioo, AI) and compare the outputs.")

    with st.container():
        c1, c2, c3 = st.columns([2, 2, 1])
        with c1:
            comp_name = st.text_input("Company Name", placeholder="e.g. Joe's Pizza & Holding Group")
        with c2:
            comp_url = st.text_input("Website / Domain", placeholder="e.g. joespizzagroup.co.uk")
        with c3:
            comp_country = st.selectbox("Jurisdiction", ALL_JURISDICTIONS, index=ALL_JURISDICTIONS.index("gb") if "gb" in ALL_JURISDICTIONS else 0)

    if st.button("🚀 Run Analysis", type="primary"):
        if not comp_name:
            st.error("Please enter a company name.")
        else:
            with st.spinner("Simulating multi-source enrichment..."):
                # 1. Mock the signals
                entity_input = mocker.enrich(comp_name, comp_url, comp_country)
                
                # 2. Run both pipelines
                current_res = run_current_pipeline(entity_input)
                consensus_res = run_consensus_engine(entity_input, model)

                st.markdown("---")
                
                # DISPLAY COMPARISON
                col_left, col_right = st.columns(2)
                
                with col_left:
                    st.subheader("🛑 CURRENT Worth AI Delivery")
                    st.markdown('<div class="delivery-box current-delivery">', unsafe_allow_html=True)
                    st.write(f"**Classification:** {current_res.final_naics_code or current_res.final_uk_sic_code}")
                    st.write(f"**Reasoning:** Winning signal (Wait/Weight) from `{current_res.naics_winner_source if current_res.naics_winner_source else 'None'}`")
                    
                    st.markdown("---")
                    st.write("**⚠️ Gaps in this Delivery:**")
                    if current_res.holding_company_code_in_discards:
                        st.error("SILENT DATA LOSS: A Holding Company signal was found in secondary sources but DISCARDED.")
                    if current_res.trulioo_pollution_detected:
                        st.warning("TAXONOMY POLLUTION: US-SIC code accepted for UK entity without flagging.")
                    if not current_res.aml_flags_generated:
                        st.info("AML COVERAGE: 0 risk flags generated (No discrepancy detection logic).")
                    st.markdown('</div>', unsafe_allow_html=True)

                with col_right:
                    st.subheader("✅ FUTURE Consensus Engine Delivery")
                    st.markdown('<div class="delivery-box future-delivery">', unsafe_allow_html=True)
                    st.write(f"**Primary Code:** {consensus_res.recommended_code} ({consensus_res.recommended_label})")
                    st.write(f"**Overall Confidence:** {consensus_res.overall_confidence:.1%}")
                    
                    st.markdown("---")
                    st.write("**✨ Enhancements in this Delivery:**")
                    if consensus_res.risk_flags:
                        st.error(f"RISK CAPTURED: {len(consensus_res.risk_flags)} discrepancies detected.")
                        for f in consensus_res.risk_flags:
                            st.caption(f"📍 {f.severity}: {f.flag_type}")
                    st.write(f"**AML Risk Multiplier:** {consensus_res.combined_aml_multiplier:.1f}x")
                    st.write(f"**Manual Review Required:** {'YES 🔴' if consensus_res.requires_manual_review else 'No 🟢'}")
                    st.markdown('</div>', unsafe_allow_html=True)

                # SOURCE TRANSPARENCY
                st.markdown("### 🔍 Source Attribution & Probability")
                c_src, c_prob = st.columns([1.5, 1])
                
                with c_src:
                    st.write("**Incoming Source Signals**")
                    src_data = []
                    
                    # Logic to determine if used in Current Pipeline
                    used_in_current_sources = set()
                    if current_res.naics_winner_source and current_res.naics_winner_source != "fallback":
                        used_in_current_sources.add((current_res.naics_winner_source, current_res.naics_winner_code))
                    if current_res.uk_sic_winner_source:
                        used_in_current_sources.add((current_res.uk_sic_winner_source, current_res.uk_sic_winner_code))

                    for s in entity_input.sources:
                        is_used_legacy = (s.source, s.raw_code) in used_in_current_sources
                        status_str = "Used in Consensus"
                        if not is_used_legacy:
                            status_str += " (Not Used in Current Worth IA Pipeline)"
                        
                        src_data.append({
                            "Source": s.source,
                            "Taxonomy": s.taxonomy,
                            "Code": s.raw_code,
                            "Conf": f"{s.confidence:.2%}",
                            "Role": "Primary" if s.is_primary_code else "Secondary",
                            "Status": status_str
                        })
                    st.dataframe(pd.DataFrame(src_data), use_container_width=True, hide_index=True)

                with c_prob:
                    st.write("**Model Consensus (Top 5)**")
                    prob_df = pd.DataFrame(consensus_res.top5_classifications)
                    fig_probs = px.bar(prob_df, x="consensus_probability", y="class_label", orientation='h',
                                      color="consensus_probability", color_continuous_scale="Greens")
                    fig_probs.update_layout(showlegend=False, height=300)
                    st.plotly_chart(fig_probs, use_container_width=True)

# ---------------------------------------------------------------------------
# Tab 2: Batch Processing
# ---------------------------------------------------------------------------
with tab2:
    st.header("Bulk Analysis (CSV/XLSX)")
    st.write("Upload a file with 'company_name' and optional 'website' columns to run a comparison across a whole portfolio.")
    
    uploaded_file = st.file_uploader("Upload Company List", type=["csv", "xlsx"])
    
    if uploaded_file:
        if uploaded_file.name.endswith(".csv"):
            df = pd.read_csv(uploaded_file)
        else:
            df = pd.read_excel(uploaded_file)
        
        if "company_name" not in df.columns:
            st.error("CSV must have a 'company_name' column.")
        else:
            st.write(f"Total records to process: {len(df)}")
            if st.button("🚀 Process Batch"):
                results = []
                progress = st.progress(0)
                for i, row in df.iterrows():
                    name = str(row["company_name"])
                    web = str(row.get("website", ""))
                    
                    e_in = mocker.enrich(name, web)
                    c_res = run_current_pipeline(e_in)
                    con_res = run_consensus_engine(e_in, model)
                    
                    results.append({
                        "Name": name,
                        "Website": web,
                        "Current Code": c_res.final_naics_code,
                        "Consensus Code": con_res.recommended_code,
                        "Confidence": con_res.overall_confidence,
                        "AML Mult": con_res.combined_aml_multiplier,
                        "Flags": len(con_res.risk_flags),
                        "Review?": con_res.requires_manual_review
                    })
                    progress.progress((i + 1) / len(df))
                
                st.success("Batch processing complete!")
                res_df = pd.DataFrame(results)
                st.dataframe(res_df)
                
                # Download button
                csv = res_df.to_csv(index=False).encode('utf-8')
                st.download_button("📥 Download Comparison Results", csv, "batch_comparison.csv", "text/csv")

# ---------------------------------------------------------------------------
# Tab 3: Archetype Analysis (Legacy Dashboard)
# ---------------------------------------------------------------------------
with tab3:
    st.header("Synthetic Archetype Baseline")
    st.write("Review the pre-generated 60 entities used to train and validate the model.")
    
    # Load analysis and show the summary charts
    from run_experiment import build_current_output_record, build_consensus_output_record
    from features.feature_builder import ConsensusFeatureBuilder

    builder = ConsensusFeatureBuilder()
    dataset = generate_dataset()
    
    arch_selection = st.selectbox("Select Archetype to Inspect", list(set(e.archetype for e in dataset)))
    
    archetype_entities = [e for e in dataset if e.archetype == arch_selection]
    
    total_con_correct = 0
    total_cur_correct = 0
    
    for entity in archetype_entities:
        cur = run_current_pipeline(entity)
        con = run_consensus_engine(entity, model)
        
        with st.expander(f"Entity: {entity.entity_name}"):
            ca, cb = st.columns(2)
            with ca:
                st.write("**Current Output**")
                st.info(f"Code: {cur.final_naics_code}")
                if cur.holding_company_code_in_discards: st.warning("Holding signal lost!")
            with cb:
                st.write("**Consensus Output**")
                st.success(f"Code: {con.recommended_code}")
                st.write(f"AML Mult: {con.combined_aml_multiplier}x")
                if con.requires_manual_review: st.error("Manual Review Required")

# Footer
st.markdown("---")
st.caption("Worth AI | Consensus Engine Experiment v1.0 | Confidential & Internal")
