const express = require("express");
const nodemailer = require("nodemailer");
const fs = require("node:fs");
const path = require("node:path");
const { randomUUID, randomBytes, scryptSync, timingSafeEqual } = require("node:crypto");

const app = express();
const ROOT = __dirname;
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "camps.json");
const VOLUNTEERS_FILE = path.join(DATA_DIR, "volunteers.json");
const ADMIN_FILE = path.join(DATA_DIR, "admin-auth.json");
const PORT = Number(process.env.PORT) || 3000;
const sessions = new Map();
const services = new Set(["eye", "general", "women"]);
const volunteerInterests = new Set(["outreach", "medical", "organising", "translation", "other"]);

fs.mkdirSync(DATA_DIR, { recursive: true });
app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use((req, res, next) => {
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (error) {
    if (error.code === "ENOENT") return fallback;
    throw error;
  }
}
function writeJson(file, value) {
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
function clean(value, maxLength) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}
function readAdmin() {
  try { return readJson(ADMIN_FILE, null); } catch { return null; }
}
function getSession(req) {
  const token = req.cookies?.hcf_admin;
  const expiresAt = token ? sessions.get(token) : null;
  if (!expiresAt || expiresAt < Date.now()) {
    if (token) sessions.delete(token);
    return null;
  }
  return token;
}
function setSession(res) {
  const token = randomBytes(32).toString("hex");
  sessions.set(token, Date.now() + 8 * 60 * 60 * 1000);
  res.cookie("hcf_admin", token, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", maxAge: 8 * 60 * 60 * 1000, path: "/" });
}
function requireAdmin(req, res, next) {
  if (!getSession(req)) return res.status(401).json({ error: "Sign in as admin to continue." });
  next();
}
function saveAdminPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  fs.writeFileSync(ADMIN_FILE, `${JSON.stringify({ salt, hash }, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}
function passwordMatches(password, admin) {
  if (typeof password !== "string" || !admin?.salt || !admin?.hash) return false;
  const expected = Buffer.from(admin.hash, "hex");
  const actual = scryptSync(password, admin.salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00`)); }
