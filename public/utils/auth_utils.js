// A helper to see something happened
export function setStatus(msg) {
  const el = document.getElementById("authStatus");
  if (el) el.textContent = msg;
}

export function setUI(authDiv, chatDiv, loggedIn) {
  authDiv.style.display = loggedIn ? "none" : "block";
  chatDiv.style.display = loggedIn ? "flex" : "none";
}

export function getAuthElements() {
  const authDiv = document.getElementById("auth");
  const chatDiv = document.getElementById("chat");
  const loginForm = document.getElementById("loginForm");
  const signupBtn = document.getElementById("signupBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  return { authDiv, chatDiv, loginForm, signupBtn, logoutBtn };
}
