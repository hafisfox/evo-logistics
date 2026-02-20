# Next Steps for User

You are almost ready to migrate! I have prepared the database schema (`supabase_schema.sql`), the Next.js client connection (`src/lib/supabase.ts`), and a migration script (`migrate_to_supabase.ts`).

However, before we flip the switch on the `src/app/api` routes to start reading from Supabase, you must do the following manual steps:

## 1. Create the Supabase Database
1. Go to [Supabase](https://supabase.com/) and create a new project.
2. Go to Project Settings -> API to find your `URL`, `Anon Key`, and `Service Role Key`.
3. Add these to `.env.local` based on the placeholders in `.env.example`.
4. Go to the **SQL Editor** in the Supabase Dashboard.
5. Copy the contents of `supabase_schema.sql` and click **Run**. This will create all your tables.

## 2. Update Python Modal Webhooks
Your python file `automations/phase_3_select_and_quote.py` currently writes to Google Sheets. You need to update it to use the `supabase-py` SDK.

**Install:**
```bash
pip install supabase
```

**Python Implementation:**
```python
import os
from supabase import create_client, Client

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
supabase: Client = create_client(url, key)

# Replace Google Sheets update with:
supabase.table('master_rfqs').update({
    'status': 'Quoted',
    'selected_agent': selected_agent,
    'final_price_usd': final_price_usd,
    'final_price_aed': final_price_aed,
    'quoted_at': 'now()' # or formatting timestamp
}).eq('rfq_id', rfq_id).execute()
```
*Don't forget to push these new ENV vars to your Modal secret!*

## 3. Run the Data Migration
Once your `.env.local` has the Supabase keys, run the migration script locally to copy over all existing history:

```bash
npx tsx migrate_to_supabase.ts
```

## 4. Deploy to Vercel
1. Push your code to GitHub.
2. Import the repo to Vercel.
3. In the "Environment Variables" section of the import step, paste **EVERY** key from `.env.local`.
4. Crucially, set `NEXTAUTH_URL` to your new Vercel production deployment URL, and ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are exactly matched.

---

**The 10 Next.js API routes in `src/app/api/*` have been successfully updated to query Supabase instead of Google Sheets! You no longer need to let me know, they are ready to go.**
