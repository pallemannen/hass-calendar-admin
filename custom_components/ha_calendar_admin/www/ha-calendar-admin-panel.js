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
const STORAGE_FIRST_DAY = "ha-calendar-admin-panel.first-day";
const STORAGE_COLORS = "ha-calendar-admin-panel.colors";
const STORAGE_WEEK_NUMBERS = "ha-calendar-admin-panel.week-numbers";
const STORAGE_NOW_INDICATOR = "ha-calendar-admin-panel.now-indicator";
const STORAGE_MAX_EVENTS = "ha-calendar-admin-panel.max-events";
const STORAGE_24H = "ha-calendar-admin-panel.24h-time";

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

function loadFirstDay() {
  try {
    const raw = window.localStorage.getItem(STORAGE_FIRST_DAY);
    return raw === null ? 1 : parseInt(raw, 10);
  } catch (err) {
    return 1;
  }
}

function saveFirstDay(value) {
  try {
    window.localStorage.setItem(STORAGE_FIRST_DAY, String(value));
  } catch (err) {
    // ignore
  }
}

function loadColorOverrides() {
  try {
    const raw = window.localStorage.getItem(STORAGE_COLORS);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    return {};
  }
}

function saveColorOverrides(overrides) {
  try {
    window.localStorage.setItem(STORAGE_COLORS, JSON.stringify(overrides));
  } catch (err) {
    // ignore
  }
}

function loadBoolSetting(key, defaultValue) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? defaultValue : raw === "true";
  } catch (err) {
    return defaultValue;
  }
}

function saveBoolSetting(key, value) {
  try {
    window.localStorage.setItem(key, String(value));
  } catch (err) {
    // ignore
  }
}

// "" means unlimited (FullCalendar's dayMaxEvents: false).
function loadMaxEvents() {
  try {
    const raw = window.localStorage.getItem(STORAGE_MAX_EVENTS);
    return raw === null || raw === "" ? false : parseInt(raw, 10);
  } catch (err) {
    return false;
  }
}

function saveMaxEvents(value) {
  try {
    window.localStorage.setItem(STORAGE_MAX_EVENTS, value === false ? "" : String(value));
  } catch (err) {
    // ignore
  }
}

