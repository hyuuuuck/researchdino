from __future__ import annotations

import os
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any

from . import storage


BUILD_TIMEOUT_SECONDS = 90
BUILD_LOG_LIMIT = 20_000
SAFE_ID_PATTERN = re.compile(r"[^A-Za-z0-9._-]+")
FORBIDDEN_TEX_PATTERN = re.compile(
    r"\\(?:"
    r"write18|input|include|openin|openout|read|write|immediate|catcode|csname|"
    r"newread|newwrite|special|pdfobj|pdfxform|directlua|usepackage|includegraphics|"
    r"graphicspath|lstinputlisting|verbatiminput|scantokens|iffileexists"
    r")\b",
    flags=re.IGNORECASE,
)


class ManuscriptError(ValueError):
    pass


def current_iso_time() -> str:
    return datetime.now().isoformat(timespec="seconds")


def artifact_root() -> Path:
    return storage.DB_PATH.parent / "manuscripts"


def manuscript_directory(manuscript_id: str) -> Path:
    safe_id = SAFE_ID_PATTERN.sub("-", manuscript_id).strip(".-")
    if not safe_id or safe_id != manuscript_id:
        raise ManuscriptError("Manuscript id contains unsupported path characters")
    root = artifact_root().resolve()
    target = (root / safe_id).resolve()
    if target.parent != root:
        raise ManuscriptError("Manuscript artifact path escaped its local data directory")
    return target


def latex_escape(value: Any) -> str:
    text = str(value or "")
    replacements = {
        "\\": r"\textbackslash{}",
        "&": r"\&",
        "%": r"\%",
        "$": r"\$",
        "#": r"\#",
        "_": r"\_",
        "{": r"\{",
        "}": r"\}",
        "~": r"\textasciitilde{}",
        "^": r"\textasciicircum{}",
    }
    return "".join(replacements.get(character, character) for character in text)


def bib_escape(value: Any) -> str:
    return latex_escape(value).replace("\n", " ").strip()


def output_text(value: str | bytes | None) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return value or ""


def citation_key(entry: dict[str, Any]) -> str:
    title_token = re.sub(r"[^A-Za-z0-9]+", "", str(entry.get("title") or "source"))[:18].lower() or "source"
    stable_token = re.sub(r"[^A-Za-z0-9]+", "", str(entry.get("id") or "entry"))[-10:].lower()
    return f"{title_token}{stable_token}"


def approved_library_sources(card: dict[str, Any]) -> list[dict[str, Any]]:
    project_id = card.get("projectId")
    lab_id = card.get("labId")
    entries = [
        entry
        for entry in storage.list_json("library_entries")
        if entry.get("sourceCardId") == card.get("id")
        and entry.get("projectId") == project_id
        and entry.get("labId") == lab_id
    ]
    if not entries:
        raise ManuscriptError("Writer requires a Leader-approved Library entry for the selected card")

    sources: list[dict[str, Any]] = []
    for entry in entries:
        source_card = storage.get_json("cards", str(entry.get("sourceCardId") or "")) or card
        paper_id = entry.get("sourcePaperId") or source_card.get("sourcePaperId")
        paper = storage.get_json("paper_files", str(paper_id)) if paper_id else None
        sources.append(
            {
                **entry,
                "citationKey": citation_key(entry),
                "authors": (paper or {}).get("authors", []),
                "doi": (paper or {}).get("doi") or source_card.get("details", {}).get("DOI"),
                "sourcePaper": (paper or {}).get("fileName"),
            }
        )
    return sources


def render_bibliography(sources: list[dict[str, Any]]) -> str:
    blocks: list[str] = []
    for source in sources:
        fields = [
            f"  title = {{{bib_escape(source.get('title') or 'Untitled approved source')}}}",
            f"  note = {{{bib_escape('Leader-approved ResearchDino Library entry ' + str(source.get('id') or ''))}}}",
        ]
        authors = [str(author).strip() for author in source.get("authors", []) if str(author).strip()]
        if authors:
            fields.append(f"  author = {{{bib_escape(' and '.join(authors))}}}")
        if source.get("doi"):
            fields.append(f"  doi = {{{bib_escape(source['doi'])}}}")
        blocks.append(
            "@misc{" + str(source["citationKey"]) + ",\n" + ",\n".join(fields) + "\n}"
        )
    return "\n\n".join(blocks) + "\n"


