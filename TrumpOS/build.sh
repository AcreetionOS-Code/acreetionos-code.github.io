#!/bin/bash
# TrumpOS ISO Builder — Trump-themed AcreetionOS fork
# Downloads base AcreetionOS ISO, customizes branding, injects TrumpOS Calamares, repackages
# Output: TrumpOS-1.0-x86_64.iso

set -e

ISO_URL="${1:-https://iso.acreetionos.org:8448/acreetion/AcreetionOS-1.0-x86_64.iso}"
OUTPUT="TrumpOS-1.0-x86_64.iso"
WORK=$(mktemp -d)
ISO_DIR="$WORK/iso"
SQUASH_DIR="$WORK/squashfs"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== TrumpOS ISO Builder ==="
echo "Base ISO: $ISO_URL"
echo "Output:   $OUTPUT"
echo "Work dir: $WORK"

# ── 1. Install tools ──
echo "[1/8] Installing build tools..."
sudo apt-get update -qq
sudo apt-get install -y -qq xorriso isolinux squashfs-tools unsquashfs wget git > /dev/null 2>&1

# ── 2. Download base ISO ──
echo "[2/8] Downloading base AcreetionOS ISO..."
wget -q --show-progress -O "$WORK/base.iso" "$ISO_URL"

# ── 3. Extract ISO ──
echo "[3/8] Extracting ISO..."
mkdir -p "$ISO_DIR"
xorriso -osirrox on -indev "$WORK/base.iso" -extract / "$ISO_DIR" 2>/dev/null
chmod -R +w "$ISO_DIR"

# ── 4. Extract squashfs ──
echo "[4/8] Extracting root filesystem..."
mkdir -p "$SQUASH_DIR"
if [ -f "$ISO_DIR/arch/x86_64/airootfs.sfs" ]; then
  unsquashfs -d "$SQUASH_DIR" "$ISO_DIR/arch/x86_64/airootfs.sfs" 2>/dev/null
else
  echo "  WARNING: airootfs.sfs not found, skipping squashfs customization"
fi

# ── 5. Apply TrumpOS branding (boot configs) ──
echo "[5/8] Applying TrumpOS boot branding..."

# GRUB menu entry
GRUB_CFG="$ISO_DIR/boot/grub/kernels.cfg"
if [ -f "$GRUB_CFG" ]; then
  sed -i 's/AcreetionOS/TrumpOS/g' "$GRUB_CFG"
  sed -i 's/Arch Linux/TrumpOS — Make Linux Great Again/g' "$GRUB_CFG"
fi

# EFI boot entry
if [ -f "$ISO_DIR/loader/entries/archiso-x86_64.conf" ]; then
  sed -i 's/Arch Linux/TrumpOS/g' "$ISO_DIR/loader/entries/archiso-x86_64.conf"
  echo "  title TrumpOS — The Best Linux, Believe Me" >> "$ISO_DIR/loader/entries/archiso-x86_64.conf"
fi

# Bootloader config
SYSLINUX="$ISO_DIR/syslinux/archiso_sys.cfg"
ISOLINUX="$ISO_DIR/isolinux/isolinux.cfg"
for cfg in "$SYSLINUX" "$ISOLINUX"; do
  if [ -f "$cfg" ]; then
    sed -i 's/Arch Linux/TrumpOS/g' "$cfg"
    sed -i 's/archisolabel=ARCH_.*$/archisolabel=TRUMPOS/g' "$cfg" 2>/dev/null || true
  fi
done

# ── 6. Inject TrumpOS Calamares config ──
echo "[6/8] Injecting TrumpOS Calamares configuration..."

