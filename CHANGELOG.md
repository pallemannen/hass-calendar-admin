# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.6] - 2026-09-11

### Added

- Clicking a calendar event now pops up a details dialog (title, calendar
  name, date/time range, location, and description), matching the stock HA
  calendar panel's click-to-view behavior, which this panel previously
  lacked entirely (clicking an event did nothing). Built on the native
  browser `<dialog>` element (backdrop, Escape-to-close) rather than a
  hand-rolled overlay, and on FullCalendar's built-in `eventClick` hook.

## [0.2.5] - 2026-08-14

### Changed

- README updates: refreshed feature list (now includes now-indicator, max-events,
  and 24h/12h clock), tweaked wording.
- No functional code changes since v0.2.4.

## [0.2.4] - 2026-08-14

### Added

- A "Use 24-hour time" toggle, defaulting to on. Controls event time labels and
  the time-grid hour axis in week/day view. FullCalendar was previously falling
  back to 12-hour AM/PM formatting since no locale was set.

## [0.2.3] - 2026-08-14

### Added

- Swedish (sv) translation for the config-flow install dialog.

## [0.2.2] - 2026-08-14

First tagged release - from here on, every version bump gets a GitHub Release
so HACS shows real release notes in the update dialog instead of nothing.

### Added

- Merged multi-calendar FullCalendar view with live per-calendar checkboxes and
  select-all/none.
- Sort-order menu for the calendar list.
- First-day-of-week setting (Sunday/Monday).
- Per-calendar color picker.
- Optional week-numbers and now-indicator toggles.
- Optional max-events-per-day cap (default: unlimited/scroll).
- Panel JS is now cache-busted on every release, so updates should show up
  reliably after a Core restart without needing an incognito window or manual
  cache clear.

### Changed

- Default first day of week is now Monday instead of Sunday (only affects
  people who've never touched the dropdown - existing choices are unaffected).