def normalized_sections(
    source_card: dict[str, Any],
    writer_output: dict[str, Any] | None,
    allowed_citations: list[str],
) -> list[dict[str, Any]]:
    output_sections = list((writer_output or {}).get("sections") or [])
    if output_sections:
        sections = []
        approved_summary = " ".join(str(source_card.get("summary") or "").split())
        for index, section in enumerate(output_sections):
            requested_citations = section.get("citation_keys") or []
            paragraphs = [str(item).strip() for item in section.get("paragraphs", []) if str(item).strip()]
            filtered_citations = [key for key in requested_citations if key in allowed_citations]
            requested_status = section.get("support_status", "citation_required")
            paragraphs_match_approved_summary = bool(paragraphs) and all(
                " ".join(paragraph.split()) == approved_summary
                for paragraph in paragraphs
            )
            support_status = requested_status
            if requested_status == "evidence_linked" and not paragraphs_match_approved_summary:
                support_status = "needs_user_review"
            sections.append(
                {
                    "id": f"section-{index + 1}",
                    "heading": str(section.get("heading") or f"Section {index + 1}").strip(),
                    "paragraphs": paragraphs,
                    "citationKeys": filtered_citations,
                    "supportStatus": support_status,
                    "order": index,
                }
            )
        return sections

    headings = list((writer_output or {}).get("outline_sections") or [])
    if not headings:
        headings = ["Abstract", "Introduction", "Evidence Synthesis", "Limitations", "Discussion"]
    summary = str(source_card.get("summary") or "Approved evidence summary pending.")
    unsupported = list((writer_output or {}).get("unsupported_points") or [])
    sections: list[dict[str, Any]] = []
    for index, heading in enumerate(headings):
        normalized_heading = str(heading).strip() or f"Section {index + 1}"
        heading_key = normalized_heading.lower()
        if "abstract" in heading_key:
            paragraphs = [summary]
            citations: list[str] = []
            support_status = "evidence_linked"
        elif "limitation" in heading_key and unsupported:
            paragraphs = [f"Needs user review: {item}" for item in unsupported]
            citations = []
            support_status = "needs_user_review"
        elif index == 1 or "introduction" in heading_key or "evidence" in heading_key:
            paragraphs = [summary]
            citations = allowed_citations[:]
            support_status = "evidence_linked"
        else:
            paragraphs = ["Writer placeholder: develop this section only from approved Library evidence."]
            citations = []
            support_status = "citation_required"
        sections.append(
            {
                "id": f"section-{index + 1}",
                "heading": normalized_heading,
                "paragraphs": paragraphs,
                "citationKeys": citations,
                "supportStatus": support_status,
                "order": index,
            }
        )
    return sections


def render_latex(title: str, sections: list[dict[str, Any]]) -> str:
    section_blocks: list[str] = []
    for section in sections:
        heading = str(section["heading"])
        paragraphs = list(section.get("paragraphs") or [])
        citation_keys = list(section.get("citationKeys") or [])
        support_status = str(section.get("supportStatus") or "citation_required")
        if heading.strip().lower() == "abstract":
            opening = "\\begin{abstract}"
            closing = "\\end{abstract}"
        else:
            opening = f"\\section{{{latex_escape(heading)}}}"
            closing = ""
        body_parts = [latex_escape(paragraph) for paragraph in paragraphs]
        if citation_keys and body_parts:
            body_parts[-1] += f" \\cite{{{','.join(citation_keys)}}}"
        if support_status != "evidence_linked":
            body_parts.append(
                "\\textit{ResearchDino support status: "
                + latex_escape(support_status.replace("_", " "))
                + ".}"
            )
        section_blocks.append("\n\n".join([opening, *body_parts, closing]).strip())

    return (
        "\\documentclass[11pt]{article}\n"
        "\\title{" + latex_escape(title) + "}\n"
        "\\author{ResearchDino Writing Studio}\n"
        "\\date{\\today}\n"
        "\\begin{document}\n"
        "\\maketitle\n\n"
        + "\n\n".join(section_blocks)
        + "\n\n\\bibliographystyle{plain}\n"
        "\\bibliography{references}\n"
        "\\end{document}\n"
    )


