# Calendar Admin

Hass Calendar Admin is a replacement for the stock Calendar sidebar panel
provided by Home Assistant, with some additional features — specifically the
two things the built-in Calendar panel doesn't offer:

- **Live checkboxes** to show/hide each `calendar.*` entity, with a
  select-all/none control.
- **A sort-order menu** for the calendar list (name A→Z, name Z→A, or
  entity ID), instead of the built-in panel's registration-order list.

Events from every checked calendar are merged into one
[FullCalendar](https://fullcalendar.io/) month/week/day/list view, each
calendar colored consistently. Your checkbox and sort selections persist
across reloads (stored in the browser).

This is a thin integration: no entities, no config options, no YAML. Install
it, add it once via the config flow, and it registers itself as a sidebar
panel — visible only to admin users, since it's an administrative tool for
managing a large calendar list, not a display card for a dashboard. (For a
normal dashboard display card, see something like
[Calendar Card Pro](https://github.com/alexpfau/calendar-card-pro) instead.)

## Install (via HACS)

1. HACS → the "⋮" menu (top right) → **Custom repositories**.
2. Repository: `pallemannen/hass-calendar-admin`, Category: **Integration**.
3. Install **Calendar Admin**, then restart Home Assistant Core.
4. Settings → Devices & Services → **Add Integration** → search for
   "Calendar Admin" → confirm. No fields to fill in.
5. "Calendar Admin" appears in the sidebar (admin users only).

## How it works

- FullCalendar is vendored locally in this repo
  (`custom_components/ha_calendar_admin/www/vendor/`) — no CDN dependency at
  runtime, works fully offline.
- The panel calls Home Assistant's existing `GET /api/calendars/<entity_id>`
  REST endpoint per visible calendar, through the browser's already
  authenticated session — same data source the built-in Calendar panel uses.
- Checkbox/sort state lives in `localStorage`, scoped to the browser, not to
  a Home Assistant user or entity registry.

## Uninstall

Settings → Devices & Services → Calendar Admin → delete. Then remove it via
HACS.
