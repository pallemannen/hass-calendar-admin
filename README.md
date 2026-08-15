# Calendar Admin

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?category=Integration&repository=hass-calendar-admin&owner=pallemannen)

Hass Calendar Admin is a replacement for the stock Calendar sidebar panel
provided by Home Assistant, with some additional features that the
built-in Calendar panel doesn't offer:

- **Global checkbox** to show/hide each `calendar.*` entity.
- **Sort order** for the calendar list (name A→Z, name Z→A, or
  entity ID), instead of the built-in panel's registration-order list.
  Default is A→Z.
- **Week start** configurable to Monday or Sunday. Default is Monday.
- **Week numbers** on or off. Default is on.
- **Color picker** to change the color of each calendar. The default
  is derived from the entity ID.
- **Timeline** to indicate current time in weekly and daily views. Default
  is on.
- **Max events** to show per day. Default is unlimited.
- **24h** or 12h clock. Default is 24h.

Events from every checked calendar are merged into one
[FullCalendar](https://fullcalendar.io/) month/week/day/list view, each
calendar colored consistently. Your checkbox and sort selections persist
across reloads (stored in the browser).

This is a thin integration: no entities, no install time config options, 
no YAML. Install it, add it once via the config flow, and it registers itself 
as a sidebar panel — visible only to admin users, since it's an administrative 
tool for managing a large calendar list, not a display card for a dashboard. 
(For a normal dashboard display card, see something like [Calendar Card Pro](https://github.com/alexpfau/calendar-card-pro)
instead.)

<img width="2034" height="1554" alt="screenshot" src="https://github.com/user-attachments/assets/8bdd86e1-c9b2-4c05-8e7b-ac4a3dbd6747" />

<img width="200" alt="phone1" src="https://github.com/user-attachments/assets/9729164a-036c-4abb-9515-3e133b3e953d" />      <img width="200" alt="phone2" src="https://github.com/user-attachments/assets/5959bf7f-f4f0-42e6-b6cc-b981b94c0ef0" />      <img width="200" alt="phone3" src="https://github.com/user-attachments/assets/fd501ab1-7cb9-45d0-8ea9-c52b5f2c51f2" />


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
- Configuration state lives in `localStorage`, scoped to the browser, not to
  a Home Assistant user or entity registry.

## Uninstall

Settings → Devices & Services → Calendar Admin → delete. Then remove it via
HACS.

## HACS

More info about HACS can be found at https://www.hacs.xyz/

## License

MIT - see [LICENSE](LICENSE).

## Icon

Icon credits go to [Magnific - Flaticon](https://www.flaticon.com/free-icons/calendar)
