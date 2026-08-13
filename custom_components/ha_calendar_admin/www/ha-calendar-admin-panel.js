/**
 * Calendar Admin panel.
 *
 * An admin-only sidebar panel that merges every `calendar.*` entity into
 * one FullCalendar view, with a live checkbox per calendar, a select-all/
 * none control, and a sort-order menu for the calendar list — the three
 * things the built-in Calendar panel doesn't offer.
 *
 * Loaded by Home Assistant via panel_custom as a plain ES module; no build
 * step, no framework. FullCalendar itself is vendored locally (vendor/) and
 * loaded as a classic global script the first time this element is used.
 */

const FC_SCRIPT_URL = "/ha_calendar_admin_static/vendor/fullcalendar.global.min.js";
const STORAGE_HIDDEN = "ha-calendar-admin-panel.hidden-calendars";
const STORAGE_SORT = "ha-calendar-admin-panel.sort";

let fcLoadPromise = null;

function loadFullCalendar() {
  if (window.FullCalendar) {
    return Promise.resolve(window.FullCalendar);
  }
  if (!fcLoadPromise) {
    fcLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = FC_SCRIPT_URL;
      script.onload = () => resolve(window.FullCalendar);
      script.onerror = () => reject(new Error("Failed to load FullCalendar"));
      document.head.appendChild(script);
    });
  }
  return fcLoadPromise;
}

