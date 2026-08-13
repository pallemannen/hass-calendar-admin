"""Config flow for Calendar Admin."""

from __future__ import annotations

from homeassistant import config_entries

from .const import DOMAIN


class CalendarAdminConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Calendar Admin."""

    VERSION = 1

    async def async_step_user(self, user_input: dict | None = None):
        """Single-step, single-instance setup: nothing to configure."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(title="Calendar Admin", data={})

        return self.async_show_form(step_id="user")
