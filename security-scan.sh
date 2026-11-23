#!/usr/bin/env bash
# Scan Python dependencies for known CVEs using pip-audit.
# Run this before every release and after upgrading dependencies.
# Exit code 0 = clean, non-zero = vulnerabilities found.

set -euo pipefail

echo "========================================"
echo " G-Tech Dependency Vulnerability Scan"
echo "========================================"
echo ""

# Install pip-audit if not present
docker compose exec api sh -c "pip show pip-audit > /dev/null 2>&1 || pip install pip-audit -q"

echo "Scanning installed packages..."
docker compose exec api pip-audit --format=columns

echo ""
echo "Scan complete."
