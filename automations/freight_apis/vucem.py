"""VUCEM / USMCA cross-border scaffold (P2).

Cross-border (Mexico) support differs from rate providers: it generates customs
documents (USMCA certificate of origin, VUCEM pedimento) rather than rate
quotes, so it is intentionally NOT part of ``get_land_providers()``.

This is a documented scaffold. It returns mock documents until VUCEM
credentials are provisioned; the live path is left as an explicit
``NotImplementedError`` because production VUCEM is a credentialed government
SOAP/XML integration that must be built against official specs.
"""

from __future__ import annotations

import os
from typing import Any, Dict

from . import mocks
from .base import get_freight_api_mode


class VucemCrossBorder:
    """Mexico cross-border customs document generation (mock-first)."""

    name = "vucem"
    env_keys = ("VUCEM_RFC", "VUCEM_API_KEY")

    def is_configured(self) -> bool:
        return all(os.environ.get(k) for k in self.env_keys)

    def mode(self) -> str:
        if get_freight_api_mode() == "live" and self.is_configured():
            return "live"
        return "mock"

    def generate_usmca_certificate(self, shipment: Dict[str, Any]) -> Dict[str, Any]:
        """Generate a USMCA certificate of origin for ``shipment``."""
        if self.mode() == "live":
            raise NotImplementedError(
                "Live USMCA certificate generation requires the VUCEM integration "
                "to be implemented against official specs once credentials exist."
            )
        return mocks.usmca_certificate_mock(shipment)

    def submit_pedimento(self, shipment: Dict[str, Any]) -> Dict[str, Any]:
        """Submit a VUCEM pedimento (import/export declaration) for ``shipment``."""
        if self.mode() == "live":
            raise NotImplementedError(
                "Live VUCEM pedimento submission requires the VUCEM SOAP integration "
                "to be implemented against official specs once credentials exist."
            )
        return mocks.vucem_pedimento_mock(shipment)
