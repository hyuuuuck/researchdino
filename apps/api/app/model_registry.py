from __future__ import annotations

import os


DEFAULT_ROLE_MODELS = {
    "search": "qwen3.5:latest",
    "reader": "qwen3.5:latest",
    "critic": "qwen3.5:latest",
    "librarian": "qwen3.5:latest",
    "strategist": "qwen3.5:latest",
    "experiment": "qwen3.5:latest",
    "coordinator": "qwen3.5:latest",
    "leader": "qwen3.5:latest",
    "writer": "qwen3.5:latest",
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
