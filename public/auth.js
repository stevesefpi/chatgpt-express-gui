import {
  setStatus,
  setUI,
  getAuthElements,
  refreshUI,
} from "./utils/auth_utils.js";

// Wait until DOM exists before querying elements
window.addEventListener("DOMContentLoaded", async () => {
  // Fetch config from backend
  const cfgRes = await fetch("/config");
  const cfg = await cfgRes.json();

  let supabase = null;
  let cachedSession = null;

  // Function to create Supabase client
  const createSb = () =>
    window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });

  const initSupabase = async () => {
    supabase = createSb();

    // cache
    const { data } = await supabase.auth.getSession();
    cachedSession = data.session ?? null;

    // keep cache updated
    supabase.auth.onAuthStateChange((_event, session) => {
      cachedSession = session ?? null;
    });

    // expose a token getter that DOES NOT call getSession()
    window.getAccessToken = async () => cachedSession?.access_token ?? null;

    // (optional) expose for debugging
    window.sb = supabase;
  };

  await initSupabase();

  // ---- your existing UI wiring below, but use `supabase` variable ----
  const { authDiv, chatDiv, loginForm, signupBtn, logoutBtn } = getAuthElements();

  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("Logging in...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? `Error: ${error.message}` : "Logged in ✅");

    await refreshUI({ supabase, authDiv, chatDiv, setUI });
    await window.refreshChats?.();
  });

  signupBtn?.addEventListener("click", async () => {
    setStatus("Create account clicked...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      setStatus("Please enter email + password first.");
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });
    setStatus(error ? `Error: ${error.message}` : "Account created ✅");
  });

  logoutBtn?.addEventListener("click", async () => {
    setStatus("Logging out");

    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus("Logout error: " + error.message);
      return;
    }

    cachedSession = null;
    await refreshUI({ supabase, authDiv, chatDiv, setUI });

    setStatus("Logged out.");
  });

  await refreshUI({ supabase, authDiv, chatDiv, setUI });

  supabase.auth.onAuthStateChange(() =>
    refreshUI({ supabase, authDiv, chatDiv, setUI })
  );
});
