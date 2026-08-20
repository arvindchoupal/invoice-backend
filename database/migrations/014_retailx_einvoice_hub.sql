ALTER TABLE retailx_einvoice_records
  ADD COLUMN generated_at DATETIME NULL AFTER response_json,
  ADD KEY idx_retailx_einvoice_company_date (table_prefix, generated_at);

ALTER TABLE retailx_einvoice_records
  ADD COLUMN eway_bill_generated_at DATETIME NULL AFTER eway_bill_valid_till;
