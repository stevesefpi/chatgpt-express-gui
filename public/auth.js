import { setStatus, setUI, getAuthElements } from "./utils/auth_utils.js";

// Wait until DOM exists before querying elements
window.addEventListener("DOMContentLoaded", async () => {
  // Fetch config from backend
  const cfgRes = await fetch("/config");
  const cfg = await cfgRes.json();

  // Create Supabase client
  const supabase = window.supabase.createClient(
    cfg.supabaseUrl,
    cfg.supabaseAnonKey
  );

  // Expose token getter for chat.js
  window.getAccessToken = async function () {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || null;
  };

  const { authDiv, chatDiv, loginForm, signupBtn, logoutBtn } = getAuthElements();
  const authDiv = document.getElementById("auth");
  const chatDiv = document.getElementById("chat");
  const loginForm = document.getElementById("loginForm");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  async function refreshUI() {
    const { data } = await supabase.auth.getSession();
    const loggedIn = !!data.session;

    setUI(authDiv, chatDiv, loggedIn);

    // If already logged in (e.g., after refresh), load sidebar chats
    if (loggedIn) {
      await window.refreshChats?.();
    }
  }

  // LOGIN
  loginForm?.addEventListener("submit", async (e) => {
    e.preventDefault();

    setStatus("Logging in...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setStatus(error ? `Error: ${error.message}` : "Logged in ✅");

    await refreshUI();
    await window.refreshChats?.();
  });

  // SIGNUP (Create account)
  signupBtn?.addEventListener("click", async () => {
    setStatus("Create account clicked...");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {
      setStatus("Please enter email + password first.");
      return;
    }

    const { error } = await supabase.auth.signUp({ email, password });

    setStatus(
      error
        ? `Error: ${error.message}`
        : "Account created ✅ (If email confirmation is enabled, check your inbox.)"
    );
  });

  // LOGOUT
  logoutBtn?.addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.log("Logout error:", error);
      setStatus("Logout error: " + error.message);
      return;
    }

    setStatus("Logged out ✅");
    setUI(authDiv, chatDiv, false);

    window.location.replace(true);
  });

  // Keep UI synced
  await refreshUI();
  supabase.auth.onAuthStateChange(() => refreshUI());
});
