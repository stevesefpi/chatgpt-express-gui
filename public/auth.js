// A tiny helper so we can SEE something happened
function setStatus(msg) {
  const el = document.getElementById("authStatus");
  if (el) el.textContent = msg;
}

// Wait until DOM exists before querying elements
window.addEventListener("DOMContentLoaded", async () => {
  setStatus("auth.js loaded ✅");

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

  const authDiv = document.getElementById("auth");
  const chatDiv = document.getElementById("chat");
  const loginForm = document.getElementById("loginForm");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  function setUI(loggedIn) {
    authDiv.style.display = loggedIn ? "none" : "block";
    chatDiv.style.display = loggedIn ? "flex" : "none";
  }

  async function refreshUI() {
    const { data } = await supabase.auth.getSession();
    setUI(!!data.session);
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
  setUI(false);

  window.location.replace(true);
});


  // Keep UI synced
  await refreshUI();
  supabase.auth.onAuthStateChange(() => refreshUI());
});
