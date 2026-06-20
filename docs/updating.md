# Updating AcreetionOS

AcreetionOS is a rolling-release distribution — install once, update forever.

## Basic Update

```bash
sudo pacman -Syu
```

This refreshes the package database and upgrades all installed packages.

## Update All Package Formats

```bash
# Pacman (official packages)
sudo pacman -Syu

# AUR packages (if using yay)
yay -Syu

# Flatpak
flatpak update
```

## After Updating

- If the kernel was updated, reboot your system
- Check the [Arch Linux news](https://archlinux.org/news/) for any manual intervention required
- If something breaks, check our [Discord](https://discord.gg/VHqQkJASw7) for announcements

## More Details

See [System Maintenance](system-maintenance.md) for a complete guide on keeping your system healthy.
