import { setStatus, setUI, getAuthElements, refreshUI } from "./utils/auth_utils.js";

window.addEventListener("DOMContentLoaded", async () => {
  const cfgRes = await fetch("/config");
  const cfg = await cfgRes.json();

  console.log(cfg);

  // Getting DOM elements via the imported helper function
  const { authDiv, chatDiv, loginForm, signupBtn, logoutBtn } = getAuthElements();

  let cachedSession = null;

  const supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  // Prime cache once
  {
    const { data } = await supabase.auth.getSession();
    cachedSession = data.session ?? null;
  }

  // Keep cache + UI synced
  supabase.auth.onAuthStateChange((_event, session) => {
    cachedSession = session ?? null;
    refreshUI({ session: cachedSession, authDiv, chatDiv, setUI });
  });

  // Token getter (no getSession calls)
  window.getAccessToken = async () => cachedSession?.access_token ?? null;

  // Optional debugging
  window.sb = supabase;

  // Initial UI render
  await refreshUI({ session: cachedSession, authDiv, chatDiv, setUI });

  // LOGIN
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    setStatus("Logging in...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setStatus(error ? `Error: ${error.message}` : "Logged in ✅");

    // No need to call refreshUI here; onAuthStateChange will fire.
  });

  // SIGNUP
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

  // LOGOUT
  logoutBtn?.addEventListener("click", async () => {
    setStatus("Logging out...");

    const { error } = await supabase.auth.signOut();
    if (error) {
      setStatus("Logout error: " + error.message);
      return;
    }

    // onAuthStateChange will fire and refreshUI will flip the UI
    setStatus("Logged out ✅");
  });
});

