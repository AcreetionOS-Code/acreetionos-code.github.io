# Getting Started with AcreetionOS

This guide walks you through installing AcreetionOS from start to finish. You do not need any prior Linux experience.

## What You Will Need

- A computer with at least 4 GB of RAM and 40 GB of storage
- A USB drive (8 GB or larger)
- Another computer to download the ISO and create the installer
- A stable internet connection

## Step 1: Download the ISO

Visit https://acreetionos.org and click the download button. You will receive a file named something like `acreetionos-YYYY.MM.DD-x86_64.iso`.

The download may take a while depending on your internet speed. The ISO is typically around 2-3 GB.

## Step 2: Verify the Download

Before writing the ISO to your USB drive, verify that the file was not corrupted during download. This step protects you against incomplete downloads and tampering.

### On Linux

```bash
# Download the checksum file (look for SHA256 or SHA512 sums on the website)
sha256sum acreetionos-*.iso
```

Compare the output with the checksum listed on the download page. If they match, proceed.

### On Windows

Open PowerShell and run:

```powershell
Get-FileHash acreetionos-*.iso -Algorithm SHA256
```

### On macOS

```bash
shasum -a 256 acreetionos-*.iso
```

If the checksums do not match, delete the ISO and download it again.

## Step 3: Write the ISO to a USB Drive

This will erase everything on the USB drive. Back up any important files first.

### Using balenaEtcher (Recommended for Beginners)

1. Download and install balenaEtcher from https://etcher.balena.io
2. Open balenaEtcher
3. Click "Flash from file" and select the ISO
4. Click "Select target" and choose your USB drive
5. Click "Flash" and wait for it to finish

### Using the Command Line (Linux)

```bash
# Find your USB device
lsblk

# Replace /dev/sdX with your USB device (not a partition like /dev/sdX1)
sudo dd if=acreetionos-*.iso of=/dev/sdX bs=4M status=progress && sync
```

### Using Rufus (Windows)

1. Download and open Rufus from https://rufus.ie
2. Select your USB drive under "Device"
3. Click "SELECT" and choose the ISO
4. Leave all other settings at their defaults
5. Click "START"

## Step 4: Boot from the USB Drive

1. Restart your computer with the USB drive plugged in
2. Enter the boot menu. The key to press depends on your computer:
   - **F12** - Dell, Lenovo, HP
   - **F9** - HP
   - **F2** - Many laptops
   - **Esc** - Some ASUS and Acer models
   - **Del** - Desktop motherboards
3. Select your USB drive from the list
4. You should see the AcreetionOS boot menu
5. Select "Boot AcreetionOS" and press Enter

The system will take a minute or two to load. Once it finishes, you will see the AcreetionOS desktop running live from the USB drive. Nothing has been installed yet.

## Step 5: Run the Calamares Installer

1. On the live desktop, double-click the "Install AcreetionOS" icon
2. The Calamares installer will open

### Welcome Screen

Select your language and click "Next."

### Location

Select your time zone and keyboard layout. If you are unsure, the defaults are usually fine.

### Partitions (Important)

You have two options:

**Erase disk (Recommended for beginners):** Calamares will automatically partition the entire disk. This erases everything on the drive.

**Manual partitioning (Advanced users):** You can create custom partitions. At minimum you need:
- A root partition (`/`) - at least 20 GB, ext4 filesystem
- A swap partition - optional, equal to your RAM size or 4 GB if unsure

Select the option that works for you and click "Next."

### User Account

Create your user account:

- **Your name:** Your full name (e.g., "Jane Doe")
- **Username:** Your login name (e.g., "jane")
- **Computer name:** A name for your computer on the network (e.g., "jane-pc")
- **Password:** Choose a strong password
- **Root password (optional):** Leave blank unless you know you need it

Check "Log in automatically" if you do not want to enter a password at boot. This is less secure but more convenient.

### Summary

Review your choices. If everything looks correct, click "Install."

### Installation

Calamares will copy files to your disk. This takes 5-15 minutes. Go make a cup of tea.

### Finish

Once installation completes, click "Restart." Remove the USB drive when prompted. The system will reboot into your new AcreetionOS installation.

## Step 6: First Boot Setup

### Login

If you did not enable automatic login, enter the username and password you created during installation.

### Welcome Screen

The first time you boot, a welcome application may appear. It can help you:

- Connect to Wi-Fi
- Set up your printer
- Install additional software
- Configure system settings

You can close it and do these things later.

### Update Your System

The first thing you should do is update your system:

```bash
sudo pacman -Syu
```

Enter your password when prompted. This command refreshes the package database and upgrades all installed packages. The first update may download a lot of data.

### Install Additional Drivers

If you have NVIDIA graphics hardware, you may need proprietary drivers:

```bash
sudo pacman -S nvidia nvidia-utils
```

### Reboot

After updating, reboot to make sure everything is clean:

```bash
sudo reboot
```

## What's Next?

Now that AcreetionOS is installed, here are some common next steps:

- [Connect to Wi-Fi or Ethernet](network-setup.md)
- [Install your favorite software](software-management.md)
- [Learn how to maintain your system](system-maintenance.md)
- [Explore the Cinnamon desktop settings]

## Uninstalling AcreetionOS

If you decide AcreetionOS is not for you, you can install another operating system over it. Just boot from that OS's installer and choose to erase the disk during partitioning.