def validate_latex_source(source_tex: str, bibliography_bib: str) -> None:
    if not source_tex.strip():
        raise ManuscriptError("LaTeX source cannot be empty")
    if len(source_tex) > 500_000 or len(bibliography_bib) > 500_000:
        raise ManuscriptError("Manuscript source exceeds the 500 KB local build limit")
    if "^^" in source_tex or "\x00" in source_tex or "\x00" in bibliography_bib:
        raise ManuscriptError("TeX character-encoding escapes and null bytes are not allowed")
    forbidden = FORBIDDEN_TEX_PATTERN.search(source_tex) or FORBIDDEN_TEX_PATTERN.search(bibliography_bib)
    if forbidden:
        raise ManuscriptError(f"Unsafe LaTeX command is not allowed: {forbidden.group(0)}")
    document_class = re.findall(r"\\documentclass(?:\[[^\]]*\])?\{([^}]+)\}", source_tex)
    if document_class != ["article"]:
        raise ManuscriptError("The first Writer version supports only the safe article document class")
    bibliography_targets = re.findall(r"\\bibliography\{([^}]+)\}", source_tex)
    if bibliography_targets not in ([], ["references"]):
        raise ManuscriptError("The Writer can compile only its local references.bib file")
    if source_tex.count("\\begin{document}") != 1 or source_tex.count("\\end{document}") != 1:
        raise ManuscriptError("LaTeX source must contain exactly one document environment")


def write_artifacts(record: dict[str, Any]) -> Path:
    directory = manuscript_directory(record["id"])
    directory.mkdir(parents=True, exist_ok=True)
    validate_latex_source(record["sourceTex"], record["bibliographyBib"])
    (directory / "main.tex").write_text(record["sourceTex"], encoding="utf-8")
    (directory / "references.bib").write_text(record["bibliographyBib"], encoding="utf-8")
    return directory


def detect_compiler() -> tuple[str | None, list[str] | None]:
    tectonic = shutil.which("tectonic")
    if tectonic:
        return "tectonic", [tectonic, "--untrusted", "--keep-logs", "--outdir", "build", "main.tex"]
    latexmk = shutil.which("latexmk")
    if latexmk:
        return "latexmk", [
            latexmk,
            "-pdf",
            "-interaction=nonstopmode",
            "-halt-on-error",
            "-no-shell-escape",
            "-outdir=build",
            "main.tex",
        ]
    return None, None


def create_manuscript_document(
    manuscript_card: dict[str, Any],
    source_card: dict[str, Any],
    writer_output: dict[str, Any] | None,
) -> dict[str, Any]:
    sources = approved_library_sources(source_card)
    allowed_citations = [str(source["citationKey"]) for source in sources]
    sections = normalized_sections(source_card, writer_output, allowed_citations)
    title = str((writer_output or {}).get("title") or manuscript_card["title"])
    now = current_iso_time()
    record = {
        "id": manuscript_card["id"],
        "projectId": manuscript_card.get("projectId", "project-autophagy"),
        "labId": manuscript_card.get("labId"),
        "sourceCardId": source_card["id"],
        "title": title,
        "targetJournal": None,
        "version": 1,
        "status": "draft",
        "sourceTex": render_latex(title, sections),
        "bibliographyBib": render_bibliography(sources),
        "sections": sections,
        "citationKeys": allowed_citations,
        "libraryEntryIds": [source["id"] for source in sources],
        "build": {
            "status": "not_built",
            "compiler": None,
            "compilerAvailable": bool(detect_compiler()[0]),
            "pdfAvailable": False,
            "pdfUrl": None,
            "log": "",
            "error": None,
            "updatedAt": None,
        },
        "createdAt": now,
        "updatedAt": now,
    }
    write_artifacts(record)
    storage.put_json("manuscript_documents", record["id"], record)
    return record


def update_manuscript_document(
    manuscript_id: str,
    *,
    source_tex: str | None = None,
    bibliography_bib: str | None = None,
    target_journal: str | None = None,
) -> dict[str, Any]:
    record = storage.get_json("manuscript_documents", manuscript_id)
    if record is None:
        raise ManuscriptError(f"Manuscript {manuscript_id} was not found")
    next_source = source_tex if source_tex is not None else str(record["sourceTex"])
    next_bibliography = bibliography_bib if bibliography_bib is not None else str(record["bibliographyBib"])
    validate_latex_source(next_source, next_bibliography)
    record["sourceTex"] = next_source
    record["bibliographyBib"] = next_bibliography
    if target_journal is not None:
        record["targetJournal"] = target_journal.strip() or None
    record["version"] = int(record.get("version", 1)) + 1
    record["status"] = "draft"
    record["updatedAt"] = current_iso_time()
    record["build"] = {
        **record.get("build", {}),
        "status": "stale",
        "pdfAvailable": False,
        "pdfUrl": None,
        "error": None,
        "updatedAt": record["updatedAt"],
    }
    write_artifacts(record)
    pdf_path = manuscript_directory(manuscript_id) / "build" / "main.pdf"
    if pdf_path.exists():
        pdf_path.unlink()
    storage.put_json("manuscript_documents", manuscript_id, record)
    return record


