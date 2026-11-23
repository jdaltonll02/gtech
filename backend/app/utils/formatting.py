from decimal import Decimal


def format_currency(amount: Decimal | float, currency: str = "USD") -> str:
    """Format a decimal amount as a currency string.

    Example:
        format_currency(1234.5) -> "$1,234.50"
    """
    symbols = {"USD": "$", "EUR": "€", "GBP": "£"}
    symbol = symbols.get(currency.upper(), currency + " ")
    return f"{symbol}{float(amount):,.2f}"


def format_file_size(size_bytes: int) -> str:
    """Human-readable file size.

    Example:
        format_file_size(1536) -> "1.5 KB"
    """
    for unit in ("B", "KB", "MB", "GB"):
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}" if unit != "B" else f"{size_bytes} B"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


def format_duration(seconds: int) -> str:
    """Format seconds into a human-readable duration string.

    Example:
        format_duration(3661) -> "1h 1m 1s"
        format_duration(90)   -> "1m 30s"
    """
    if seconds < 0:
        seconds = 0
    h = seconds // 3600
    m = (seconds % 3600) // 60
    s = seconds % 60
    parts = []
    if h:
        parts.append(f"{h}h")
    if m:
        parts.append(f"{m}m")
    if s or not parts:
        parts.append(f"{s}s")
    return " ".join(parts)


def truncate(text: str, max_length: int = 120, suffix: str = "…") -> str:
    """Truncate text to max_length, appending suffix if truncated."""
    if len(text) <= max_length:
        return text
    return text[: max_length - len(suffix)].rstrip() + suffix
