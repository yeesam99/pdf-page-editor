from __future__ import annotations

import json
import os
import re
import shutil
import uuid
from pathlib import Path
from typing import Any

import fitz  # PyMuPDF
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel


BASE_DIR = Path(__file__).resolve().parent
WORKSPACE_DIR = Path(
    os.getenv("WORKSPACE_DIR", str(BASE_DIR / "workspace"))
).resolve()

WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

SESSION_RE = re.compile(r"^[0-9a-fA-F-]{36}$")

app = FastAPI(title="PDF 페이지 편집기")

allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "*").strip()
allowed_origins = (
    ["*"]
    if allowed_origins_raw == "*"
    else [
        origin.strip().rstrip("/")
        for origin in allowed_origins_raw.split(",")
        if origin.strip()
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


class OrderRequest(BaseModel):
    order: list[str]


class RotateRequest(BaseModel):
    page_ids: list[str]
    degrees: int


def validate_session_id(session_id: str) -> str:
    try:
        if not SESSION_RE.match(session_id):
            raise ValueError
        return str(uuid.UUID(session_id))
    except Exception:
        raise HTTPException(status_code=400, detail="잘못된 세션 ID입니다.")


def session_dir(session_id: str) -> Path:
    return WORKSPACE_DIR / validate_session_id(session_id)


def state_file(session_id: str) -> Path:
    return session_dir(session_id) / "state.json"


def create_empty_state(session_id: str) -> dict[str, Any]:
    return {
        "session_id": session_id,
        "files": [],
        "pages": [],
        "order": [],
        "latest_output": None,
    }


def save_state(session_id: str, state: dict[str, Any]) -> None:
    root = session_dir(session_id)
    root.mkdir(parents=True, exist_ok=True)
    state_file(session_id).write_text(
        json.dumps(state, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def load_state(session_id: str) -> dict[str, Any]:
    path = state_file(session_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="세션을 찾을 수 없습니다.")

    state = json.loads(path.read_text(encoding="utf-8"))

    # 회전 기능 추가 이전에 만들어진 로컬 세션도 계속 사용할 수 있게 합니다.
    for page in state.get("pages", []):
        page["rotation"] = int(page.get("rotation", 0)) % 360

    return state


def safe_filename(name: str) -> str:
    name = Path(name).name
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    return name[:180] or "file.pdf"


def get_page(state: dict[str, Any], page_id: str) -> dict[str, Any]:
    for page in state["pages"]:
        if page["id"] == page_id:
            return page
    raise HTTPException(status_code=404, detail="페이지를 찾을 수 없습니다.")


def get_file(state: dict[str, Any], file_id: str) -> dict[str, Any]:
    for file_info in state["files"]:
        if file_info["id"] == file_id:
            return file_info
    raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다.")


def public_state(state: dict[str, Any]) -> dict[str, Any]:
    result = json.loads(json.dumps(state))

    for file_info in result["files"]:
        file_info.pop("stored_path", None)

    for page in result["pages"]:
        page.pop("source_pdf", None)

    if result.get("latest_output"):
        result["latest_output"].pop("path", None)

    return result


def normalize_rotation(rotation: int) -> int:
    return int(rotation) % 360


def render_page_png(
    pdf_path: Path,
    page_index: int,
    target_width: int,
    rotation: int = 0,
) -> bytes:
    doc = fitz.open(pdf_path)
    try:
        page = doc.load_page(page_index)
        rect = page.rect

        rotation = normalize_rotation(rotation)
        rendered_width = (
            rect.height
            if rotation in (90, 270)
            else rect.width
        )

        zoom = target_width / max(rendered_width, 1)
        matrix = fitz.Matrix(zoom, zoom).prerotate(rotation)

        pix = page.get_pixmap(
            matrix=matrix,
            alpha=False
        )

        return pix.tobytes("png")
    finally:
        doc.close()


def render_thumbnail(
    pdf_path: Path,
    page_index: int,
    out_path: Path,
    rotation: int = 0,
) -> None:
    out_path.write_bytes(
        render_page_png(
            pdf_path,
            page_index,
            target_width=360,
            rotation=rotation,
        )
    )


@app.get("/")
def index():
    return {
        "service": "pdf-page-editor-api",
        "status": "ok",
    }


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "pdf-page-editor-api",
    }


@app.post("/api/session/new")
def new_session():
    session_id = str(uuid.uuid4())
    root = session_dir(session_id)

    (root / "uploads").mkdir(parents=True, exist_ok=True)
    (root / "thumbnails").mkdir(parents=True, exist_ok=True)
    (root / "output").mkdir(parents=True, exist_ok=True)

    state = create_empty_state(session_id)
    save_state(session_id, state)

    return public_state(state)


@app.get("/api/session/{session_id}/state")
def get_state(session_id: str):
    return public_state(load_state(session_id))


@app.post("/api/session/{session_id}/reset")
def reset_session(session_id: str):
    root = session_dir(session_id)

    if root.exists():
        shutil.rmtree(root)

    (root / "uploads").mkdir(parents=True, exist_ok=True)
    (root / "thumbnails").mkdir(parents=True, exist_ok=True)
    (root / "output").mkdir(parents=True, exist_ok=True)

    state = create_empty_state(validate_session_id(session_id))
    save_state(session_id, state)

    return public_state(state)


@app.post("/api/session/{session_id}/upload")
def upload_pdfs(
    session_id: str,
    files: list[UploadFile] = File(...),
):
    state = load_state(session_id)
    root = session_dir(session_id)

    upload_dir = root / "uploads"
    thumb_dir = root / "thumbnails"

    errors: list[str] = []

    for upload in files:
        original_name = safe_filename(upload.filename or "file.pdf")

        if Path(original_name).suffix.lower() != ".pdf":
            errors.append(f"{original_name}: PDF 파일만 지원합니다.")
            continue

        file_id = str(uuid.uuid4())
        stored_path = upload_dir / f"{file_id}.pdf"

        try:
            with stored_path.open("wb") as out:
                shutil.copyfileobj(upload.file, out)

            doc = fitz.open(stored_path)
            page_count = doc.page_count
            doc.close()

            if page_count <= 0:
                raise RuntimeError("페이지가 없는 PDF입니다.")

            state["files"].append({
                "id": file_id,
                "name": original_name,
                "page_count": page_count,
                "stored_path": str(stored_path),
            })

            for page_index in range(page_count):
                page_id = str(uuid.uuid4())
                thumbnail_path = thumb_dir / f"{page_id}.png"

                render_thumbnail(
                    stored_path,
                    page_index,
                    thumbnail_path,
                )

                state["pages"].append({
                    "id": page_id,
                    "file_id": file_id,
                    "source_name": original_name,
                    "source_pdf": str(stored_path),
                    "page_index": page_index,
                    "rotation": 0,
                })

                state["order"].append(page_id)

        except Exception as e:
            errors.append(f"{original_name}: {e}")
            stored_path.unlink(missing_ok=True)

    save_state(session_id, state)

    return {
        "state": public_state(state),
        "errors": errors,
    }


@app.get("/api/session/{session_id}/thumbnail/{page_id}")
def get_thumbnail(session_id: str, page_id: str):
    state = load_state(session_id)
    get_page(state, page_id)

    path = session_dir(session_id) / "thumbnails" / f"{page_id}.png"

    if not path.exists():
        raise HTTPException(status_code=404, detail="썸네일을 찾을 수 없습니다.")

    return FileResponse(path, media_type="image/png")


@app.get("/api/session/{session_id}/preview/{page_id}")
def preview_page(session_id: str, page_id: str):
    state = load_state(session_id)
    page_info = get_page(state, page_id)

    pdf_path = Path(page_info["source_pdf"])

    doc = fitz.open(pdf_path)
    try:
        page = doc.load_page(page_info["page_index"])
        rect = page.rect

        rotation = normalize_rotation(
            page_info.get("rotation", 0)
        )

        rendered_width = (
            rect.height
            if rotation in (90, 270)
            else rect.width
        )

        target_width = min(
            1800,
            max(1200, int(rendered_width * 2)),
        )
    finally:
        doc.close()

    png_bytes = render_page_png(
        pdf_path,
        page_info["page_index"],
        target_width=target_width,
        rotation=rotation,
    )

    return Response(
        content=png_bytes,
        media_type="image/png"
    )


@app.put("/api/session/{session_id}/order")
def update_order(session_id: str, req: OrderRequest):
    state = load_state(session_id)

    existing = state["order"]

    if len(req.order) != len(set(req.order)):
        raise HTTPException(
            status_code=400,
            detail="중복된 페이지 ID가 있습니다."
        )

    if set(req.order) != set(existing):
        raise HTTPException(
            status_code=400,
            detail="현재 페이지 목록과 순서 요청이 일치하지 않습니다."
        )

    state["order"] = req.order
    save_state(session_id, state)

    return public_state(state)


@app.post("/api/session/{session_id}/rotate")
def rotate_pages(session_id: str, req: RotateRequest):
    state = load_state(session_id)

    if req.degrees not in (-90, 90):
        raise HTTPException(
            status_code=400,
            detail="회전 각도는 왼쪽 또는 오른쪽 90도만 지원합니다."
        )

    if not req.page_ids:
        raise HTTPException(
            status_code=400,
            detail="회전할 페이지를 선택해주세요."
        )

    if len(req.page_ids) != len(set(req.page_ids)):
        raise HTTPException(
            status_code=400,
            detail="중복된 페이지 ID가 있습니다."
        )

    page_map = {
        page["id"]: page
        for page in state["pages"]
    }

    missing_page_ids = [
        page_id
        for page_id in req.page_ids
        if page_id not in page_map
    ]

    if missing_page_ids:
        raise HTTPException(
            status_code=404,
            detail="회전할 페이지 중 찾을 수 없는 페이지가 있습니다."
        )

    thumbnail_dir = session_dir(session_id) / "thumbnails"

    for page_id in req.page_ids:
        page_info = page_map[page_id]
        page_info["rotation"] = normalize_rotation(
            page_info.get("rotation", 0) + req.degrees
        )

        render_thumbnail(
            Path(page_info["source_pdf"]),
            page_info["page_index"],
            thumbnail_dir / f"{page_id}.png",
            page_info["rotation"],
        )

    state["latest_output"] = None
    save_state(session_id, state)

    return public_state(state)


@app.delete("/api/session/{session_id}/page/{page_id}")
def delete_page(session_id: str, page_id: str):
    state = load_state(session_id)
    get_page(state, page_id)

    state["pages"] = [
        page
        for page in state["pages"]
        if page["id"] != page_id
    ]

    state["order"] = [
        pid
        for pid in state["order"]
        if pid != page_id
    ]

    thumbnail_path = (
        session_dir(session_id)
        / "thumbnails"
        / f"{page_id}.png"
    )
    thumbnail_path.unlink(missing_ok=True)

    save_state(session_id, state)

    return public_state(state)


@app.delete("/api/session/{session_id}/file/{file_id}")
def delete_file(session_id: str, file_id: str):
    state = load_state(session_id)
    file_info = get_file(state, file_id)

    page_ids = {
        page["id"]
        for page in state["pages"]
        if page["file_id"] == file_id
    }

    state["pages"] = [
        page
        for page in state["pages"]
        if page["file_id"] != file_id
    ]

    state["order"] = [
        page_id
        for page_id in state["order"]
        if page_id not in page_ids
    ]

    state["files"] = [
        file_item
        for file_item in state["files"]
        if file_item["id"] != file_id
    ]

    for page_id in page_ids:
        thumb_path = (
            session_dir(session_id)
            / "thumbnails"
            / f"{page_id}.png"
        )
        thumb_path.unlink(missing_ok=True)

    try:
        Path(file_info["stored_path"]).unlink(missing_ok=True)
    except Exception:
        pass

    save_state(session_id, state)

    return public_state(state)


@app.post("/api/session/{session_id}/export")
def export_pdf(
    session_id: str,
    output_name: str = Form("통합본.pdf"),
):
    state = load_state(session_id)

    if not state["order"]:
        raise HTTPException(
            status_code=400,
            detail="내보낼 페이지가 없습니다."
        )

    output_name = safe_filename(output_name)

    if not output_name.lower().endswith(".pdf"):
        output_name += ".pdf"

    output_dir = session_dir(session_id) / "output"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_path = output_dir / output_name

    page_map = {
        page["id"]: page
        for page in state["pages"]
    }

    output_doc = fitz.open()

    try:
        for page_id in state["order"]:
            page_info = page_map.get(page_id)

            if not page_info:
                continue

            source_doc = fitz.open(page_info["source_pdf"])

            try:
                page_index = page_info["page_index"]

                output_doc.insert_pdf(
                    source_doc,
                    from_page=page_index,
                    to_page=page_index,
                )

                output_page = output_doc.load_page(
                    output_doc.page_count - 1
                )

                output_page.set_rotation(
                    normalize_rotation(
                        output_page.rotation
                        + page_info.get("rotation", 0)
                    )
                )
            finally:
                source_doc.close()

        if output_doc.page_count <= 0:
            raise HTTPException(
                status_code=400,
                detail="최종 PDF에 포함할 페이지가 없습니다."
            )

        output_doc.save(
            output_path,
            garbage=4,
            deflate=True,
            clean=True,
        )
    finally:
        output_doc.close()

    state["latest_output"] = {
        "name": output_name,
        "path": str(output_path),
    }
    save_state(session_id, state)

    return {
        "name": output_name,
        "download_url": f"/api/session/{session_id}/download",
    }


@app.get("/api/session/{session_id}/download")
def download_pdf(session_id: str):
    state = load_state(session_id)
    latest = state.get("latest_output")

    if not latest:
        raise HTTPException(
            status_code=404,
            detail="아직 생성된 PDF가 없습니다."
        )

    path = Path(latest["path"])

    if not path.exists():
        raise HTTPException(
            status_code=404,
            detail="생성된 PDF 파일을 찾을 수 없습니다."
        )

    return FileResponse(
        path,
        media_type="application/pdf",
        filename=latest["name"],
    )
