#!/bin/bash
# TrumpOS ISO Builder — Trump-themed AcreetionOS fork
# Downloads base AcreetionOS ISO, customizes branding, repackages
# Output: TrumpOS.iso

set -e

ISO_URL="${1:-https://iso.acreetionos.org:8448/acreetion/AcreetionOS-1.0-x86_64.iso}"
OUTPUT="TrumpOS-1.0-x86_64.iso"
WORK=$(mktemp -d)
ISO_DIR="$WORK/iso"
SQUASH_DIR="$WORK/squashfs"
CUSTOM_DIR="$WORK/custom"

echo "=== TrumpOS ISO Builder ==="
echo "Base ISO: $ISO_URL"
echo "Output:   $OUTPUT"

# ── 1. Install tools ──
echo "[1/7] Installing build tools..."
sudo apt-get update -qq
sudo apt-get install -y -qq xorriso isolinux squashfs-tools unsquashfs wget > /dev/null 2>&1

# ── 2. Download base ISO ──
echo "[2/7] Downloading base AcreetionOS ISO..."
wget -q --show-progress -O "$WORK/base.iso" "$ISO_URL"

# ── 3. Extract ISO ──
echo "[3/7] Extracting ISO..."
mkdir -p "$ISO_DIR"
xorriso -osirrox on -indev "$WORK/base.iso" -extract / "$ISO_DIR" 2>/dev/null
chmod -R +w "$ISO_DIR"

# ── 4. Extract squashfs ──
echo "[4/7] Extracting root filesystem..."
mkdir -p "$SQUASH_DIR" "$CUSTOM_DIR"
if [ -f "$ISO_DIR/arch/x86_64/airootfs.sfs" ]; then
  unsquashfs -d "$SQUASH_DIR" "$ISO_DIR/arch/x86_64/airootfs.sfs" 2>/dev/null
fi

# ── 5. Apply TrumpOS branding ──
echo "[5/7] Applying TrumpOS branding..."

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

# Desktop branding (if squashfs was extracted)
if [ -d "$SQUASH_DIR/usr/share" ]; then
  # os-release
  if [ -f "$SQUASH_DIR/etc/os-release" ]; then
    sed -i 's/NAME=.*/NAME="TrumpOS"/' "$SQUASH_DIR/etc/os-release"
    sed -i 's/ID=.*/ID=trumpos/' "$SQUASH_DIR/etc/os-release"
    sed -i 's/PRETTY_NAME=.*/PRETTY_NAME="TrumpOS 1.0 (Make Linux Great Again)"/' "$SQUASH_DIR/etc/os-release"
  fi
  # lsb-release
  if [ -f "$SQUASH_DIR/etc/lsb-release" ]; then
    sed -i 's/DISTRIB_DESCRIPTION=.*/DISTRIB_DESCRIPTION="TrumpOS 1.0"/' "$SQUASH_DIR/etc/lsb-release"
  fi
fi

# ── 6. Repackage squashfs ──
echo "[6/7] Repackaging filesystem..."
if [ -d "$SQUASH_DIR" ] && [ -f "$ISO_DIR/arch/x86_64/airootfs.sfs" ]; then
  mksquashfs "$SQUASH_DIR" "$ISO_DIR/arch/x86_64/airootfs.sfs" -comp xz -noappend > /dev/null 2>&1 || echo "  (squashfs repack skipped — no write perms)"

  # Update checksums
  md5sum "$ISO_DIR/arch/x86_64/airootfs.sfs" > "$ISO_DIR/arch/x86_64/airootfs.md5" 2>/dev/null || true
fi

# ── 7. Build ISO ──
echo "[7/7] Building TrumpOS ISO..."
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
