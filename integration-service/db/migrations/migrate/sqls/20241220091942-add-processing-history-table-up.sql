/* Replace with your SQL commands */
CREATE TABLE IF NOT EXISTS integration_data.data_processing_history (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    case_id UUID NOT NULL,
    ocr_document_id UUID DEFAULT NULL,
    american_express_data JSONB NOT NULL DEFAULT '{}',
    discover_data JSONB NOT NULL DEFAULT '{}',
    point_of_sale_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID NOT NULL,
    CONSTRAINT data_processing_history_unique UNIQUE (case_id),
    FOREIGN KEY (case_id) REFERENCES public.data_cases (id) ON DELETE CASCADE,
    FOREIGN KEY (ocr_document_id) REFERENCES integration_data.uploaded_ocr_documents (id) ON DELETE CASCADE,
    PRIMARY KEY (id)
);

CREATE INDEX idx_data_processing_history_case_id ON integration_data.data_processing_history (case_id);
