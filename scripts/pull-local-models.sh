#!/bin/bash
# Pull Local Models Script
# This script downloads and configures local embedding and STT models
#
# Usage:
#   chmod +x scripts/pull-local-models.sh
#   ./scripts/pull-local-models.sh
#
# Or run commands directly:
#   docker exec open_notebook-open_notebook-1 ollama pull nomic-embed-text
#   docker exec open_notebook-open_notebook-1 ollama pull mxbai-embed-large

set -e

echo "=========================================="
echo "Pulling Local Models for Open Notebook"
echo "=========================================="

# Check if Ollama container is running
if ! docker ps | grep -q "ollama"; then
    echo "Starting Ollama container..."
    # Note: You need to add Ollama to your docker-compose.yml first
    docker run -d --name open_notebook-ollama \
        --network open_notebook_default \
        -p 11434:11434 \
        -v ollama_models:/root/.ollama \
        ollama/ollama:latest
fi

# Check if Speaches container is running
if ! docker ps | grep -q "speaches"; then
    echo "Starting Speaches container..."
    docker run -d --name open_notebook-speaches \
        --network open_notebook_default \
        -p 8969:8000 \
        -v hf_hub_cache:/home/ubuntu/.cache/huggingface/hub \
        ghcr.io/speaches-ai/speaches:latest-cpu
fi

echo ""
echo "Pulling Ollama Embedding Models..."
echo "-----------------------------------"

# Pull Ollama embedding models
docker exec open_notebook-ollama ollama pull nomic-embed-text
docker exec open_notebook-ollama ollama pull mxbai-embed-large

echo ""
echo "Pulling Speaches STT Model (faster-whisper-small)..."
echo "------------------------------------------------------"
docker exec open_notebook-speaches uv tool run speaches-cli model download Systran/faster-whisper-small

echo ""
echo "=========================================="
echo "Model Download Complete!"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Go to Settings → API Keys"
echo "2. Add Ollama credential:"
echo "   - Provider: Ollama"
echo "   - Base URL: http://host.docker.internal:11434 (macOS/Windows)"
echo "   - or: http://ollama:11434 (Linux with docker-compose)"
echo "3. Discover and register models"
echo "4. Add OpenAI-Compatible credential for Speaches STT:"
echo "   - Base URL for STT: http://host.docker.internal:8969/v1"
echo ""
