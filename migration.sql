-- Add platform_fee and shipping_cost columns to transaction_items table
ALTER TABLE transaction_items ADD COLUMN platform_fee BIGINT DEFAULT 0;
ALTER TABLE transaction_items ADD COLUMN shipping_cost BIGINT DEFAULT 0;
