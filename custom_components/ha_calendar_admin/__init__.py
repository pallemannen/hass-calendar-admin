"""The Calendar Admin integration.

Registers an admin-only sidebar panel for managing which calendars are
visible, in what order, on a FullCalendar-based merged view.
"""

from __future__ import annotations

import json

from homeassistant.components.frontend import async_remove_panel
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.panel_custom import async_register_panel
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .const import (
    JS_MODULE_URL,
    PANEL_URL_PATH,
    STATIC_URL_BASE,
    WEBCOMPONENT_NAME,
)

PLATFORMS: list[str] = []


def _read_manifest_version(hass: HomeAssistant) -> str:
    """Read this integration's own version from manifest.json."""
    manifest_path = hass.config.path(
        "custom_components/ha_calendar_admin/manifest.json"
    )
    with open(manifest_path, encoding="utf-8") as manifest_file:
        return json.load(manifest_file)["version"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Calendar Admin from a config entry."""
    www_path = hass.config.path("custom_components/ha_calendar_admin/www")

    # cache_headers=True below sends `Cache-Control: public, max-age=<1 month>`
    # (see homeassistant.components.http.static.CACHE_TIME) -- correct for a
    # file that never changes, wrong for one that gets updated on every
    # release under the *same* URL: browsers (dynamically-imported ES modules
    # especially, which a plain hard-reload doesn't reliably bypass) can hold
    # onto a month-old copy after an update. Fix is the standard one: keep
    # the aggressive caching (safe once the URL is versioned, since a given
    # version's content genuinely never changes) but bust it by putting the
    # integration's own version in the module URL, so every release is
    # inherently a new URL with nothing stale to serve.
    version = await hass.async_add_executor_job(_read_manifest_version, hass)

    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL_BASE, www_path, True)]
    )

    await async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=WEBCOMPONENT_NAME,
        sidebar_title="Calendar Admin",
        sidebar_icon="mdi:calendar-multiple-check",
        module_url=f"{JS_MODULE_URL}?v={version}",
        embed_iframe=False,
        trust_external=False,
        require_admin=True,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    return True