if [ -d "$SQUASH_DIR/etc/calamares" ]; then
  # Remove AcreetionOS branding
  if [ -d "$SQUASH_DIR/etc/calamares/branding/AcreetionOS" ]; then
    echo "  Removing AcreetionOS branding..."
    rm -rf "$SQUASH_DIR/etc/calamares/branding/AcreetionOS"
  fi

  # Copy TrumpOS branding from local calamares directory
  if [ -d "$SCRIPT_DIR/calamares/branding/TrumpOS" ]; then
    echo "  Installing TrumpOS branding..."
    mkdir -p "$SQUASH_DIR/etc/calamares/branding/TrumpOS"
    cp -r "$SCRIPT_DIR/calamares/branding/TrumpOS/"* "$SQUASH_DIR/etc/calamares/branding/TrumpOS/"
  else
    echo "  WARNING: Local TrumpOS branding not found at $SCRIPT_DIR/calamares/branding/TrumpOS"
    echo "  Attempting to clone from GitLab..."
    CALAMARES_REPO="$WORK/calamares-config"
    git clone https://gitlab.acreetionos.org/acreetionos-code/trumpos-calamares.git "$CALAMARES_REPO" 2>/dev/null || \
    git clone https://gitlab.acreetionos.org/natalie/calamares-config.git "$CALAMARES_REPO" 2>/dev/null || true
    if [ -d "$CALAMARES_REPO/etc/calamares/branding/AcreetionOS" ]; then
      echo "  Cloning AcreetionOS Calamares as base for TrumpOS..."
      mkdir -p "$SQUASH_DIR/etc/calamares/branding/TrumpOS"
      cp -r "$CALAMARES_REPO/etc/calamares/branding/AcreetionOS/"* "$SQUASH_DIR/etc/calamares/branding/TrumpOS/"
      # Rename branding.desc references
      sed -i 's/componentName:.*/componentName:  TrumpOS/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/productName:.*/productName:         TrumpOS/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/shortProductName:.*/shortProductName:    TrumpOS/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/versionedName:.*/versionedName:       TrumpOS 1.0/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/shortVersionedName:.*/shortVersionedName:  TrumpOS 1.0/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/bootloaderEntryName:.*/bootloaderEntryName: TrumpOS/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/SidebarBackground:.*/SidebarBackground:    "#002147"/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/SidebarText:.*/SidebarText:          "#D4AF37"/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i 's/SidebarBackgroundCurrent:.*/SidebarBackgroundCurrent: "#D4AF37"/' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
      sed -i '/SidebarBackgroundCurrent/a\   SidebarTextCurrent:   "#002147"' "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc"
    fi
  fi

  # Replace settings.conf to use TrumpOS branding
  if [ -f "$SCRIPT_DIR/calamares/modules/settings.conf" ]; then
    echo "  Installing TrumpOS Calamares settings.conf..."
    cp "$SCRIPT_DIR/calamares/modules/settings.conf" "$SQUASH_DIR/etc/calamares/settings.conf"
  fi

  # Update os-release
  if [ -f "$SQUASH_DIR/etc/os-release" ]; then
    sed -i 's/NAME=.*/NAME="TrumpOS"/' "$SQUASH_DIR/etc/os-release"
    sed -i 's/ID=.*/ID=trumpos/' "$SQUASH_DIR/etc/os-release"
    sed -i 's/PRETTY_NAME=.*/PRETTY_NAME="TrumpOS 1.0 (Make Linux Great Again)"/' "$SQUASH_DIR/etc/os-release"
  fi
  # Update lsb-release
  if [ -f "$SQUASH_DIR/etc/lsb-release" ]; then
    sed -i 's/DISTRIB_DESCRIPTION=.*/DISTRIB_DESCRIPTION="TrumpOS 1.0"/' "$SQUASH_DIR/etc/lsb-release"
  fi

  # Update hostname
  if [ -f "$SQUASH_DIR/etc/hostname" ]; then
    echo "trumpos" > "$SQUASH_DIR/etc/hostname"
  fi

  # Update hosts file
  if [ -f "$SQUASH_DIR/etc/hosts" ]; then
    sed -i 's/acreetionos/trumpos/g' "$SQUASH_DIR/etc/hosts" 2>/dev/null || true
  fi

  echo "  TrumpOS Calamares configuration injected successfully."
else
  echo "  WARNING: /etc/calamares not found in squashfs, skipping Calamares injection"
fi

# ── 7. Repackage squashfs ──
echo "[7/8] Repackaging filesystem..."
if [ -d "$SQUASH_DIR" ] && [ -f "$ISO_DIR/arch/x86_64/airootfs.sfs" ]; then
  mksquashfs "$SQUASH_DIR" "$ISO_DIR/arch/x86_64/airootfs.sfs" -comp xz -noappend > /dev/null 2>&1 || echo "  (squashfs repack skipped — no write perms)"
  md5sum "$ISO_DIR/arch/x86_64/airootfs.sfs" > "$ISO_DIR/arch/x86_64/airootfs.md5" 2>/dev/null || true
fi

# ── 8. Build ISO ──
echo "[8/8] Building TrumpOS ISO..."
VOLUME_ID="TRUMPOS"

xorriso -as mkisofs \
  -iso-level 3 \
  -full-iso9660-filenames \
  -volid "$VOLUME_ID" \
  -appid "TrumpOS — Make Linux Great Again" \
  -publisher "TrumpOS Project" \
  -preparer "Based on AcreetionOS" \
  -eltorito-boot isolinux/isolinux.bin \
  -eltorito-catalog isolinux/boot.cat \
  -no-emul-boot -boot-load-size 4 -boot-info-table \
  -isohybrid-mbr "$ISO_DIR/isolinux/isohdpfx.bin" \
  -eltorito-alt-boot -e "EFI/archiso/efiboot.img" \
  -no-emul-boot -isohybrid-gpt-basdat \
  -output "$OUTPUT" \
  "$ISO_DIR" 2>/dev/null

echo ""
echo "=== Done ==="
ls -lh "$OUTPUT"
echo "ISO: $OUTPUT"

# Cleanup
rm -rf "$WORK"