async function notifyAdmin(subject, fields, replyTo) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const recipient = process.env.NOTIFICATION_EMAIL;
  const host = process.env.SMTP_HOST;
  if (!smtpUser || !smtpPass || !recipient || !host) return false;
  try {
    const port = Number(process.env.SMTP_PORT) || 465;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000
    });
    await transporter.sendMail({
      from: process.env.MAIL_FROM || smtpUser,
      to: recipient,
      subject,
      text: fields.join("\n"),
      ...(replyTo ? { replyTo } : {})
    });
    return true;
  } catch {
    console.warn("Email notification could not reach the provider.");
    return false;
  }
}

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/admin/status", (req, res) => res.json({ configured: Boolean(readAdmin()), authenticated: Boolean(getSession(req)) }));
app.get("/api/admin/volunteers", requireAdmin, (_req, res) => {
  try { res.json(readJson(VOLUNTEERS_FILE, [])); }
  catch { res.status(500).json({ error: "Volunteer applications are temporarily unavailable." }); }
});
app.post("/api/volunteers", async (req, res) => {
  const input = req.body || {};
  const volunteer = {
    id: randomUUID(), name: clean(input.name, 100), email: clean(input.email, 150),
    city: clean(input.city, 120), interest: clean(input.interest, 30),
    message: clean(input.message, 500), submittedAt: new Date().toISOString()
  };
  if (!volunteer.name || !validEmail(volunteer.email) || !volunteer.city || !volunteerInterests.has(volunteer.interest)) {
    return res.status(400).json({ error: "Please complete all required volunteer fields." });
  }
  try {
    const volunteers = readJson(VOLUNTEERS_FILE, []);
    volunteers.push(volunteer);
    writeJson(VOLUNTEERS_FILE, volunteers);
    const emailSent = await notifyAdmin("New volunteer application", [
      `Name: ${volunteer.name}`, `Email: ${volunteer.email}`, `City: ${volunteer.city}`,
      `Interest: ${volunteer.interest}`, `Message: ${volunteer.message || "—"}`,
      `Submitted: ${volunteer.submittedAt}`
    ], volunteer.email);
    return res.status(201).json({ id: volunteer.id, emailSent });
  } catch { return res.status(500).json({ error: "Could not save volunteer interest." }); }
});
app.post("/api/admin/setup", (req, res) => {
  if (readAdmin()) return res.status(409).json({ error: "Admin is already set up. Please sign in." });
  const { password } = req.body || {};
  if (typeof password !== "string" || password.length < 12) return res.status(400).json({ error: "Choose a password with at least 12 characters." });
  try { saveAdminPassword(password); setSession(res); return res.status(201).json({ authenticated: true }); }
  catch { return res.status(500).json({ error: "Could not set up admin access." }); }
});
app.post("/api/admin/login", (req, res) => {
  const { password } = req.body || {};
  if (!passwordMatches(password, readAdmin())) return res.status(401).json({ error: "Incorrect password." });
  setSession(res);
  return res.json({ authenticated: true });
});
app.post("/api/admin/logout", (req, res) => {
  const token = getSession(req);
  if (token) sessions.delete(token);
  res.clearCookie("hcf_admin", { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production", path: "/" });
  res.json({ authenticated: false });
});
app.post("/api/admin/camps", requireAdmin, async (req, res) => {
  const input = req.body || {};
  const camp = {
    id: randomUUID(), name: clean(input.name, 100), nameHi: clean(input.nameHi, 100),
    service: clean(input.service, 20), city: clean(input.city, 120), address: clean(input.address, 200),
    date: clean(input.date, 10), time: clean(input.time, 40), lat: Number(input.lat), lon: Number(input.lon),
    description: clean(input.description, 500), descriptionHi: clean(input.descriptionHi, 500),
    email: clean(input.email, 150), verified: true
  };
  const coordinatesOk = Number.isFinite(camp.lat) && camp.lat >= -90 && camp.lat <= 90 && Number.isFinite(camp.lon) && camp.lon >= -180 && camp.lon <= 180;
  if (!camp.name || !services.has(camp.service) || !camp.city || !camp.address || !camp.time || !validDate(camp.date) || !coordinatesOk || (camp.email && !validEmail(camp.email))) {
    return res.status(400).json({ error: "Please check the camp details, date, coordinates and email." });
  }
  try {
    const camps = readJson(DATA_FILE, []);
    camps.push(camp);
    writeJson(DATA_FILE, camps);
    const emailSent = await notifyAdmin("New health camp organiser registration", [
      `Camp: ${camp.name}`, `Service: ${camp.service}`, `City: ${camp.city}`,
      `Address: ${camp.address}`, `Date: ${camp.date}`, `Time: ${camp.time}`,
      `Organiser email: ${camp.email}`
    ], camp.email);
    return res.status(201).json({ id: camp.id, emailSent });
  } catch { return res.status(500).json({ error: "Could not save the camp." }); }
});
app.get("/api/camps", (_req, res) => {
  try {
    const publicCamps = readJson(DATA_FILE, []).map(({ email, verified, ...camp }) => camp);
    res.json(publicCamps);
  } catch { res.status(500).json({ error: "Camp listings are temporarily unavailable." }); }
});
app.post("/api/camps", async (req, res) => {
  const input = req.body || {};
  const camp = {
    id: randomUUID(), name: clean(input.name, 100), service: clean(input.service, 20),
    city: clean(input.city, 120), address: clean(input.address, 200), date: clean(input.date, 10),
    time: clean(input.time, 40), email: clean(input.email, 150)
  };
  if (!camp.name || !services.has(camp.service) || !camp.city || !camp.address || !camp.time || !validEmail(camp.email) || !validDate(camp.date)) {
    return res.status(400).json({ error: "Please complete every field with valid details." });
  }
  try {
    const camps = readJson(DATA_FILE, []);
    camps.push(camp);
    writeJson(DATA_FILE, camps);
    const emailSent = await notifyAdmin("New health camp organiser registration", [
      `Camp: ${camp.name}`, `Service: ${camp.service}`, `City: ${camp.city}`,
      `Address: ${camp.address}`, `Date: ${camp.date}`, `Time: ${camp.time}`,
      `Organiser email: ${camp.email}`
    ], camp.email);
    return res.status(201).json({ id: camp.id, emailSent });
  } catch { return res.status(500).json({ error: "Could not save the camp." }); }
});

// Keep private JSON data outside the public static directory.
app.get("/admin", (_req, res) => res.sendFile(path.join(ROOT, "admin.html")));
app.use("/data", (_req, res) => res.status(404).send("Not found"));
app.use(express.static(ROOT, { index: "index.html", dotfiles: "ignore" }));
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && "body" in error) return res.status(400).json({ error: "Please submit valid form data." });
  if (error.type === "entity.too.large") return res.status(413).json({ error: "Request is too large." });
  console.error(error);
  return res.status(500).json({ error: "Something went wrong." });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`HealthCamp Finder is running on port ${PORT}`);
});
