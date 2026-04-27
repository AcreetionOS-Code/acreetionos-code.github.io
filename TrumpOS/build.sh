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

# Check if packages are already available, skip if they are
check_and_install() {
    local pkg=$1
    if ! command -v "$pkg" >/dev/null 2>&1; then
        echo "  Installing $pkg..."
        sudo apt-get install -y -qq "$pkg" 2>/dev/null || {
            echo "  WARNING: Failed to install $pkg, continuing without it"
        }
    else
        echo "  ✓ $pkg already available"
    fi
}

check_and_install xorriso
check_and_install isolinux
check_and_install squashfs-tools
check_and_install unsquashfs
check_and_install wget
check_and_install git
check_and_install p7zip-full

# ── 2. Download base ISO ──
echo "[2/8] Downloading base AcreetionOS ISO..."
for url in \
  "$ISO_URL" \
  "https://gitlab.acreetionos.org/api/v4/projects/acreetionos-code%2Facreetionos/packages/generic/acreetionos/1.0/AcreetionOS-1.0-x86_64.iso" \
  "https://github.com/AcreetionOS-Code/acreetionos/releases/download/1.0/AcreetionOS-1.0-x86_64.iso" \
  "https://acreetionos.org/downloads/AcreetionOS-1.0-x86_64.iso"; do
  echo "  Trying: $url"
  if wget -q --show-progress -O "$WORK/base.iso" "$url"; then
    echo "  ✓ Downloaded successfully"
    break
  else
    echo "  ✗ Failed"
    rm -f "$WORK/base.iso"
  fi
done

if [ ! -f "$WORK/base.iso" ]; then
  echo "ERROR: All download attempts failed"
  exit 1
fi

# ── 3. Extract ISO ──
echo "[3/8] Extracting ISO..."
mkdir -p "$ISO_DIR"

# Try xorriso first, fallback to 7z
if command -v xorriso >/dev/null 2>&1; then
  echo "  Trying xorriso extraction..."
  if xorriso -osirrox on -indev "$WORK/base.iso" -extract / "$ISO_DIR" 2>/dev/null; then
    echo "  ✓ ISO extracted successfully with xorriso"
    chmod -R +w "$ISO_DIR"
  else
    echo "  ✗ xorriso extraction failed, trying 7z..."
    if command -v 7z >/dev/null 2>&1; then
      if 7z x "$WORK/base.iso" -o"$ISO_DIR" -y >/dev/null 2>&1; then
        echo "  ✓ ISO extracted successfully with 7z"
        chmod -R +w "$ISO_DIR"
      else
        echo "  ✗ 7z extraction failed too"
        exit 1
      fi
    else
      echo "  ERROR: Both xorriso and 7z extraction failed"
      exit 1
    fi
  fi
else
  echo "  ERROR: xorriso not available and no fallback extraction method ready"
  exit 1
fi

# ── 4. Extract squashfs ──
echo "[4/8] Extracting root filesystem..."
mkdir -p "$SQUASH_DIR"
if [ -f "$ISO_DIR/arch/x86_64/airootfs.sfs" ]; then
  echo "  Extracting airootfs.sfs..."
  if unsquashfs -d "$SQUASH_DIR" "$ISO_DIR/arch/x86_64/airootfs.sfs" 2>/dev/null; then
    echo "  ✓ Squashfs extracted successfully"
  else
    echo "  WARNING: Failed to extract airootfs.sfs, continuing without squashfs customization"
    # Continue with the build process even if squashfs extraction fails
  fi
else
  echo "  WARNING: airootfs.sfs not found, skipping squashfs customization"
  # Continue with the build process even if squashfs not found
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

# Only proceed if we have a working squashfs directory
if [ -d "$SQUASH_DIR/etc/calamares" ]; then
  echo "  ✓ Calamares directory found"
  
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
    echo "  WARNING: Local TrumpOS branding not found, creating basic TrumpOS branding..."
    mkdir -p "$SQUASH_DIR/etc/calamares/branding/TrumpOS"
    # Create a basic branding.desc file
    cat > "$SQUASH_DIR/etc/calamares/branding/TrumpOS/branding.desc" << 'EOF'
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

  # Replace settings.conf to use TrumpOS branding
  if [ -f "$SCRIPT_DIR/calamares/modules/settings.conf" ]; then
    echo "  Installing TrumpOS Calamares settings.conf..."
    cp "$SCRIPT_DIR/calamares/modules/settings.conf" "$SQUASH_DIR/etc/calamares/settings.conf"
  else
    echo "  WARNING: settings.conf not found, using default"
  fi

  # Update system files
  if [ -f "$SQUASH_DIR/etc/os-release" ]; then
    sed -i 's/NAME=.*/NAME="TrumpOS"/' "$SQUASH_DIR/etc/os-release"
    sed -i 's/ID=.*/ID=trumpos/' "$SQUASH_DIR/etc/os-release"
    sed -i 's/PRETTY_NAME=.*/PRETTY_NAME="TrumpOS 1.0 (Make Linux Great Again)"/' "$SQUASH_DIR/etc/os-release"
  fi
  
  if [ -f "$SQUASH_DIR/etc/lsb-release" ]; then
    sed -i 's/DISTRIB_DESCRIPTION=.*/DISTRIB_DESCRIPTION="TrumpOS 1.0"/' "$SQUASH_DIR/etc/lsb-release"
  fi

  if [ -f "$SQUASH_DIR/etc/hostname" ]; then
    echo "trumpos" > "$SQUASH_DIR/etc/hostname"
  fi

  if [ -f "$SQUASH_DIR/etc/hosts" ]; then
    sed -i 's/acreetionos/trumpos/g' "$SQUASH_DIR/etc/hosts" 2>/dev/null || true
  fi

  echo "  ✓ TrumpOS Calamares configuration injected successfully"
else
  echo "  WARNING: /etc/calamares not found in squashfs, skipping Calamares injection"
  # Continue with the build process even without Calamares customization
fi

# ── 7. Repackage squashfs ──
echo "[7/8] Repackaging filesystem..."
if [ -d "$SQUASH_DIR" ] && [ -f "$ISO_DIR/arch/x86_64/airootfs.sfs" ]; then
  echo "  Repackaging airootfs.sfs..."
  if mksquashfs "$SQUASH_DIR" "$ISO_DIR/arch/x86_64/airootfs.sfs" -comp xz -noappend >/dev/null 2>&1; then
    echo "  ✓ Squashfs repackaged successfully"
    md5sum "$ISO_DIR/arch/x86_64/airootfs.sfs" > "$ISO_DIR/arch/x86_64/airootfs.md5" 2>/dev/null || true
  else
    echo "  WARNING: Failed to repackage squashfs, using original"
  fi
else
  echo "  WARNING: Skipping squashfs repackage (missing files)"
fi

# ── 8. Build ISO ──
echo "[8/8] Building TrumpOS ISO..."
VOLUME_ID="TRUMPOS"

echo "  Building ISO with xorriso..."
BUILD_FAILED=0
if ! xorriso -as mkisofs \
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
  "$ISO_DIR" 2>/dev/null; then
  echo "  WARNING: xorriso ISO creation failed ($?)"
  BUILD_FAILED=1
fi

if [ $BUILD_FAILED -eq 0 ]; then
  echo "  ✓ ISO built successfully"
else
  echo "  ERROR: Failed to build ISO"
  exit 1
fi

echo ""
echo "=== Done ==="
ls -lh "$OUTPUT"
echo "ISO: $OUTPUT"

# Cleanup
rm -rf "$WORK"