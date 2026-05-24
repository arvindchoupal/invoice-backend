ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS pdf_style VARCHAR(32) NOT NULL DEFAULT 'classic' AFTER terms;

ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS default_pdf_style VARCHAR(32) NOT NULL DEFAULT 'classic' AFTER invoice_counter;
