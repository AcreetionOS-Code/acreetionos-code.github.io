# System Maintenance

AcreetionOS is a rolling-release distribution, which means you install once and update forever. Regular maintenance keeps your system healthy and secure.

## Pacman Basics

Pacman is the package manager that handles installing, updating, and removing software on AcreetionOS.

### Common Pacman Commands

| Action | Command | What It Does |
|--------|---------|--------------|
| Update all packages | `sudo pacman -Syu` | Refreshes database and upgrades everything |
| Install a package | `sudo pacman -S package-name` | Downloads and installs a package |
| Remove a package | `sudo pacman -Rs package-name` | Removes a package and its dependencies |
| Search for a package | `pacman -Ss search-term` | Searches package names and descriptions |
| List installed packages | `pacman -Q` | Shows every package on your system |
| Show package info | `pacman -Qi package-name` | Details about an installed package |
| Show files in a package | `pacman -Ql package-name` | Lists all files the package installed |
| Find which package owns a file | `pacman -Qo /path/to/file` | Tells you what package a file belongs to |

### Understanding the Flags

- `-S` - Synchronize (install/update)
- `-R` - Remove
- `-Q` - Query
- `-y` - Refresh package database
- `-u` - Upgrade all packages
- `-s` - Search (works with -S or -Q)
- `-i` - Information (works with -Q)

## System Updates

### When to Update

Check for updates whenever you feel like it. A reasonable cadence is once a week. You can also wait up to a month, but do not go longer than that for security reasons.

### How to Update

```bash
sudo pacman -Syu
```

Enter your password when prompted. Pacman will show you what will be upgraded and ask for confirmation. Press `Y` and Enter to proceed.

### What If Something Breaks?

Rolling releases are cutting-edge. Occasionally an update may cause issues. If that happens:

1. Check the [AcreetionOS Discord](https://discord.acreetionos.org) for announcements
2. Search the issue tracker for known problems
3. Check the [Troubleshooting Guide](troubleshooting.md)

Partial upgrades (updating only one package without the rest of the system) are strongly discouraged and often cause breakage. Always use `-Syu`.

## Arch User Repository (AUR)

The AUR is a community-driven repository of packages not in the official repositories. It contains thousands of additional programs.

### Installing an AUR Helper

While you can build AUR packages manually, an AUR helper makes it much easier. Popular choices include `yay` and `paru`.

**Installing yay:**

```bash
sudo pacman -S --needed base-devel git
git clone https://aur.archlinux.org/yay.git
cd yay
makepkg -si
```

Once installed, use yay just like pacman:

```bash
# Search the AUR
yay search-term

# Install from AUR
yay -S package-name

# Update everything (including AUR packages)
yay -Syu
```

### AUR Safety Tips

- Check PKGBUILD files before building. Look at what the package does
- Stick to popular packages with many votes and positive comments
- Avoid packages that seem suspicious or have very few votes

## Cleaning the Package Cache

Pacman stores downloaded package files in `/var/cache/pacman/pkg/`. Over time, this can use many gigabytes of space.

### Check Cache Size

```bash
du -sh /var/cache/pacman/pkg/
```

### Remove Old Package Versions

```bash
sudo pacman -Sc
```

This removes cached packages that are no longer in the repositories. It keeps the latest version of each package you have installed.

### Remove Everything from Cache

```bash
sudo pacman -Scc
```

This empties the entire cache. Only do this if you are very low on disk space, since it means packages will need to be re-downloaded if reinstalled.

### Using paccache (Recommended)

The `paccache` tool gives you more control:

```bash
# Install it
sudo pacman -S pacman-contrib

# Keep only the last 3 versions of each package
sudo paccache -rk 3

# Keep only the last 2 versions of uninstalled packages
sudo paccache -ruk 2
```

## Kernel Updates

AcreetionOS uses the Linux kernel. When a kernel update arrives, Pacman handles it automatically. You will need to reboot after a kernel update for the new kernel to take effect.

### Check Your Kernel Version

```bash
uname -r
```

### Install Alternative Kernels

AcreetionOS ships with a stock kernel, but you can install others:

```bash
# Linux LTS (long-term support) - more stable, fewer features
sudo pacman -S linux-lts

# Linux-zen - optimized for desktop responsiveness
sudo pacman -S linux-zen
```

If you install multiple kernels, GRUB will show them all in the boot menu. You can choose which one to boot.

### Remove Old Kernels

After installing a new kernel, you can remove old ones:

```bash
sudo pacman -Rs linux
sudo pacman -Rs linux-lts  # if removing LTS
```

Be careful not to remove all kernels. Keep at least one working kernel installed.

## Systemd Services

Systemd manages background services on your system.

### Common systemctl Commands

| Command | What It Does |
|---------|--------------|
| `systemctl status service-name` | Check if a service is running |
| `sudo systemctl start service-name` | Start a service |
| `sudo systemctl stop service-name` | Stop a service |
| `sudo systemctl enable service-name` | Start service at boot |
| `sudo systemctl disable service-name` | Don't start service at boot |
| `sudo systemctl restart service-name` | Restart a service |
| `systemctl list-units --type=service` | List all services |

### Example: Enabling Bluetooth

```bash
sudo systemctl enable bluetooth
sudo systemctl start bluetooth
```

## Disk Space Management

### Find Large Files and Directories

```bash
# Show disk usage of all directories in /
sudo du -h --max-depth=1 /

# Find files larger than 500 MB
sudo find / -type f -size +500M
```

### Clean Journal Logs

Systemd journals can grow large over time:

```bash
# Check journal size
journalctl --disk-usage

# Keep only the last 500 MB of logs
sudo journalctl --vacuum-size=500M

# Keep only the last 2 weeks
sudo journalctl --vacuum-time=2weeks
```

## Maintenance Checklist

Do these things regularly to keep your system healthy:

**Weekly:**
- Run `sudo pacman -Syu` to update

**Monthly:**
- Run `paccache -rk 3` to clean old package cache
- Run `journalctl --vacuum-size=500M` to trim logs
- Check disk space with `df -h`

**Every few months:**
- Remove orphaned packages: `sudo pacman -Rns $(pacman -Qtdq)`
- Check for failed services: `systemctl --failed`
- Review installed packages: `pacman -Q | less`