def build_manuscript_document(manuscript_id: str) -> dict[str, Any]:
    record = storage.get_json("manuscript_documents", manuscript_id)
    if record is None:
        raise ManuscriptError(f"Manuscript {manuscript_id} was not found")
    directory = write_artifacts(record)
    build_dir = directory / "build"
    build_dir.mkdir(parents=True, exist_ok=True)
    compiler, command = detect_compiler()
    now = current_iso_time()
    if compiler is None or command is None:
        record["status"] = "draft"
        record["build"] = {
            "status": "compiler_unavailable",
            "compiler": None,
            "compilerAvailable": False,
            "pdfAvailable": False,
            "pdfUrl": None,
            "log": "",
            "error": "Install Tectonic or latexmk to compile the local LaTeX manuscript.",
            "updatedAt": now,
        }
        record["updatedAt"] = now
        storage.put_json("manuscript_documents", manuscript_id, record)
        return record

    tex_home = artifact_root() / ".tex-home"
    tex_cache = artifact_root() / ".tex-cache"
    tex_home.mkdir(parents=True, exist_ok=True)
    tex_cache.mkdir(parents=True, exist_ok=True)
    environment = {
        "PATH": os.environ.get("PATH", ""),
        "HOME": str(tex_home),
        "XDG_CACHE_HOME": str(tex_cache),
        "TECTONIC_CACHE_DIR": str(tex_cache / "tectonic"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "openin_any": "p",
        "openout_any": "p",
    }
    try:
        completed = subprocess.run(
            command,
            cwd=directory,
            env=environment,
            stdin=subprocess.DEVNULL,
            capture_output=True,
            text=True,
            timeout=BUILD_TIMEOUT_SECONDS,
            check=False,
        )
        log = (output_text(completed.stdout) + "\n" + output_text(completed.stderr)).strip()[-BUILD_LOG_LIMIT:]
        pdf_path = build_dir / "main.pdf"
        succeeded = completed.returncode == 0 and pdf_path.is_file()
        record["status"] = "compiled" if succeeded else "build_failed"
        record["build"] = {
            "status": "compiled" if succeeded else "failed",
            "compiler": compiler,
            "compilerAvailable": True,
            "pdfAvailable": succeeded,
            "pdfUrl": f"/manuscripts/{manuscript_id}/pdf" if succeeded else None,
            "log": log,
            "error": None if succeeded else f"{compiler} exited with status {completed.returncode}",
            "updatedAt": now,
        }
    except subprocess.TimeoutExpired as error:
        log = (output_text(error.stdout) + "\n" + output_text(error.stderr)).strip()[-BUILD_LOG_LIMIT:]
        record["status"] = "build_failed"
        record["build"] = {
            "status": "failed",
            "compiler": compiler,
            "compilerAvailable": True,
            "pdfAvailable": False,
            "pdfUrl": None,
            "log": log,
            "error": f"LaTeX build exceeded {BUILD_TIMEOUT_SECONDS} seconds",
            "updatedAt": now,
        }
    except OSError as error:
        record["status"] = "build_failed"
        record["build"] = {
            "status": "failed",
            "compiler": compiler,
            "compilerAvailable": True,
            "pdfAvailable": False,
            "pdfUrl": None,
            "log": "",
            "error": f"Local LaTeX compiler could not start: {error}",
            "updatedAt": now,
        }
    record["updatedAt"] = now
    storage.put_json("manuscript_documents", manuscript_id, record)
    return record


def manuscript_pdf_path(manuscript_id: str) -> Path:
    record = storage.get_json("manuscript_documents", manuscript_id)
    if record is None or not record.get("build", {}).get("pdfAvailable"):
        raise ManuscriptError("Compiled manuscript PDF is not available")
    pdf_path = manuscript_directory(manuscript_id) / "build" / "main.pdf"
    if not pdf_path.is_file():
        raise ManuscriptError("Compiled manuscript PDF is missing from local storage")
    return pdf_path
