# Troubleshooting

This guide covers common problems you may encounter with AcreetionOS and how to fix them.

## General Approach

Before trying specific fixes, try these general steps:

1. **Reboot** - Restarting fixes many transient issues
2. **Check for updates** - `sudo pacman -Syu` may resolve known bugs
3. **Search the issue tracker** - https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues
4. **Ask the community** - https://discord.acreetionos.org

## Boot Problems

### System Does Not Boot After Installation

**Symptoms:** Blank screen, error messages, or kernel panic after selecting AcreetionOS in GRUB.

**Possible fixes:**

Try booting from the GRUB menu with a different kernel or boot parameter:

1. At the GRUB menu, press `e` to edit the boot entry
2. Find the line starting with `linux`
3. Add one of these parameters at the end of that line:
   - `nomodeset` - Bypasses GPU mode setting (common fix for display issues)
   - `acpi=off` - Disables ACPI (fixes some hardware compatibility issues)
   - `acpi_osi=!` - Alternative ACPI fix for newer laptops
4. Press `F10` or `Ctrl+X` to boot with these changes
5. If the system boots, make the change permanent by editing `/etc/default/grub`:

```bash
sudo nano /etc/default/grub
```

Add the parameter to `GRUB_CMDLINE_LINUX_DEFAULT`:

```
GRUB_CMDLINE_LINUX_DEFAULT="quiet nomodeset"
```

Then regenerate GRUB configuration:

```bash
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

### GRUB Rescue Prompt

**Symptom:** You see `grub rescue>` instead of a normal boot menu.

```bash
grub rescue> ls
```

Find the partition with your boot files (try each one):

```bash
grub rescue> ls (hd0,msdos1)/
grub rescue> set root=(hd0,msdos1)
grub rescue> set prefix=(hd0,msdos1)/boot/grub
grub rescue> insmod normal
grub rescue> normal
```

Once booted, reinstall GRUB:

```bash
sudo grub-install /dev/sda
sudo grub-mkconfig -o /boot/grub/grub.cfg
```

### System Boots to Black Screen

**Symptom:** GRUB loads but screen goes black after selecting AcreetionOS.

**Possible fixes:**

1. At GRUB, press `e` and try `nomodeset` as described above
2. If you have NVIDIA graphics, try:

```
nomodeset nvidia_drm.modeset=1
```

3. If the above does not work, try:

```
radeon.modeset=0
```

(for AMD GPUs)

After booting, install the appropriate graphics driver:

```bash
# NVIDIA
sudo pacman -S nvidia nvidia-utils

# AMD
sudo pacman -S mesa
```

## Wi-Fi Not Working

### No Wi-Fi Adapter Detected

**Symptom:** The network applet shows "No Wi-Fi Adapter" or `iwconfig` shows no wireless interfaces.

**Check if the hardware is recognized:**

```bash
lspci | grep Network
lsusb | grep Wireless
```

**Check if the driver is loaded:**

```bash
lspci -k | grep -A 3 Network
```

If no driver is listed, you may need firmware:

```bash
sudo pacman -S linux-firmware
```

### Wi-Fi Adapter Detected But No Networks Found

**Check if the interface is blocked:**

```bash
rfkill list
```

If it shows "Soft blocked: yes":

```bash
rfkill unblock wifi
```

**Restart NetworkManager:**

```bash
sudo systemctl restart NetworkManager
```

### Wi-Fi Keeps Disconnecting

**Check power management:**

```bash
sudo systemctl disable wpa_supplicant
```

Or check if NetworkManager power saving is enabled:

```bash
sudo nano /etc/NetworkManager/conf.d/wifi-powersave.conf
```

Add:

```
[connection]
wifi.powersave=2
```

(2 = disable, 1 = enable)

Then restart NetworkManager:

```bash
sudo systemctl restart NetworkManager
```

## Audio Not Working

### No Sound Output

**Check audio devices:**

```bash
pactl list sinks short
```

**Check volume levels:**

```bash
alsamixer
```

Press `F6` to select the correct sound card. Make sure channels are not muted (MM means muted - press `m` to unmute).

**Restart Pipewire:**

```bash
systemctl --user restart pipewire
systemctl --user restart wireplumber
```

**Set the correct output device:**

```bash
# List playback devices
pactl list sinks short

# Set the default sink
pactl set-default-sink <sink-name>
```

### Audio Crackling or Popping

**Adjust buffer size:**

```bash
sudo nano /etc/pipewire/pipewire.conf
```

Find `default.clock.quantum` and change it to:

```
default.clock.quantum = 256
```

Then restart Pipewire:

```bash
systemctl --user restart pipewire
```

### HDMI Audio Not Working

Ensure the correct GPU driver is installed:

```bash
# NVIDIA
sudo pacman -S nvidia

