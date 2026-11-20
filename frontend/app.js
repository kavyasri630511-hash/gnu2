const API_BASE = "https://gnu2-2.onrender.com";
const GUEST_ID_KEY = "gather_guest_id";
const REGISTERED_KEY = "gather_registered_events";

const grid = document.querySelector("#event-grid");
const notice = document.querySelector("#notice");
const emptyState = document.querySelector("#empty-state");
const eventCount = document.querySelector("#event-count");
const searchInput = document.querySelector("#search");
const statusFilter = document.querySelector("#status-filter");
const toast = document.querySelector("#toast");

let events = [];
let selectedStatus = "all";
let toastTimer;

function getGuestId() {
  let id = localStorage.getItem(GUEST_ID_KEY);
  if (!id) {
    id = globalThis.crypto?.randomUUID?.() || "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const random = Math.random() * 16 | 0;
      return (char === "x" ? random : (random & 3 | 8)).toString(16);
    });
    localStorage.setItem(GUEST_ID_KEY, id);
  }
  return id;
}

function getRegisteredEvents() {
  try {
    return new Set(JSON.parse(localStorage.getItem(REGISTERED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function saveRegisteredEvent(eventId) {
  const registered = getRegisteredEvents();
  registered.add(String(eventId));
  localStorage.setItem(REGISTERED_KEY, JSON.stringify([...registered]));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 3400);
}

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = !message;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}

function render() {
  const term = searchInput.value.trim().toLowerCase();
  const visibleEvents = events.filter((event) => {
    const matchesTerm = String(event.title || "").toLowerCase().includes(term);
    const matchesStatus = selectedStatus === "all" || String(event.status || "").toLowerCase() === selectedStatus;
    return matchesTerm && matchesStatus;
  });

  eventCount.textContent = `${visibleEvents.length} ${visibleEvents.length === 1 ? "event" : "events"}`;
  grid.setAttribute("aria-busy", "false");
  emptyState.hidden = visibleEvents.length > 0;
  grid.innerHTML = visibleEvents.map((event, index) => {
    const isRegistered = getRegisteredEvents().has(String(event.id));
    const status = event.status || "Open";
    const capacity = event.capacity == null ? "Capacity not listed" : `${escapeHtml(event.capacity)} spots total`;
    return `<article class="event-card">
      <div class="card-art card-art-${index % 5}" aria-hidden="true">
        <span class="card-index">PLAN ${String(index + 1).padStart(2, "0")}</span>
        <span class="card-star">✳</span><span class="card-sun"></span><span class="card-illustration"></span>
      </div>
      <div class="card-body">
        <div class="card-meta"><span class="status-pill">${escapeHtml(status)}</span><span class="capacity">${capacity}</span></div>
        <h3>${escapeHtml(event.title || "Untitled event")}</h3>
        <div class="card-footer"><span class="event-id">EVENT · ${escapeHtml(String(event.id).slice(0, 8))}</span>
          <button class="register-button" type="button" data-event-id="${escapeHtml(event.id)}" ${isRegistered ? "disabled" : ""}>
            ${isRegistered ? "You’re in" : "Save my spot"} <span aria-hidden="true">${isRegistered ? "✓" : "↗"}</span>
          </button>
        </div>
      </div>
    </article>`;
  }).join("");

  grid.querySelectorAll(".register-button:not(:disabled)").forEach((button) => {
    button.addEventListener("click", () => registerForEvent(button));
  });
}

function setStatusOptions() {
  const statuses = [...new Set(events.map((event) => String(event.status || "Open").toLowerCase()))].sort();
  statusFilter.innerHTML = '<option value="all">All events</option>' + statuses.map((status) =>
    `<option value="${escapeHtml(status)}">${escapeHtml(status.charAt(0).toUpperCase() + status.slice(1))}</option>`
  ).join("");
}

async function loadEvents() {
  grid.innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
  grid.setAttribute("aria-busy", "true");
  showNotice("");
  try {
    const response = await fetch(`${API_BASE}/api/events`);
    if (!response.ok) throw new Error(`The events service returned ${response.status}.`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("The events service returned an unexpected response.");
    events = data;
    setStatusOptions();
    render();
  } catch (error) {
    events = [];
    eventCount.textContent = "Events are taking a moment";
    grid.innerHTML = "";
    grid.setAttribute("aria-busy", "false");
    emptyState.hidden = true;
    showNotice("We couldn’t reach the events service. It may be starting up. Give it a moment, then refresh the page.");
  }
}

async function registerForEvent(button) {
  const eventId = button.dataset.eventId;
  button.disabled = true;
  button.innerHTML = 'Saving… <span aria-hidden="true">·</span>';
  try {
    const response = await fetch(`${API_BASE}/api/registrations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: getGuestId(), event_id: eventId }),
    });
    const body = await response.json().catch(() => ({}));
    if (response.ok) {
      saveRegisteredEvent(eventId);
      render();
      showToast("You’re on the list. See you there! ✳");
      return;
    }
    if (response.status === 409 && /already registered/i.test(body.error || "")) {
      saveRegisteredEvent(eventId);
      render();
      showToast("You’re already on the list for this one.");
      return;
    }
    button.disabled = false;
    button.innerHTML = 'Save my spot <span aria-hidden="true">↗</span>';
    showToast(body.error || "We couldn’t save your spot. Please try again.");
  } catch {
    button.disabled = false;
    button.innerHTML = 'Save my spot <span aria-hidden="true">↗</span>';
    showToast("Couldn’t reach the events service. Please try again.");
  }
}

searchInput.addEventListener("input", render);
statusFilter.addEventListener("change", () => {
  selectedStatus = statusFilter.value;
  render();
});
document.querySelector("#clear-filters").addEventListener("click", () => {
  searchInput.value = "";
  statusFilter.value = "all";
  selectedStatus = "all";
  render();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
    event.preventDefault();
    searchInput.focus();
  }
});

loadEvents();
