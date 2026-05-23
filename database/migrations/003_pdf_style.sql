ALTER TABLE invoices
  ADD COLUMN pdf_style VARCHAR(32) NOT NULL DEFAULT 'classic' AFTER terms;

ALTER TABLE settings
  ADD COLUMN default_pdf_style VARCHAR(32) NOT NULL DEFAULT 'classic' AFTER invoice_counter;
