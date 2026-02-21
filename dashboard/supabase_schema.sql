-- Supabase Schema for Evo Logistics Dashboard

-- ENUMS
CREATE TYPE rfq_status AS ENUM (
  'Processing',
  'Missing_Port_Data',
  'Missing_Door_Data',
  'Parse_Error',
  'Selected',
  'Quoted',
  'Reminded',
  'Followed_Up',
  'Customer_Replied'
);

CREATE TYPE quote_status AS ENUM (
  'Requested',
  'Reminded',
  'Received',
  'Invalid_Quote'
);

CREATE TYPE service_type AS ENUM (
  'port-to-port',
  'door-to-port',
  'port-to-door',
  'door-to-door'
);

CREATE TYPE agent_status AS ENUM (
  'active',
  'inactive'
);


-- TABLES

-- 1. Master RFQs
CREATE TABLE master_rfqs (
  rfq_id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  status rfq_status NOT NULL DEFAULT 'Processing',
  pol TEXT,                           -- nullable: partial RFQs accepted
  pod TEXT,                           -- nullable
  container_type TEXT,                -- nullable
  qty TEXT,                           -- nullable
  ready_date DATE,                    -- nullable
  delivery_deadline DATE,             -- nullable: customer's required delivery date
  service_type service_type NOT NULL,
  pickup_address TEXT,
  delivery_address TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  selected_agent TEXT,
  final_price_usd NUMERIC,
  final_price_aed NUMERIC,
  quoted_at TIMESTAMPTZ
);

-- 2. Agent Outbound Log (Quotes)
CREATE TABLE agent_outbound_log (
  match TEXT PRIMARY KEY,
  rfq_id TEXT NOT NULL REFERENCES master_rfqs(rfq_id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  agent_email TEXT NOT NULL,
  shipment_number TEXT NOT NULL,
  carrier TEXT NOT NULL,
  price NUMERIC,
  currency TEXT NOT NULL DEFAULT 'USD',
  etd DATE,
  transit_time TEXT,
  free_time TEXT,
  validity DATE,
  status quote_status NOT NULL DEFAULT 'Requested',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ
);

CREATE INDEX idx_agent_outbound_log_rfq_id ON agent_outbound_log(rfq_id);

-- 3. Agents
CREATE TABLE agents (
  agent_name TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status agent_status NOT NULL DEFAULT 'active'
);

-- 4. Pricing: DO Charges
CREATE TABLE do_charges (
  id SERIAL PRIMARY KEY,
  carrier TEXT NOT NULL UNIQUE,
  document NUMERIC NOT NULL,
  "20FT" NUMERIC NOT NULL,
  "40FT" NUMERIC NOT NULL,
  "40HQ" NUMERIC NOT NULL
);

-- 5. Pricing: Destination Charges
CREATE TABLE destination_charges (
  id SERIAL PRIMARY KEY,
  charge_type TEXT NOT NULL,
  basis TEXT NOT NULL,
  "20FT" NUMERIC NOT NULL,
  "40FT" NUMERIC NOT NULL
);

-- 6. Pricing: Transportation Charges
CREATE TABLE transportation_charges (
  id SERIAL PRIMARY KEY,
  place TEXT NOT NULL UNIQUE,
  price NUMERIC NOT NULL
);


-- ROW LEVEL SECURITY (RLS)
-- Since this is an internal dashboard backend, we default to restricting all public access,
-- but allowing full access to authenticated service roles, OR we can open read access if using anon key securely.
-- For a Next.js app where API routes (backend) fetch the data, they will use the Service Role Key or bypass RLS.
-- Let's enable RLS and create straightforward policies.

ALTER TABLE master_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_outbound_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE do_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE destination_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE transportation_charges ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated anon (if using client-side fetching)
CREATE POLICY "Allow public read access" ON master_rfqs FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON agent_outbound_log FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON agents FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON do_charges FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON destination_charges FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON transportation_charges FOR SELECT USING (true);

-- (Write operations will be performed by backend API routes or Modal using Service Role Key, which bypasses RLS)
