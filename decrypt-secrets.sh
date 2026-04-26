#!/bin/bash
# Decrypt secrets.env.age → .env using your SSH key (age encryption)
# X25519 + ChaCha20-Poly1305 — modern, authenticated encryption
# Only Natalie Spiva's SSH private key can decrypt
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENC_FILE="$SCRIPT_DIR/secrets/secrets.env.age"
OUT_FILE="$SCRIPT_DIR/.env"

if [ ! -f "$ENC_FILE" ]; then
    echo "ERROR: $ENC_FILE not found"
    exit 1
fi

if [ ! -f ~/.ssh/id_ed25519 ]; then
    echo "ERROR: SSH private key not found at ~/.ssh/id_ed25519"
    exit 1
fi

export PATH="$HOME/.local/bin:$PATH:/usr/local/bin"

echo "Decrypting secrets with age (X25519+ChaCha20-Poly1305)..."
age -d -i ~/.ssh/id_ed25519 -o "$OUT_FILE" "$ENC_FILE"

if [ $? -eq 0 ]; then
    chmod 600 "$OUT_FILE"
    echo "✓ Secrets decrypted to .env"
else
    echo "ERROR: Decryption failed. Wrong SSH key?"
    exit 1
fi
