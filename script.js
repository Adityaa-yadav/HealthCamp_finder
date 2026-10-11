// HealthCamp Finder frontend: camp search, location sorting, language switching and registration.
const languageButton = document.getElementById("languageToggle");
const citySearch = document.getElementById("citySearch");
const serviceSelect = document.getElementById("specialty");
const campGrid = document.getElementById("campGrid");
const featuredCamps = document.getElementById("featuredCamps");
const noResultsMessage = document.getElementById("noResults");
const locationButton = document.getElementById("locationButton");
const registerForm = document.getElementById("registerForm");
const registerStatus = document.getElementById("registerStatus");
const volunteerForm = document.getElementById("volunteerForm");
const volunteerStatus = document.getElementById("volunteerStatus");
const volunteerFormCard = document.getElementById("volunteerFormCard");
let isHindi = false;
let camps = [];
let userLocation = null;

const serviceNames = {
  eye: { en: "Eye care", hi: "नेत्र देखभाल", icon: "👁", className: "" },
  general: { en: "General health", hi: "सामान्य स्वास्थ्य", icon: "⚕", className: "orange" },
  women: { en: "Women & child", hi: "महिला और बाल", icon: "♥", className: "purple" }
};

const DEMO_CAMPS = [
  {
    id: "sample-delhi-eye", name: "Free Vision Screening Camp", nameHi: "निःशुल्क दृष्टि जाँच शिविर",
    service: "eye", city: "New Delhi", address: "Community Centre", date: "2026-10-18", time: "10 AM – 4 PM",
    lat: 28.6139, lon: 77.209, description: "Vision screening and basic eye-care guidance.",
    descriptionHi: "दृष्टि जाँच और आँखों की देखभाल संबंधी सामान्य सलाह।"
  },
  {
    id: "sample-mumbai-general", name: "Healthy Families Health Camp", nameHi: "स्वस्थ परिवार स्वास्थ्य शिविर",
    service: "general", city: "Mumbai", address: "Shivaji Nagar", date: "2026-10-20", time: "9 AM – 3 PM",
    lat: 19.076, lon: 72.8777, description: "General health check-ups for families.",
    descriptionHi: "परिवारों के लिए सामान्य स्वास्थ्य जाँच।"
  },
  {
    id: "sample-bengaluru-women", name: "Mother & Child Wellness Day", nameHi: "माँ और बच्चे का स्वास्थ्य दिवस",
    service: "women", city: "Bengaluru", address: "Indiranagar", date: "2026-10-22", time: "10 AM – 2 PM",
    lat: 12.9716, lon: 77.5946, description: "Wellness information and basic screening for mothers and children.",
    descriptionHi: "माताओं और बच्चों के लिए स्वास्थ्य जानकारी और सामान्य जाँच।"
  }
];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function distanceKm(first, second) {
  const radians = value => value * Math.PI / 180;
  const deltaLat = radians(second.lat - first.lat);
  const deltaLon = radians(second.lon - first.lon);
  const a = Math.sin(deltaLat / 2) ** 2 + Math.cos(radians(first.lat)) * Math.cos(radians(second.lat)) * Math.sin(deltaLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function renderCamps() {
  const city = citySearch.value.trim().toLocaleLowerCase();
  const service = serviceSelect.value;
  const matching = camps.filter(camp => {
    const location = `${camp.city} ${camp.address}`.toLocaleLowerCase();
    return (!city || location.includes(city)) && (service === "all" || camp.service === service);
  });
  if (userLocation) matching.sort((a, b) => {
    const distanceA = Number.isFinite(a.lat) && Number.isFinite(a.lon) ? distanceKm(userLocation, a) : Infinity;
    const distanceB = Number.isFinite(b.lat) && Number.isFinite(b.lon) ? distanceKm(userLocation, b) : Infinity;
    return distanceA - distanceB;
  });

  campGrid.innerHTML = matching.map(camp => {
    const serviceInfo = serviceNames[camp.service] || serviceNames.general;
    const title = isHindi ? (camp.nameHi || camp.name) : camp.name;
    const date = new Date(`${camp.date}T00:00:00`).toLocaleDateString(isHindi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
    const distance = userLocation && Number.isFinite(camp.lat) && Number.isFinite(camp.lon)
      ? `<span>📍 ${distanceKm(userLocation, camp).toFixed(1)} km</span>` : "";
    const detail = isHindi ? (camp.descriptionHi || camp.description || "") : (camp.description || "");
    return `<article id="camp-${escapeHtml(camp.id)}" class="camp-card">
      <div class="camp-image img-${escapeHtml(camp.service)}">${serviceInfo.icon}</div>
      <div class="card-body"><span class="tag ${serviceInfo.className}">${isHindi ? serviceInfo.hi : serviceInfo.en}</span>
        <h3>${escapeHtml(title)}</h3><p>📍 <a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${camp.address}, ${camp.city}`)}" target="_blank" rel="noopener noreferrer">${escapeHtml(camp.address)}, ${escapeHtml(camp.city)} ↗</a></p>
        <div class="card-meta"><span>🗓 <b>${escapeHtml(date)}</b></span><span>◷ ${escapeHtml(camp.time)}</span>${distance}</div>
        ${detail ? `<p class="camp-description">${escapeHtml(detail)}</p>` : ""}
      </div></article>`;
  }).join("");
  noResultsMessage.hidden = matching.length !== 0;
}

function renderFeaturedCamps() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const previews = camps
    .filter(camp => camp.date && new Date(`${camp.date}T00:00:00`) >= today)
    .sort((a, b) => a.date.localeCompare(b.date));
  const heroTitle = document.getElementById("heroCampTitle");
  const heroSub = document.getElementById("heroCampSub");
  if (previews.length) {
    const featured = previews[0];
    const featuredDate = new Date(`${featured.date}T00:00:00`).toLocaleDateString(isHindi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
    heroTitle.textContent = isHindi ? (featured.nameHi || featured.name) : featured.name;
    heroSub.textContent = `${featuredDate} · ${featured.city}`;
  } else {
    heroTitle.textContent = isHindi ? "आगामी स्वास्थ्य शिविर" : "Upcoming health camp";
    heroSub.textContent = isHindi ? "जल्द ही जानकारी उपलब्ध होगी" : "Listings will appear here soon";
  }
  featuredCamps.innerHTML = previews.map(camp => {
    const serviceInfo = serviceNames[camp.service] || serviceNames.general;
    const title = isHindi ? (camp.nameHi || camp.name) : camp.name;
    const date = new Date(`${camp.date}T00:00:00`).toLocaleDateString(isHindi ? "hi-IN" : "en-IN", { day: "numeric", month: "short" });
    const place = `${camp.address}, ${camp.city}`;
    const description = isHindi ? (camp.descriptionHi || camp.description || "") : (camp.description || "");
    return `<article class="camp-card featured-card">
      <div class="camp-image img-${escapeHtml(camp.service)}">${serviceInfo.icon}</div>
      <div class="card-body">
        <span class="tag ${serviceInfo.className}">${isHindi ? serviceInfo.hi : serviceInfo.en}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>📍 <a class="map-link" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place)}" target="_blank" rel="noopener noreferrer">${escapeHtml(place)} ↗</a></p>
        <div class="card-meta"><span>🗓 <b>${escapeHtml(date)}</b></span><span>◷ ${escapeHtml(camp.time)}</span></div>
        ${description ? `<p class="camp-description">${escapeHtml(description)}</p>` : ""}
        <a class="camp-details-link" href="#camp-${escapeHtml(camp.id)}">${isHindi ? "विवरण देखें →" : "View details →"}</a>
      </div></article>`;
  }).join("") || `<p class="featured-empty">${isHindi ? "अभी कोई आगामी शिविर सूचीबद्ध नहीं है। कृपया बाद में फिर देखें।" : "There are no upcoming camps listed right now. Please check again soon."}</p>`;
  updateFeaturedControls();
}

function updateFeaturedControls() {
  const previous = document.getElementById("featuredPrev");
  const next = document.getElementById("featuredNext");
  if (!previous || !next) return;
  const maxScroll = featuredCamps.scrollWidth - featuredCamps.clientWidth;
  previous.disabled = featuredCamps.scrollLeft <= 2;
  next.disabled = featuredCamps.scrollLeft >= maxScroll - 2;
}

function scrollFeatured(direction) {
  const firstCard = featuredCamps.querySelector(".featured-preview-card");
  if (!firstCard) return;
  const gap = parseFloat(getComputedStyle(featuredCamps).columnGap) || 0;
  featuredCamps.scrollBy({ left: direction * (firstCard.getBoundingClientRect().width + gap), behavior: "smooth" });
}

async function loadCamps() {
  try {
    const response = await fetch("/api/camps");
    if (!response.ok) throw new Error("Could not load camps");
    camps = await response.json();
    renderFeaturedCamps();
    renderCamps();
  } catch (error) {
    camps = DEMO_CAMPS;
    renderFeaturedCamps();
    renderCamps();
  }
}

function changeLanguage() {
  const language = isHindi ? "hi" : "en";
  document.documentElement.lang = language;
  languageButton.textContent = isHindi ? "English" : "हिंदी";
  document.querySelectorAll("[data-en]").forEach(element => {
    element.innerHTML = element.getAttribute(`data-${language}`);
  });
  citySearch.placeholder = citySearch.getAttribute(`data-${language}-placeholder`);
  registerForm.querySelectorAll("label span").forEach(span => {
    const label = span.getAttribute(`data-${language}`);
    if (label) span.textContent = label;
  });
  renderFeaturedCamps();
  renderCamps();
}

languageButton.addEventListener("click", () => { isHindi = !isHindi; changeLanguage(); });
citySearch.addEventListener("input", renderCamps);
serviceSelect.addEventListener("change", renderCamps);
document.getElementById("searchButton").addEventListener("click", renderCamps);
document.getElementById("featuredPrev").addEventListener("click", () => scrollFeatured(-1));
document.getElementById("featuredNext").addEventListener("click", () => scrollFeatured(1));
featuredCamps.addEventListener("scroll", updateFeaturedControls, { passive: true });
window.addEventListener("resize", updateFeaturedControls);

function showVolunteerForm() {
  document.getElementById("volunteerPrompt").hidden = true;
  volunteerFormCard.hidden = false;
  history.replaceState(null, "", "#volunteer");
  document.getElementById("volunteer").scrollIntoView({ behavior: "smooth", block: "start" });
  volunteerForm.querySelector("input[name=name]").focus({ preventScroll: true });
}

document.querySelector('.nav-links a[href="#volunteer"]').addEventListener("click", event => {
  event.preventDefault();
  showVolunteerForm();
});

document.getElementById("openVolunteerForm").addEventListener("click", showVolunteerForm);

if (window.location.hash === "#volunteer") {
  document.getElementById("volunteerPrompt").hidden = true;
  volunteerFormCard.hidden = false;
}

locationButton.addEventListener("click", () => {
  window.open("https://www.google.com/maps/search/health+camps+near+me", "_blank", "noopener,noreferrer");
  if (!navigator.geolocation) {
    alert(isHindi ? "आपके ब्राउज़र में स्थान सुविधा उपलब्ध नहीं है।" : "Location is not available in this browser.");
    return;
  }
  locationButton.disabled = true;
  navigator.geolocation.getCurrentPosition(position => {
    userLocation = { lat: position.coords.latitude, lon: position.coords.longitude };
    locationButton.disabled = false;
    locationButton.textContent = isHindi ? "✓ दूरी के अनुसार क्रमबद्ध" : "✓ Sorted by distance";
    renderCamps();
  }, () => {
    locationButton.disabled = false;
    alert(isHindi ? "स्थान नहीं मिला। कृपया ब्राउज़र की अनुमति जाँचें।" : "Could not get your location. Please check browser permissions.");
  }, { enableHighAccuracy: false, timeout: 10000 });
});

registerForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submitButton = registerForm.querySelector("button[type=submit]");
  submitButton.disabled = true;
  registerStatus.textContent = isHindi ? "जमा हो रहा है…" : "Submitting…";
  const values = Object.fromEntries(new FormData(registerForm).entries());
  try {
    const response = await fetch("/api/camps", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Registration failed");
    registerStatus.textContent = isHindi ? "शिविर सफलतापूर्वक जोड़ दिया गया।" : "Your camp has been added successfully.";
    registerForm.reset();
    await loadCamps();
    document.getElementById("camps").scrollIntoView({ behavior: "smooth" });
  } catch (error) {
    registerStatus.textContent = isHindi ? `जमा नहीं हो पाया: ${error.message}` : `Could not submit: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});

volunteerForm.addEventListener("submit", async event => {
  event.preventDefault();
  const button = volunteerForm.querySelector("button[type=submit]");
  button.disabled = true;
  volunteerStatus.textContent = isHindi ? "जमा हो रहा है…" : "Submitting…";
  const values = Object.fromEntries(new FormData(volunteerForm).entries());
  try {
    const response = await fetch("/api/volunteers", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not submit");
    volunteerForm.reset();
    volunteerStatus.textContent = isHindi ? "धन्यवाद! आपकी स्वयंसेवा रुचि भेज दी गई है।" : "Thank you! Your volunteer interest has been submitted.";
  } catch (error) {
    volunteerStatus.textContent = isHindi ? `जमा नहीं हो पाया: ${error.message}` : `Could not submit: ${error.message}`;
  } finally { button.disabled = false; }
});

loadCamps();
