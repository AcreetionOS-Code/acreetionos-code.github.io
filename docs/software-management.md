# Software Management

Learn how to install, update, and remove software on AcreetionOS.

## How Software Works on Linux

On Linux, most software is installed through a package manager. The package manager downloads software from repositories (centralized servers), handles dependencies (other software the program needs to run), and makes removal clean.

AcreetionOS supports several package formats. This guide covers all of them.

## Pacman (Native Packages)

Pacman is the built-in package manager for Arch Linux and AcreetionOS.

### Install Software

```bash
sudo pacman -S package-name
```

You can install multiple packages at once:

```bash
sudo pacman -S firefox vlc libreoffice-fresh
```

### Search for Software

```bash
# Search by name or description
pacman -Ss video player

# Search installed packages
pacman -Qs firefox
```

### Remove Software

```bash
# Remove a package and its dependencies (if nothing else needs them)
sudo pacman -Rs package-name

# Remove a package, its dependencies, and config files
sudo pacman -Rns package-name
```

### Find What a Package Does

```bash
pacman -Si firefox
```

This shows the description, version, size, and dependencies of a package.

### List All Installed Packages

```bash
pacman -Q
```

To count them:

```bash
pacman -Q | wc -l
```

### Find Orphaned Packages

Orphans are packages that were installed as dependencies but are no longer needed by anything:

```bash
pacman -Qtdq
```

Remove them all at once:

```bash
sudo pacman -Rns $(pacman -Qtdq)
```

## Flatpak

Flatpak is a universal package format that runs in a sandbox. It works on any Linux distribution.

### Install Flatpak

```bash
sudo pacman -S flatpak
```

### Add Flathub (the main Flatpak repository)

```bash
flatpak remote-add --if-not-exists flathub https://flathub.org/repo/flathub.flatpakrepo
```

### Install a Flatpak App

```bash
flatpak install flathub org.mozilla.firefox
```

### Run a Flatpak App

```bash
flatpak run org.mozilla.firefox
```

Or launch it from your application menu like any other program.

### List Installed Flatpaks

```bash
flatpak list
```

### Update Flatpaks

```bash
flatpak update
```

### Remove a Flatpak

```bash
flatpak uninstall org.mozilla.firefox
```

### Clean Up Unused Flatpak Runtimes

```bash
flatpak uninstall --unused
```

### When to Use Flatpak

- The software is not in the official repositories
- You want the latest version
- You want sandboxed applications for extra security
- You need a version that works identically across distributions

## Snap

Snap is another universal package format developed by Canonical (the company behind Ubuntu).

### Install Snap

```bash
sudo pacman -S snapd
sudo systemctl enable --now snapd.socket
```

Create a symbolic link for classic snap support:

```bash
sudo ln -s /var/lib/snapd/snap /snap
```

### Install a Snap App

```bash
sudo snap install firefox
```

### List Installed Snaps

```bash
snap list
```

### Update Snaps

```bash
sudo snap refresh
```

### Remove a Snap

```bash
sudo snap remove firefox
```

### Should You Use Snap on AcreetionOS?

Snap works but is not native to Arch. Flatpak is generally preferred in the Arch ecosystem because it integrates better and does not require Canonical's infrastructure. Use Snap only if the software you need is not available any other way.

## AppImage

AppImage is a portable application format. Each AppImage is a single file that contains the application and everything it needs to run. No installation required.

### Using an AppImage

1. Download the `.AppImage` file from the software's website
2. Make it executable:

```bash
chmod +x SomeApp.AppImage
```

3. Run it:

```bash
./SomeApp.AppImage
```

### Optional: Integrate with Your Application Menu

You can use a tool like AppImageLauncher to manage AppImages:

```bash
# Install from AUR
yay -S appimagelauncher
```

### Pros and Cons of AppImage

**Pros:**
- No installation needed
- Portable (carry on a USB drive)
- Works on any Linux distribution
- Each version can coexist

**Cons:**
- Larger file size
- No automatic updates (you manage them manually)
- Not integrated into the system by default

## Package Groups

Some software comes in groups - collections of related packages installed together.

### Installing a Package Group

```bash
# Install all packages in a group
sudo pacman -S gnome

# See what packages are in a group
pacman -Sg gnome
```

### Common Package Groups

| Group | What It Contains |
|-------|-----------------|
| `base-devel` | Build tools (compilers, make, etc.) |
| `gnome` | The GNOME desktop environment |
| `kde-applications` | KDE applications collection |
| `plasma` | The KDE Plasma desktop |
| `xfce4` | The XFCE desktop environment |
| `xorg` | X11 display server packages |
| `linux-firmware` | Firmware for hardware devices |

### Installing Individual Packages from a Group

You are not forced to install an entire group. If you only want one application from it:

```bash
pacman -Sg gnome | less
# Find the package name you want, then install it individually
sudo pacman -S gnome-calculator
```

## Which Package Format Should I Use?

Here is a simple decision tree:

1. **Is it in the official repositories?** Use `sudo pacman -S package-name`
2. **Not in repos, but in the AUR?** Use `yay -S package-name` (see [System Maintenance](system-maintenance.md) for AUR setup)
3. **Not in repos or AUR?** Check Flathub: `flatpak install flathub app-id`
4. **Still not available?** Try Snap or download an AppImage from the software's website

## Managing Software Repositories

### Official Repositories

AcreetionOS uses the standard Arch Linux repositories:

- **core** - Essential system packages
- **extra** - Additional software
- **community** - Community-maintained packages
- **multilib** - 32-bit compatibility libraries (for running 32-bit apps on 64-bit systems)

### Enable Multilib

If you want to run 32-bit applications (like many Steam games):

```bash
sudo nano /etc/pacman.conf
```

Uncomment these lines (remove the `#`):

```
[multilib]
Include = /etc/pacman.d/mirrorlist
```

Then update:

```bash
sudo pacman -Sy
```

## Keeping Software Up to Date

Different package formats need different update commands:

```bash
# Pacman (official packages)
sudo pacman -Syu

# AUR packages (if using yay)
yay -Syu

# Flatpak
flatpak update

# Snap
sudo snap refresh

# AppImage
# No automatic updates - download new versions manually
```

You can put all of these in a script or alias to update everything at once:

```bash
alias update-all="sudo pacman -Syu && yay -Syu && flatpak update && sudo snap refresh"
```