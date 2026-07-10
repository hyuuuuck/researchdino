from __future__ import annotations

import os


DEFAULT_ROLE_MODELS = {
    "search": "gpt-oss:20b-cloud",
    "reader": "qwen3.5:cloud",
    "critic": "gpt-oss:120b-cloud",
    "librarian": "gpt-oss:20b-cloud",
    "strategist": "nemotron-3-super:cloud",
    "experiment": "qwen3.5:cloud",
    "coordinator": "nemotron-3-super:cloud",
    "leader": "gpt-oss:120b-cloud",
    "writer": "qwen3.5:cloud",
}

ROLE_MODEL_ENV = {
    role: f"OLLAMA_{role.upper()}_MODEL"
    for role in DEFAULT_ROLE_MODELS
}


def model_for_role(role: str) -> str:
    default = DEFAULT_ROLE_MODELS.get(role, DEFAULT_ROLE_MODELS["coordinator"])
    env_name = ROLE_MODEL_ENV.get(role)
    return os.getenv(env_name, default).strip() if env_name else default


def role_model_assignments() -> dict[str, str]:
    return {role: model_for_role(role) for role in DEFAULT_ROLE_MODELS}
