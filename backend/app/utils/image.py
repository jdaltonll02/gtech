import io
from typing import Optional
from fastapi import HTTPException, UploadFile, status
from PIL import Image

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10 MB


def validate_image(file: UploadFile, max_bytes: int = MAX_FILE_SIZE_BYTES) -> None:
    """Raise HTTP 422 if the upload is not an allowed image type."""
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unsupported image type '{file.content_type}'. Allowed: {', '.join(ALLOWED_CONTENT_TYPES)}",
        )


async def read_and_validate(file: UploadFile, max_bytes: int = MAX_FILE_SIZE_BYTES) -> bytes:
    """Read file bytes and enforce size limit."""
    validate_image(file)
    data = await file.read()
    if len(data) > max_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File too large. Maximum size is {max_bytes // (1024 * 1024)} MB.",
        )
    return data


def resize_image(
    data: bytes,
    max_width: int = 1920,
    max_height: int = 1080,
    quality: int = 85,
    output_format: str = "WEBP",
) -> bytes:
    """Resize an image to fit within max dimensions, preserving aspect ratio.

    Returns the processed image as bytes in the specified format.
    """
    img = Image.open(io.BytesIO(data))

    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    img.thumbnail((max_width, max_height), Image.LANCZOS)

    buf = io.BytesIO()
    save_format = output_format.upper()
    if save_format == "WEBP":
        img.save(buf, format="WEBP", quality=quality, method=6)
    elif save_format == "JPEG":
        if img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(buf, format="JPEG", quality=quality, optimize=True)
    else:
        img.save(buf, format=save_format)

    return buf.getvalue()


def make_thumbnail(data: bytes, size: int = 256) -> bytes:
    """Create a square thumbnail from image bytes."""
    img = Image.open(io.BytesIO(data))
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    # Crop to square from center
    w, h = img.size
    min_dim = min(w, h)
    left = (w - min_dim) // 2
    top = (h - min_dim) // 2
    img = img.crop((left, top, left + min_dim, top + min_dim))
    img = img.resize((size, size), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format="WEBP", quality=80)
    return buf.getvalue()
