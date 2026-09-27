// config.js

const SUPABASE_URL =
    "https://wbwokcisdrmeiigohqfo.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_q3fsbC1VWc-q1CoRzHWSMw_RmRl71pq";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
    );
