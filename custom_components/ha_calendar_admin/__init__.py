"""The Calendar Admin integration.

Registers an admin-only sidebar panel for managing which calendars are
visible, in what order, on a FullCalendar-based merged view.
"""

from __future__ import annotations

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


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up Calendar Admin from a config entry."""
    www_path = hass.config.path("custom_components/ha_calendar_admin/www")

    await hass.http.async_register_static_paths(
        [StaticPathConfig(STATIC_URL_BASE, www_path, True)]
    )

    await async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=WEBCOMPONENT_NAME,
        sidebar_title="Calendar Admin",
        sidebar_icon="mdi:calendar-multiple-check",
        module_url=JS_MODULE_URL,
        embed_iframe=False,
        trust_external=False,
        require_admin=True,
    )

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    return True
