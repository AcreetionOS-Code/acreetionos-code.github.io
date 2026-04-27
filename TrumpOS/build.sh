#!/bin/bash
set -e

# -------------------------------------------------
# TrumpOS Build Script – applies branding BEFORE ISO creation
# Mirrors AcreetionOS build flow but injects TrumpOS branding
# -------------------------------------------------

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
if ! command -v pacman >/dev/null 2>&1; then
  echo "Running in Arch container – installing tools..."
  sudo pacman -Sy --noconfirm xorriso squashfs-tools sbsigntool mkisofs-git git
else
  echo "Tools already available"
fi

# -------------------------------------------------
# 1. Download base ISO
# -------------------------------------------------
echo "[1/5] Downloading base ISO..."
BASE_ISO="$WORK/base.iso"
wget -q --show-progress -O "$BASE_ISO" "$ISO_URL"
if [ ! -f "$BASE_ISO" ]; then
  echo "ERROR: Failed to download base ISO"
  exit 1
fi

# -------------------------------------------------
# 2. Prepare working ISO tree (using xorriso)
# -------------------------------------------------
echo "[2/5] Extracting ISO tree..."
mkdir -p "$ISO_DIR"
# Try xorriso extraction first
if xorriso -osirrox on -indev "$BASE_ISO" -extract / "$ISO_DIR" 2>/dev/null; then
  echo "  Extracted with xorriso"
else
  echo "  xorriso failed – trying 7z fallback"
  if command -v 7z >/dev/null 2>&1; then
    7z x -aoa -o"$ISO_DIR" "$BASE_ISO" || { echo "ERROR: 7z extraction failed"; exit 1; }
  else
    echo "ERROR: Neither xorriso nor 7z available"
    exit 1
  fi
fi
chmod -R +w "$ISO_DIR" || { echo "ERROR: Cannot make ISO tree writable"; exit 1; }

# -------------------------------------------------
# 3. Apply TrumpOS branding to the extracted tree
# -------------------------------------------------
echo "[3/5] Applying TrumpOS branding..."
# 1) Bootloader (isolinux/syslinux)
if [ -f "$ISO_DIR/isolinux/isolinux.cfg" ]; then
  sed -i 's/AcreetionOS/TrumpOS/g' "$ISO_DIR/isolinux/isolinux.cfg"
  sed -i 's/Arch Linux/TrumpOS — Make Linux Great Again/g' "$ISO_DIR/isolinux/isolinux.cfg"
fi
if [ -f "$ISO_DIR/loader/entries/archiso-x86_64.conf" ]; then
  sed -i 's/Arch Linux/TrumpOS/g' "$ISO_DIR/loader/entries/archiso-x86_64.conf"
  echo "  title TrumpOS — The Best Linux, Believe Me" >> "$ISO_DIR/loader/entries/archiso-x86_64.conf"
fi
# 2) Chroot environment configs
if [ -d "$ISO_DIR/etc/calamares/branding/AcreetionOS" ]; then
  echo "  Removing AcreetionOS branding..."
  rm -rf "$ISO_DIR/etc/calamares/branding/AcreetionOS"
fi
if [ -d "$BRAND_DIR" ]; then
  echo "  Installing TrumpOS branding..."
  mkdir -p "$ISO_DIR/etc/calamares/branding/TrumpOS"
  cp -r "$BRAND_DIR/"* "$ISO_DIR/etc/calamares/branding/TrumpOS/"
else
  echo "  WARNING: No local TrumpOS branding found – creating minimal branding"
  mkdir -p "$ISO_DIR/etc/calamares/branding/TrumpOS"
  cat > "$ISO_DIR/etc/calamares/branding/TrumpOS/branding.desc" <<'EOF'
componentName:     TrumpOS
productName:        TrumpOS
shortProductName:   TrumpOS
versionedName:      TrumpOS 1.0
shortVersionedName: TrumpOS 1.0
bootloaderEntryName: TrumpOS
SidebarBackground:   "#002147"
SidebarText:         "#D4AF37"
SidebarBackgroundCurrent: "#D4AF37"
SidebarTextCurrent:  "#002147"
EOF
fi
# settings.conf (optional)
if [ -f "$SCRIPT_DIR/settings.conf" ]; then
  cp "$SCRIPT_DIR/settings.conf" "$ISO_DIR/etc/calamares/settings.conf"
fi
# os‑release / hostname / hosts
if [ -f "$ISO_DIR/etc/os-release" ]; then
  sed -i 's/NAME=.*/NAME="TrumpOS"/' "$ISO_DIR/etc/os-release"
  sed -i 's/ID=.*/ID=trumpos/' "$ISO_DIR/etc/os-release"
  sed -i 's/PRETTY_NAME=.*/PRETTY_NAME="TrumpOS 1.0 (Make Linux Great Again)"/' "$ISO_DIR/etc/os-release"
fi
if [ -f "$ISO_DIR/etc/hostname" ]; then
  echo "trumpos" > "$ISO_DIR/etc/hostname"
fi
if [ -f "$ISO_DIR/etc/hosts" ]; then
  sed -i 's/acreetionos/trumpos/g' "$ISO_DIR/etc/hosts" 2>/dev/null || true
fi

echo "  ✓ TrumpOS branding applied"

# -------------------------------------------------
# 4. Build the final ISO with mkarchiso (mirroring AcreetionOS)
# -------------------------------------------------
echo "[4/5] Building final ISO with mkarchiso..."
# Create the mkarchiso config file on‑the‑fly
CONFIG_DIR="$WORK/archiso-config"
mkdir -p "$CONFIG_DIR"
cat > "$WORK/mkarchiso.conf" <<'EOF'
# ----------------------------------------------
# mkarchiso configuration – identical to the one used by AcreetionOS
# ----------------------------------------------
installkernel="arg:"

isodate="combat-hang:yes"

pacman_opts="--noconfirm --overwrite --noprompt"

# Packages to install after the base system
packages="
    linux
    linux-firmware
    vim
    sudo
    networkmanager
    dhcpcd
    xfce4
    xfce4-goodies
    lightdm
    gdm
    sddm
    xorg-server
    xorg-apps
    mesa
    firefox
    thunderbird
    git
    wget
    curl
"

# Extra repositories (if any)
# extra_repos=()

# Compression options
compress_options="-comp xz -noappend"

# Volume ID and labels
volume_id="TRUMPOS"
image_name="TrumpOS-${isodate}"
EOF

# Launch mkarchiso (need to run inside Arch container)
echo "  Running mkarchiso to generate final ISO..."
if ! mkarchiso -c "$WORK/mkarchiso.conf" -w "$WORK" -D "$ISO_DIR" -o "$ISO_NAME"; then
  echo "ERROR: mkarchiso failed"
  exit 1
fi

# -------------------------------------------------
# 5. Verify and finish
# -------------------------------------------------
echo "[5/5] Finished building $ISO_NAME"
ls -lh "$ISO_NAME"

# Clean up
rm -rf "$WORK"
echo "=== DONE ==="