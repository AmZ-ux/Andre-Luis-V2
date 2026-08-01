#!/bin/bash
echo "===================================="
echo " Transporte Andre Luis - Build Script"
echo "===================================="
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js not found. Install Node.js 22+."
    exit 1
fi

# Install dependencies
echo "[1/4] Installing dependencies..."
npm ci
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to install dependencies."
    exit 1
fi

# Lint
echo "[2/4] Linting code..."
npm run lint
if [ $? -ne 0 ]; then
    echo "[WARN] Lint found issues."
fi

# Build
echo "[3/4] Building..."
npm run build
if [ $? -ne 0 ]; then
    echo "[ERROR] Build failed."
    exit 1
fi

echo "[4/4] Build completed successfully!"
echo ""
echo "Output: dist/"
echo ""
echo "To preview:  npm run preview"
echo "To build Docker:  docker build -t transporte-andre-luis ."
