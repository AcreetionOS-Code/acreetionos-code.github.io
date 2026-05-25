#!/bin/bash
set -e

ISO_URL="${1:-https://iso.acreetionos.org:8448/acreetion/AcreetionOS-1.0-x86_64.iso}"
ISO_NAME="TrumpOS-1.0-x86_64.iso"
WORK=$(mktemp -d)
ISO_DIR="$WORK/iso"
SCRIPT_DIR="$(dirname "$0")"
BRAND_DIR="$SCRIPT_DIR/branding/TrumpOS"

echo "=== TrumpOS Build ==="
echo "Base URL: $ISO_URL"
echo "Working dir: $WORK"

# Install required tools (run inside Arch container)
if command -v pacman >/dev/null 2>&1; then
  pacman -Sy --noconfirm xorriso squashfs-tools git wget 2>/dev/null || true
fi

# 1. Download base ISO
echo "[1/5] Downloading base ISO..."
BASE_ISO="$WORK/base.iso"
wget -q --show-progress -O "$BASE_ISO" "$ISO_URL" || curl -sL -o "$BASE_ISO" "$ISO_URL"
if [ ! -f "$BASE_ISO" ] || [ ! -s "$BASE_ISO" ]; then
  echo "ERROR: Failed to download base ISO"
  exit 1
fi

# 2. Extract ISO tree
echo "[2/5] Extracting ISO tree..."
mkdir -p "$ISO_DIR"
if xorriso -osirrox on -indev "$BASE_ISO" -extract / "$ISO_DIR" 2>/dev/null; then
  echo "  Extracted with xorriso"
elif command -v 7z >/dev/null 2>&1; then
  7z x -aoa -o"$ISO_DIR" "$BASE_ISO" || { echo "ERROR: 7z failed"; exit 1; }
else
  echo "ERROR: Cannot extract ISO"
  exit 1
fi
chmod -R +w "$ISO_DIR" 2>/dev/null || true

# 3. Apply TrumpOS branding
echo "[3/5] Applying TrumpOS branding..."
for f in "$ISO_DIR/isolinux/isolinux.cfg" "$ISO_DIR/EFI/BOOT/grub.cfg" "$ISO_DIR/boot/grub/grub.cfg"; do
  [ -f "$f" ] && sed -i 's/AcreetionOS/TrumpOS/g' "$f" && sed -i 's/Arch Linux/TrumpOS/g' "$f" 2>/dev/null || true
done
if [ -f "$ISO_DIR/loader/entries/archiso-x86_64.conf" ]; then
  sed -i 's/Arch Linux/TrumpOS/g' "$ISO_DIR/loader/entries/archiso-x86_64.conf"
  echo "  title TrumpOS — Make Linux Great Again" >> "$ISO_DIR/loader/entries/archiso-x86_64.conf"
fi
# Calamares branding
if [ -d "$BRAND_DIR" ]; then
  mkdir -p "$ISO_DIR/etc/calamares/branding/TrumpOS"
  cp -r "$BRAND_DIR/"* "$ISO_DIR/etc/calamares/branding/TrumpOS/" 2>/dev/null || true
fi
# os-release
if [ -f "$ISO_DIR/etc/os-release" ]; then
  sed -i 's/NAME=.*/NAME="TrumpOS"/' "$ISO_DIR/etc/os-release"
  sed -i 's/ID=.*/ID=trumpos/' "$ISO_DIR/etc/os-release"
  sed -i 's/PRETTY_NAME=.*/PRETTY_NAME="TrumpOS 1.0 (MLGA)"/' "$ISO_DIR/etc/os-release"
fi
[ -f "$ISO_DIR/etc/hostname" ] && echo "trumpos" > "$ISO_DIR/etc/hostname"
echo "  ✓ TrumpOS branding applied"

# 4. Build final ISO
echo "[4/5] Building final ISO..."
if command -v mkarchiso >/dev/null 2>&1; then
  mkarchiso -w "$WORK/work" -o "$WORK/out" "$ISO_DIR" 2>&1 || {
    echo "mkarchiso failed — building via xorriso directly"
    xorriso -as mkisofs -iso-level 3 -full-iso9660-filenames \
      -volid "TRUMPOS" -o "$ISO_NAME" "$ISO_DIR"
  }
else
  xorriso -as mkisofs -iso-level 3 -full-iso9660-filenames \
    -volid "TRUMPOS" -o "$ISO_NAME" "$ISO_DIR"
fi

# 5. Verify
echo "[5/5] Finished building $ISO_NAME"
ls -lh "$ISO_NAME" 2>/dev/null || echo "ISO not found at expected path"
rm -rf "$WORK"
echo "=== DONE ==="
