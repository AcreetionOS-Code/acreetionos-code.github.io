# AcreetionOS Documentation

Welcome to the official AcreetionOS documentation. Whether you are installing for the first time or maintaining an existing system, these guides will help you get the most out of your experience.

AcreetionOS is a user-friendly Arch Linux distribution focused on privacy, performance, and simplicity. These docs assume no prior Linux experience and explain everything in plain English.

## Table of Contents

| Guide | Description |
|-------|-------------|
| [Getting Started](getting-started.md) | Download the ISO, write it to a USB drive, install with Calamares, and complete first-boot setup |
| [System Maintenance](system-maintenance.md) | Package management with Pacman, system updates, AUR usage, cache cleanup, and kernel management |
| [Network Setup](network-setup.md) | Wi-Fi, Ethernet, Bluetooth, firewall configuration, and troubleshooting network issues |
| [Software Management](software-management.md) | Installing and removing software, Flatpak, Snap, AppImage, and package groups |
| [Troubleshooting](troubleshooting.md) | Solutions for common problems: boot failures, no Wi-Fi, audio issues, display problems, and Pacman errors |
| [Contributing](contributing.md) | How to file issues, submit pull requests, write documentation, test releases, and join the community |
| [Governance](governance.md) | Project leadership, decision-making process, repository sovereignty, and transparency policies |

## Quick Start

If you are in a hurry, here are the essential commands you will need after installation:

```bash
# Update your system
sudo pacman -Syu

# Install software
sudo pacman -S package-name

# Remove software
sudo pacman -Rs package-name

# Check system status
systemctl status
```

## Need Help?

- **Community Discord:** https://discord.acreetionos.org
- **Issue Tracker:** https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues
- **Wiki:** https://acreetionos.org/wiki.html

## About These Docs

These documents are maintained by the AcreetionOS community. If you spot an error or want to improve something, see the [Contributing Guide](contributing.md) to learn how to help.