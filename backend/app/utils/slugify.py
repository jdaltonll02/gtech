import re
import unicodedata


def slugify(value: str, max_length: int = 255) -> str:
    """Convert a string to a URL-safe slug.

    Example:
        slugify("Hello World! 123") -> "hello-world-123"
    """
    value = unicodedata.normalize("NFKD", value)
    value = value.encode("ascii", "ignore").decode("ascii")
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value[:max_length].strip("-")


def unique_slug(base: str, existing_slugs: set[str], max_length: int = 255) -> str:
    """Generate a slug that doesn't collide with existing ones by appending a counter."""
    slug = slugify(base, max_length)
    if slug not in existing_slugs:
        return slug
    counter = 2
    while True:
        candidate = f"{slug[:max_length - len(str(counter)) - 1]}-{counter}"
        if candidate not in existing_slugs:
            return candidate
        counter += 1
