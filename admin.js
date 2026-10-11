const authPanel = document.getElementById("authPanel");
const managerPanel = document.getElementById("managerPanel");
const setupForm = document.getElementById("setupForm");
const loginForm = document.getElementById("loginForm");
const authStatus = document.getElementById("authStatus");
const campForm = document.getElementById("campForm");
const campStatus = document.getElementById("campStatus");

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed");
  return result;
}

async function refreshView() {
  try {
    const status = await api("/api/admin/status");
    authPanel.hidden = status.authenticated;
    managerPanel.hidden = !status.authenticated;
    setupForm.hidden = status.configured;
    loginForm.hidden = !status.configured;
    document.getElementById("authTitle").textContent = status.configured ? "Admin sign in" : "Set up admin access";
    document.getElementById("authIntro").textContent = status.configured
      ? "Sign in to add and review health camp listings."
      : "Choose a strong password. It is stored locally as a protected password hash.";
    if (status.authenticated) await loadAdminCamps();
  } catch (error) {
    authPanel.hidden = false;
    authStatus.textContent = `Could not connect to the local server: ${error.message}. Open this page through http://127.0.0.1:3000/admin.`;
  }
}

async function loadAdminCamps() {
  const camps = await api("/api/camps");
  const list = document.getElementById("adminCampList");
  list.innerHTML = camps.map(camp => `<article class="admin-camp-row"><b>${escapeHtml(camp.name)}</b><span>${escapeHtml(camp.city)} · ${escapeHtml(camp.date)} · ${escapeHtml(camp.service)}</span></article>`).join("") || "<p>No camps have been added yet.</p>";
  const volunteers = await api("/api/admin/volunteers");
  const volunteerList = document.getElementById("adminVolunteerList");
  volunteerList.innerHTML = volunteers.map(volunteer => `<article class="admin-volunteer-row"><b>${escapeHtml(volunteer.name)}</b><span>${escapeHtml(volunteer.city)} · ${escapeHtml(volunteer.interest)} · <a href="mailto:${encodeURIComponent(volunteer.email)}">${escapeHtml(volunteer.email)}</a></span>${volunteer.message ? `<p>${escapeHtml(volunteer.message)}</p>` : ""}</article>`).join("") || "<p>No volunteer applications yet.</p>";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

async function handleAuth(event, endpoint) {
  event.preventDefault();
  authStatus.textContent = "Please wait…";
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget).entries());
    await api(endpoint, { method: "POST", body: JSON.stringify(values) });
    event.currentTarget.reset();
    authStatus.textContent = "";
    await refreshView();
  } catch (error) { authStatus.textContent = error.message; }
}

setupForm.addEventListener("submit", event => handleAuth(event, "/api/admin/setup"));
loginForm.addEventListener("submit", event => handleAuth(event, "/api/admin/login"));
document.getElementById("logoutButton").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  await refreshView();
});

campForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = campForm.querySelector("button[type=submit]");
  button.disabled = true;
  campStatus.textContent = "Saving camp…";
  const values = Object.fromEntries(new FormData(campForm).entries());
  values.lat = Number(values.lat);
  values.lon = Number(values.lon);
  try {
    const result = await api("/api/admin/camps", { method: "POST", body: JSON.stringify(values) });
    campForm.reset();
    campStatus.textContent = result.emailSent
      ? "Camp added to the website; an email notification was sent."
      : "Camp added to the website. Email notifications are not configured yet.";
    await loadAdminCamps();
  } catch (error) { campStatus.textContent = error.message; }
  finally { button.disabled = false; }
});

refreshView();
