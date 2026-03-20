-- Create schema `restructure`
CREATE SCHEMA IF NOT EXISTS restructure;

-- Create table score_model
CREATE TABLE restructure.core_score_model (
    id SERIAL PRIMARY KEY,
    model_version NUMERIC(5, 1) NOT NULL DEFAULT 1.0
);

-- Create table model_category
CREATE TABLE restructure.data_model_category (
    id SERIAL PRIMARY KEY,
    model_id INTEGER NOT NULL,
    category VARCHAR(255),
    json_key VARCHAR(255),
    CONSTRAINT fk_model_id FOREIGN KEY (model_id) REFERENCES restructure.core_score_model(id)
);

-- Create table model_sub_category
CREATE TABLE restructure.data_model_sub_category (
    id SERIAL PRIMARY KEY,
    model_category_id INTEGER NOT NULL,
    category VARCHAR(255),
    feature_name VARCHAR(255),
    feature_datatype VARCHAR(50),
    units VARCHAR(50),
    description TEXT,
    json_key VARCHAR(255),
    CONSTRAINT fk_model_category_id FOREIGN KEY (model_category_id) REFERENCES restructure.data_model_category(id)
);

-- Create table score
CREATE TABLE restructure.data_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    score_trigger_id UUID NOT NULL,
    probability decimal NOT NULL,
    score_300_850 decimal NOT NULL,
    score_0_100 decimal NOT NULL,
    score decimal NOT NULL,
    model_version NUMERIC(5, 1) NOT NULL,
    shap_base_points decimal NOT NULL,
    CONSTRAINT fk_score_trigger_id FOREIGN KEY (score_trigger_id) REFERENCES business_score_triggers(id)
);

-- Create table category_score
CREATE TABLE restructure.data_category_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    score_id UUID NOT NULL,
    category_id UUID NOT NULL,
    shap_points DECIMAL NOT NULL,
    shap_score DECIMAL NOT NULL,
    category_ref JSON NOT NULL,
    CONSTRAINT fk_score_id FOREIGN KEY (score_id) REFERENCES restructure.data_scores(id)
);

-- Create table sub_category_score
CREATE TABLE restructure.data_sub_category_scores (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    category_score_id UUID NOT NULL,
    sub_category_id UUID NOT NULL,
    shap_points DECIMAL NOT NULL,
    shap_score DECIMAL NOT NULL,
    sub_category_ref JSON NOT NULL,
    CONSTRAINT fk_category_score_id FOREIGN KEY (category_score_id) REFERENCES restructure.data_category_scores(id)
);
