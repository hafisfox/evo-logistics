-- Add missing delivery_deadline column to master_rfqs
ALTER TABLE master_rfqs
ADD COLUMN IF NOT EXISTS delivery_deadline DATE;

-- Add missing statuses to the rfq_status enum
ALTER TYPE rfq_status ADD VALUE IF NOT EXISTS 'Reminded';
ALTER TYPE rfq_status ADD VALUE IF NOT EXISTS 'Followed_Up';
ALTER TYPE rfq_status ADD VALUE IF NOT EXISTS 'Customer_Replied';