// hex, not hsl(), because <input type="color"> requires a hex value and
// this color also gets used to seed that input.
function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (n) => Math.round(255 * f(n)).toString(16).padStart(2, "0");
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`;
}

// Stable, deterministic color per calendar entity so the same calendar
// always gets the same color across reloads/sort changes, unless the user
// picked their own via the color swatch (see _colorFor).
function colorForEntity(entityId) {
  let hash = 0;
  for (let i = 0; i < entityId.length; i++) {
    hash = (hash * 31 + entityId.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return hslToHex(hue, 62, 45);
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
  /* Below this width, a fixed 280px sidebar leaves too little room for
     FullCalendar to render a usable grid (each day column can end up a
     few px wide). Stack the sidebar above the calendar instead so the
     calendar always gets the full width. */
  @media (max-width: 700px) {
    .layout {
      flex-direction: column;
    }
    .sidebar {
      width: 100%;
      flex: 0 0 auto;
      max-height: 35vh;
      border-right: none;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
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
  .option-row {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    cursor: pointer;
    user-select: none;
  }
  .option-row.max-events-row {
    justify-content: space-between;
    cursor: default;
  }
  .option-row.max-events-row select {
    width: auto;
    padding: 3px 6px;
    border-radius: 4px;
    border: 1px solid var(--divider-color, #e0e0e0);
    background: var(--card-background-color, #fff);
    color: var(--primary-text-color, #212121);
    font-size: 13px;
  }
  select#sort-select,
  select#first-day-select {
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
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    flex: 0 0 14px;
    padding: 0;
    border: 1px solid rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    cursor: pointer;
    background: none;
  }
  .dot::-webkit-color-swatch-wrapper {
    padding: 0;
    border-radius: 50%;
  }
  .dot::-webkit-color-swatch {
    border: none;
    border-radius: 50%;
  }
  .dot::-moz-color-swatch {
    border: none;
    border-radius: 50%;
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
    this._firstDay = loadFirstDay();
    this._colorOverrides = loadColorOverrides();
    this._weekNumbers = loadBoolSetting(STORAGE_WEEK_NUMBERS, true);
    this._nowIndicator = loadBoolSetting(STORAGE_NOW_INDICATOR, true);
    this._maxEvents = loadMaxEvents();
    this._time24h = loadBoolSetting(STORAGE_24H, true);
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
    // HA Core 2026.8 regression: the generic <ha-custom-panel> wrapper gets a
    // broken computed height on wide viewports, collapsing anything inside
    // that relies on percentage-based height (like :host { height: 100% }
    // below). vh/dvh sidestep the broken parent entirely instead of
    // depending on it having a resolvable height.
    this.style.display = "block";
    this.style.height = "100vh";
    this.style.height = "100dvh";

    if (this._hass && !this._rendered) {
      this._render();
    } else if (this._calendar) {
      this._calendar.updateSize();
    }
  }

  disconnectedCallback() {
    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
      this._resizeObserver = null;
    }
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
            <select id="first-day-select">
              <option value="0">Week starts Sunday</option>
              <option value="1">Week starts Monday</option>
            </select>
            <label class="option-row">
              <input type="checkbox" id="week-numbers-toggle">
              <span>Show week numbers</span>
            </label>
            <label class="option-row">
              <input type="checkbox" id="now-indicator-toggle">
              <span>Show current time indicator</span>
            </label>
            <label class="option-row">
              <input type="checkbox" id="time-format-toggle">
              <span>Use 24-hour time</span>
            </label>
            <label class="option-row max-events-row">
              <span>Max events per day</span>
              <select id="max-events-select">
                <option value="">Unlimited</option>
                <option value="3">3</option>
                <option value="5">5</option>
                <option value="8">8</option>
              </select>
            </label>
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
    this.shadowRoot.getElementById("first-day-select").value = String(this._firstDay);
    this.shadowRoot
      .getElementById("first-day-select")
      .addEventListener("change", (e) => this._onFirstDayChange(parseInt(e.target.value, 10)));
    this.shadowRoot.getElementById("week-numbers-toggle").checked = this._weekNumbers;
    this.shadowRoot
      .getElementById("week-numbers-toggle")
      .addEventListener("change", (e) => this._onWeekNumbersChange(e.target.checked));
    this.shadowRoot.getElementById("now-indicator-toggle").checked = this._nowIndicator;
    this.shadowRoot
      .getElementById("now-indicator-toggle")
      .addEventListener("change", (e) => this._onNowIndicatorChange(e.target.checked));
    this.shadowRoot.getElementById("time-format-toggle").checked = this._time24h;
    this.shadowRoot
      .getElementById("time-format-toggle")
      .addEventListener("change", (e) => this._onTime24hChange(e.target.checked));
    this.shadowRoot.getElementById("max-events-select").value =
      this._maxEvents === false ? "" : String(this._maxEvents);
    this.shadowRoot
      .getElementById("max-events-select")
      .addEventListener("change", (e) =>
        this._onMaxEventsChange(e.target.value === "" ? false : parseInt(e.target.value, 10))
      );
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
    try {
      this._calendar = new this._fc.Calendar(calendarEl, {
        headerToolbar: {
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
        },
        initialView: "dayGridMonth",
        // "100%" requires FullCalendar to correctly read this element's own
        // parent height at calculation time -- confirmed via live debugging
        // to lock in a stale, too-small value in this shadow-DOM/panel
        // setup (the .calendar-main container ended up 122px tall instead
        // of the real ~1300px available, with all actual grid content
        // rendering correctly but scrolled out of view below it). "auto"
        // sizes to actual content instead, sidestepping that measurement
        // entirely; .calendar-main's own overflow:auto still handles any
        // genuine overflow.
        height: "auto",
        firstDay: this._firstDay,
        weekNumbers: this._weekNumbers,
        nowIndicator: this._nowIndicator,
        dayMaxEvents: this._maxEvents,
        eventTimeFormat: this._timeFormat(),
        slotLabelFormat: this._timeFormat(),
        eventSources: this._entityIds
          .filter((id) => !this._hidden.has(id))
          .map((id) => makeEventSource(() => this._hass, id, this._colorFor(id))),
        // Fires whenever any event source (initial or dynamically added via
        // a checkbox toggle) finishes fetching -- the actual moment new
        // events land in the DOM, and the right time to force a fresh
        // measurement (see the updateSize() comment below for why one is
        // needed at all).
        loading: (isLoading) => {
          if (!isLoading && this._calendar) {
            this._calendar.updateSize();
          }
        },
      });
      this._calendar.render();
    } catch (err) {
      console.error("Calendar Admin: failed to initialize FullCalendar", err);
      calendarEl.innerHTML =
        '<div class="empty-state">Failed to initialize calendar. See browser console for details.</div>';
      return;
    }

    // FullCalendar measures its container's width on first render to decide
    // event layout, using a hidden-measure-then-reveal pass internally. If
    // that first measurement happens before the surrounding flexbox
    // (.calendar-main { flex: 1 }) has settled to its real width -- which
    // happens reliably inside a shadow root on first paint -- it measures 0
    // and never gets nudged to re-measure, leaving everything permanently
    // `visibility: hidden; width: 0`. Force one fresh measurement a couple
    // of frames after render, once real layout has settled.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (this._calendar) {
          this._calendar.updateSize();
        }
      });
    });

    // Keep re-measuring on any subsequent size change too (sidebar toggle,
    // window resize, narrow-mode changes).
    if (!this._resizeObserver) {
      this._resizeObserver = new ResizeObserver(() => {
        if (this._calendar) {
          this._calendar.updateSize();
        }
      });
      this._resizeObserver.observe(calendarEl);
    }

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

      const dot = document.createElement("input");
      dot.type = "color";
      dot.className = "dot";
      dot.value = this._colorFor(cal.entityId);
      dot.title = "Click to change this calendar's color";
      dot.addEventListener("click", (e) => e.stopPropagation());
      dot.addEventListener("input", (e) => this._onColorChange(cal.entityId, e.target.value));

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

  _onFirstDayChange(value) {
    this._firstDay = value;
    saveFirstDay(value);
    if (this._calendar) {
      this._calendar.setOption("firstDay", value);
    }
  }

  _onWeekNumbersChange(value) {
    this._weekNumbers = value;
    saveBoolSetting(STORAGE_WEEK_NUMBERS, value);
    if (this._calendar) {
      this._calendar.setOption("weekNumbers", value);
    }
  }

  _onNowIndicatorChange(value) {
    this._nowIndicator = value;
    saveBoolSetting(STORAGE_NOW_INDICATOR, value);
    if (this._calendar) {
      this._calendar.setOption("nowIndicator", value);
    }
  }

  _onMaxEventsChange(value) {
    this._maxEvents = value;
    saveMaxEvents(value);
    if (this._calendar) {
      this._calendar.setOption("dayMaxEvents", value);
    }
  }

  _timeFormat() {
    return { hour: "2-digit", minute: "2-digit", hour12: !this._time24h };
  }

  _onTime24hChange(value) {
    this._time24h = value;
    saveBoolSetting(STORAGE_24H, value);
    if (this._calendar) {
      this._calendar.setOption("eventTimeFormat", this._timeFormat());
      this._calendar.setOption("slotLabelFormat", this._timeFormat());
    }
  }

  _colorFor(entityId) {
    return this._colorOverrides[entityId] || colorForEntity(entityId);
  }

  _onColorChange(entityId, hexColor) {
    this._colorOverrides[entityId] = hexColor;
    saveColorOverrides(this._colorOverrides);
    // Existing rendered events keep their old color until re-fetched, so
    // force that by removing and re-adding the source (same pattern as a
    // checkbox toggle) rather than trying to recolor in place.
    if (this._calendar && !this._hidden.has(entityId)) {
      const existing = this._calendar.getEventSourceById(entityId);
      if (existing) {
        existing.remove();
      }
      this._calendar.addEventSource(
        makeEventSource(() => this._hass, entityId, hexColor)
      );
    }
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
          makeEventSource(() => this._hass, entityId, this._colorFor(entityId))
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