function loadHiddenSet() {
  try {
    const raw = window.localStorage.getItem(STORAGE_HIDDEN);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch (err) {
    return new Set();
  }
}

function saveHiddenSet(hiddenSet) {
  try {
    window.localStorage.setItem(STORAGE_HIDDEN, JSON.stringify([...hiddenSet]));
  } catch (err) {
    // localStorage unavailable (private browsing etc.) — not fatal, just
    // won't persist across reloads.
  }
}

function loadSort() {
  try {
    return window.localStorage.getItem(STORAGE_SORT) || "name-asc";
  } catch (err) {
    return "name-asc";
  }
}

function saveSort(value) {
  try {
    window.localStorage.setItem(STORAGE_SORT, value);
  } catch (err) {
    // ignore
  }
}

// Stable, deterministic color per calendar entity so the same calendar
// always gets the same color across reloads/sort changes.
function colorForEntity(entityId) {
  let hash = 0;
  for (let i = 0; i < entityId.length; i++) {
    hash = (hash * 31 + entityId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, 62%, 45%)`;
}

function friendlyName(stateObj) {
  return (stateObj.attributes && stateObj.attributes.friendly_name) || stateObj.entity_id;
}

function sortCalendars(calendars, sortKey) {
  const sorted = [...calendars];
  switch (sortKey) {
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name));
      break;
    case "entity-id":
      sorted.sort((a, b) => a.entityId.localeCompare(b.entityId));
      break;
    case "name-asc":
    default:
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
  }
  return sorted;
}

function toFcEvent(ev, entityId, color) {
  const start = ev.start.dateTime || ev.start.date;
  const end = ev.end.dateTime || ev.end.date;
  const allDay = !ev.start.dateTime;
  return {
    id: `${entityId}::${ev.uid || ev.summary}::${start}`,
    title: ev.summary || "(no title)",
    start,
    end,
    allDay,
    backgroundColor: color,
    borderColor: color,
    extendedProps: { calendarEntityId: entityId },
  };
}

function makeEventSource(getHass, entityId, color) {
  return {
    id: entityId,
    events: async (fetchInfo, successCallback, failureCallback) => {
      try {
        const hass = getHass();
        const path =
          `calendars/${entityId}?start=${encodeURIComponent(fetchInfo.startStr)}` +
          `&end=${encodeURIComponent(fetchInfo.endStr)}`;
        const events = await hass.callApi("GET", path);
        successCallback(events.map((ev) => toFcEvent(ev, entityId, color)));
      } catch (err) {
        failureCallback(err);
      }
    },
    color,
  };
}

const STYLE = `
  :host {
    display: block;
    height: 100%;
    background: var(--primary-background-color, #fafafa);
    color: var(--primary-text-color, #212121);
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    --fc-border-color: var(--divider-color, #e0e0e0);
    --fc-page-bg-color: var(--card-background-color, #fff);
    --fc-neutral-bg-color: var(--secondary-background-color, #f5f5f5);
    --fc-list-event-hover-bg-color: var(--secondary-background-color, #f5f5f5);
    --fc-today-bg-color: rgba(var(--rgb-primary-color, 3, 169, 244), 0.08);
  }
  .layout {
    display: flex;
    height: 100%;
    box-sizing: border-box;
  }
  .sidebar {
    width: 280px;
    flex: 0 0 280px;
    border-right: 1px solid var(--divider-color, #e0e0e0);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    overflow: hidden;
  }
  .sidebar-header {
    padding: 12px 16px;
    border-bottom: 1px solid var(--divider-color, #e0e0e0);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .select-all-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    cursor: pointer;
    user-select: none;
  }
  select#sort-select {
    width: 100%;
    padding: 6px 8px;
    border-radius: 4px;
    border: 1px solid var(--divider-color, #e0e0e0);
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #212121);
    font-size: 13px;
  }
  ul.calendar-list {
    list-style: none;
    margin: 0;
    padding: 4px 0;
    overflow-y: auto;
    flex: 1;
  }
  ul.calendar-list li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 16px;
    cursor: pointer;
    user-select: none;
  }
  ul.calendar-list li:hover {
    background: var(--secondary-background-color, #f5f5f5);
  }
  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex: 0 0 10px;
  }
  .cal-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 14px;
  }
  .calendar-main {
    flex: 1;
    min-width: 0;
    padding: 16px;
    box-sizing: border-box;
    overflow: auto;
  }
  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--secondary-text-color, #727272);
  }
`;

class HaCalendarAdminPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._calendar = null;
    this._fc = null;
    this._entityIds = [];
    this._hidden = loadHiddenSet();
    this._sort = loadSort();
    this._rendered = false;
  }

  set hass(hass) {
    const previousHass = this._hass;
    this._hass = hass;
    if (!this._rendered) {
      this._render();
      return;
    }
    const newIds = this._collectCalendarEntityIds(hass);
    const idsChanged =
      newIds.length !== this._entityIds.length ||
      newIds.some((id, i) => id !== this._entityIds[i]);
    if (idsChanged) {
      this._entityIds = newIds;
      this._renderSidebarList();
      this._syncEventSources();
    }
  }

  get hass() {
    return this._hass;
  }

  set panel(panel) {
    this._panel = panel;
  }

  set narrow(narrow) {
    this._narrow = narrow;
  }

  connectedCallback() {
    if (this._hass && !this._rendered) {
      this._render();
    }
  }

  disconnectedCallback() {
    if (this._calendar) {
      this._calendar.destroy();
      this._calendar = null;
    }
  }

  _collectCalendarEntityIds(hass) {
    return Object.keys(hass.states)
      .filter((id) => id.startsWith("calendar."))
      .sort();
  }

  async _render() {
    this._rendered = true;
    this._entityIds = this._collectCalendarEntityIds(this._hass);

    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <div class="layout">
        <aside class="sidebar">
          <div class="sidebar-header">
            <label class="select-all-row">
              <input type="checkbox" id="select-all">
              <span>All calendars</span>
            </label>
            <select id="sort-select">
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="entity-id">Entity ID</option>
            </select>
          </div>
          <ul class="calendar-list" id="calendar-list"></ul>
        </aside>
        <main class="calendar-main" id="calendar-main"></main>
      </div>
    `;

    this.shadowRoot.getElementById("sort-select").value = this._sort;
    this.shadowRoot
      .getElementById("sort-select")
      .addEventListener("change", (e) => this._onSortChange(e.target.value));
    this.shadowRoot
      .getElementById("select-all")
      .addEventListener("change", (e) => this._onSelectAll(e.target.checked));

    this._renderSidebarList();

    if (this._entityIds.length === 0) {
      this.shadowRoot.getElementById("calendar-main").innerHTML =
        '<div class="empty-state">No calendar entities found.</div>';
      return;
    }

    try {
      this._fc = await loadFullCalendar();
    } catch (err) {
      this.shadowRoot.getElementById("calendar-main").innerHTML =
        '<div class="empty-state">Failed to load calendar library.</div>';
      return;
    }

    const calendarEl = this.shadowRoot.getElementById("calendar-main");
    this._calendar = new this._fc.Calendar(calendarEl, {
      headerToolbar: {
        left: "prev,next today",
        center: "title",
        right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
      },
      initialView: "dayGridMonth",
      height: "100%",
      firstDay: 0,
      eventSources: this._entityIds
        .filter((id) => !this._hidden.has(id))
        .map((id) => makeEventSource(() => this._hass, id, colorForEntity(id))),
    });
    this._calendar.render();
    this._updateSelectAllState();
  }

  _renderSidebarList() {
    const listEl = this.shadowRoot.getElementById("calendar-list");
    const calendars = this._entityIds.map((entityId) => ({
      entityId,
      name: friendlyName(this._hass.states[entityId]),
    }));
    const sorted = sortCalendars(calendars, this._sort);

    listEl.innerHTML = "";
    for (const cal of sorted) {
      const li = document.createElement("li");
      li.dataset.entityId = cal.entityId;

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = !this._hidden.has(cal.entityId);
      checkbox.addEventListener("change", () =>
        this._onToggleCalendar(cal.entityId, checkbox.checked)
      );

      const dot = document.createElement("span");
      dot.className = "dot";
      dot.style.background = colorForEntity(cal.entityId);

      const name = document.createElement("span");
      name.className = "cal-name";
      name.textContent = cal.name;
      name.title = cal.entityId;

      li.appendChild(checkbox);
      li.appendChild(dot);
      li.appendChild(name);
      li.addEventListener("click", (e) => {
        if (e.target !== checkbox) {
          checkbox.checked = !checkbox.checked;
          checkbox.dispatchEvent(new Event("change"));
        }
      });
      listEl.appendChild(li);
    }
    this._updateSelectAllState();
  }

  _onSortChange(value) {
    this._sort = value;
    saveSort(value);
    this._renderSidebarList();
  }

  _onToggleCalendar(entityId, visible) {
    if (visible) {
      this._hidden.delete(entityId);
    } else {
      this._hidden.add(entityId);
    }
    saveHiddenSet(this._hidden);
    this._syncEventSources();
    this._updateSelectAllState();
  }

  _onSelectAll(checked) {
    if (checked) {
      this._hidden.clear();
    } else {
      this._entityIds.forEach((id) => this._hidden.add(id));
    }
    saveHiddenSet(this._hidden);
    this._renderSidebarList();
    this._syncEventSources();
  }

  _syncEventSources() {
    if (!this._calendar) {
      return;
    }
    for (const entityId of this._entityIds) {
      const existing = this._calendar.getEventSourceById(entityId);
      const shouldShow = !this._hidden.has(entityId);
      if (shouldShow && !existing) {
        this._calendar.addEventSource(
          makeEventSource(() => this._hass, entityId, colorForEntity(entityId))
        );
      } else if (!shouldShow && existing) {
        existing.remove();
      }
    }
  }

  _updateSelectAllState() {
    const selectAll = this.shadowRoot.getElementById("select-all");
    if (!selectAll) {
      return;
    }
    const total = this._entityIds.length;
    const hiddenCount = this._entityIds.filter((id) => this._hidden.has(id)).length;
    selectAll.checked = hiddenCount === 0;
    selectAll.indeterminate = hiddenCount > 0 && hiddenCount < total;
  }
}

customElements.define("ha-calendar-admin-panel", HaCalendarAdminPanel);
