#!/bin/bash
echo "===================================="
echo " Transporte Andre Luis - Deploy Script"
echo "===================================="
echo ""

# Load environment
if [ ! -f .env ]; then
    echo "[ERROR] .env file not found. Copy .env.example to .env first."
    exit 1
fi

echo "[1/4] Building Docker image..."
docker build -t transporte-andre-luis:latest .
if [ $? -ne 0 ]; then
    echo "[ERROR] Docker build failed."
    exit 1
fi

echo "[2/4] Stopping old container..."
docker-compose down 2>/dev/null

echo "[3/4] Starting new container..."
docker-compose up -d
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to start container."
    exit 1
fi

echo "[4/4] Checking health..."
sleep 5
docker ps --filter "name=transporte-andre-luis" --format "{{.Status}}"

echo ""
echo "Deploy complete!"
echo "Access: http://localhost:${VITE_PORT:-80}"