# AMD/Intel
sudo pacman -S mesa
```

List available sinks and switch to the HDMI output:

```bash
pactl list sinks short
pactl set-default-sink <hdmi-sink-name>
```

## Display Issues

### Screen Resolution Wrong

**Check available resolutions:**

```bash
xrandr
```

**Set the correct resolution manually:**

```bash
xrandr --output HDMI-1 --mode 1920x1080
```

Replace `HDMI-1` with your display name (shown by `xrandr`).

### External Monitor Not Detected

**Force detection:**

```bash
xrandr --auto
```

**If still not detected:**

```bash
sudo pacman -S xf86-video-intel
```

Or for NVIDIA:

```bash
sudo pacman -S nvidia nvidia-settings
nvidia-settings
```

### Screen Tearing

**Create a configuration file for your GPU:**

For Intel:

```bash
sudo nano /etc/X11/xorg.conf.d/20-intel.conf
```

```
Section "Device"
    Identifier  "Intel Graphics"
    Driver      "intel"
    Option      "TearFree" "true"
EndSection
```

For AMD:

```bash
sudo nano /etc/X11/xorg.conf.d/20-amd.conf
```

```
Section "Device"
    Identifier  "AMD"
    Driver      "amdgpu"
    Option      "TearFree" "true"
EndSection
```

Reboot after creating the file.

## Pacman Errors

### "Failed to commit transaction (conflicting files)"

Some file is conflicting with a package you are installing.

```bash
sudo pacman -Syu --overwrite /path/to/conflicting/file
```

Or to overwrite all conflicts (use with caution):

```bash
sudo pacman -Syu --overwrite '*'
```

### "Could not lock database"

Another instance of Pacman is running, or it crashed and left the lock file.

```bash
sudo rm /var/lib/pacman/db.lck
```

Then try your command again.

### "Signature is unknown trust"

The package signing key is not trusted. Refresh the keyring:

```bash
sudo pacman -S archlinux-keyring
sudo pacman-key --populate archlinux
sudo pacman-key --refresh-keys
sudo pacman -Syu
```

### "Failed to synchronize all databases (unable to lock database)"

Same as the lock file issue above. Run:

```bash
sudo rm /var/lib/pacman/db.lck
```

### "invalid or corrupted package (PGP signature)"

A package download was corrupted. Clear the cache and retry:

```bash
sudo pacman -Scc
sudo pacman -Syu
```

### Package Download is Slow

**Change mirror list:**

```bash
sudo nano /etc/pacman.d/mirrorlist
```

Move faster mirrors (usually ones geographically close to you) to the top of the list.

Or use `reflector` to automatically find fast mirrors:

```bash
sudo pacman -S reflector
sudo reflector --latest 10 --protocol https --sort rate --save /etc/pacman.d/mirrorlist
sudo pacman -Syu
```

## System is Slow

### Check System Resources

```bash
# CPU and memory usage
top

# Disk usage
df -h

# What's using swap?
swapon --show
```

### Disable Swap (if you have enough RAM)

```bash
sudo swapoff -a
```

### Check for Background Processes

```bash
# Show processes using the most CPU
ps aux --sort=-%cpu | head -10

# Show processes using the most memory
ps aux --sort=-%mem | head -10
```

### Clear Memory Cache

```bash
sudo sync && echo 3 | sudo tee /proc/sys/vm/drop_caches
```

## Application Won't Launch

### Run from Terminal

Launch the application from a terminal to see error messages:

```bash
application-name
```

The error output will tell you what is wrong (missing library, permission issue, etc.).

### Check Permissions

```bash
# If the application is installed manually, check it is executable
ls -l /path/to/application
chmod +x /path/to/application
```

### Reinstall the Application

```bash
sudo pacman -Rs application-name
sudo pacman -S application-name
```

## Keyboard or Mouse Not Working

**Check if USB devices are detected:**

```bash
lsusb
```

**If you just installed and input devices don't work in X11:**

```bash
sudo pacman -S xf86-input-libinput
```

Reboot after installing.

## Getting Help

If none of these solutions work:

1. **Search the Arch Wiki** - https://wiki.archlinux.org - It is comprehensive and applies to AcreetionOS
2. **Join the Discord** - https://discord.acreetionos.org - Describe your issue with as much detail as possible
3. **File an issue** - https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues

When asking for help, always include:

- Your system specs (CPU, GPU, RAM)
- The exact error message (copy and paste, do not paraphrase)
- What you have already tried
- Output of `sudo pacman -Q | head -20` (your installed packages)