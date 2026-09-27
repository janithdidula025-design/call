const SUPABASE_URL = "https://wbwokcisdrmeiigohqfo.supabase.co/rest/v1/";
const SUPABASE_ANON_KEY = "wbwokcisdrmeiigohqfo";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);
