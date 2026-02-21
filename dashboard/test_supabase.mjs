import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ncsrnzcdkstsmaabfwpf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5jc3JuemNka3N0c21hYWJmd3BmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTU5NzgxMiwiZXhwIjoyMDg3MTczODEyfQ._S7GgsvEsLk96PDPyO_wIVTeAPoXlryHEIoOxc26RhY';

const supabase = createClient(supabaseUrl, supabaseKey);

// Test that we can insert a row with nullable fields
const testRow = {
    rfq_id: 'RFQ-TEST-001',
    thread_id: 'test-thread-001',
    customer_email: 'test@test.com',
    status: 'Missing_Port_Data',
    pol: null,
    pod: null,
    container_type: null,
    qty: null,
    ready_date: null,
    service_type: 'port-to-port',
    received_at: new Date().toISOString(),
};

const { error } = await supabase.from('master_rfqs').upsert(testRow);
if (error) {
    console.error('❌ Nullable test failed:', error.message);
    console.log('\nYou need to run this SQL in the Supabase dashboard SQL editor:');
    console.log('');
    console.log('ALTER TABLE master_rfqs ALTER COLUMN pol DROP NOT NULL;');
    console.log('ALTER TABLE master_rfqs ALTER COLUMN pod DROP NOT NULL;');
    console.log('ALTER TABLE master_rfqs ALTER COLUMN container_type DROP NOT NULL;');
    console.log('ALTER TABLE master_rfqs ALTER COLUMN qty DROP NOT NULL;');
    console.log('ALTER TABLE master_rfqs ALTER COLUMN ready_date DROP NOT NULL;');
} else {
    console.log('✅ Nullable columns OK! Cleaning up test row...');
    await supabase.from('master_rfqs').delete().eq('rfq_id', 'RFQ-TEST-001');
    console.log('✅ Test row deleted. Ready to run backfill.');
}
