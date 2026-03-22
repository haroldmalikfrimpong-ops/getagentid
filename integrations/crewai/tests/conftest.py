"""Test configuration — provide a mock crewai.tools.BaseTool on Python versions
where CrewAI is not installable (e.g. 3.14+) so the test suite can still
validate the HTTP/business logic."""

import sys
from types import ModuleType
from typing import Any, Type

# If crewai is not installed, inject a lightweight mock so the tool modules
# can be imported without error.
if "crewai" not in sys.modules:
    from pydantic import BaseModel as _PydanticBase

    class _MockBaseTool(_PydanticBase):
        """Stand-in for crewai.tools.BaseTool during testing."""
        name: str = ""
        description: str = ""
        args_schema: Any = None

        def _run(self, *args: Any, **kwargs: Any) -> str:
            raise NotImplementedError

        model_config = {"arbitrary_types_allowed": True}

    # Build the module hierarchy: crewai -> crewai.tools
    crewai_mod = ModuleType("crewai")
    crewai_tools_mod = ModuleType("crewai.tools")
    crewai_tools_mod.BaseTool = _MockBaseTool  # type: ignore[attr-defined]
    crewai_mod.tools = crewai_tools_mod  # type: ignore[attr-defined]

    sys.modules["crewai"] = crewai_mod
    sys.modules["crewai.tools"] = crewai_tools_mod
