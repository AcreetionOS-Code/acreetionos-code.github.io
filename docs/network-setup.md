# Network Setup

This guide covers connecting your AcreetionOS system to the internet and managing network devices.

## Wi-Fi

### Using NetworkManager (Recommended)

NetworkManager is the default network management tool on AcreetionOS. It handles Wi-Fi, Ethernet, and mobile broadband.

**Graphical method (Cinnamon):**

1. Click the network icon in the system tray (bottom-right corner)
2. Select your Wi-Fi network from the list
3. Enter the password and click Connect

**Command-line method (nmtui):**

```bash
nmtui
```

This opens a text-based interface. Use arrow keys to navigate:

1. Select "Activate a connection" and press Enter
2. Choose your Wi-Fi network and press Enter
3. Enter the password

**Command-line method (nmcli):**

```bash
# List available networks
nmcli dev wifi list

# Connect to a network
nmcli dev wifi connect "Network-Name" password "your-password"

# Disconnect
nmcli dev disconnect wlan0

# Show connection status
nmcli connection show
```

### Using iwd (Alternative)

iwd is a lightweight alternative to wpa_supplicant. It may be faster on some hardware.

```bash
# Check if iwd is installed
sudo pacman -S iwd

# Enable and start it
sudo systemctl enable --now iwd

# Interactive mode
iwctl
```

Inside iwd's interactive prompt:

```
[iwd]# device list
[iwd]# station wlan0 scan
[iwd]# station wlan0 get-networks
[iwd]# station wlan0 connect "Network-Name"
```

Enter the Wi-Fi password when prompted.

## Ethernet

Plug in an Ethernet cable. NetworkManager should automatically detect the connection and obtain an IP address via DHCP.

### Check Connection

```bash
# Show IP addresses
ip addr

# Test connectivity
ping -c 4 8.8.8.8

# Test DNS resolution
ping -c 4 google.com
```

### Static IP Configuration

If you need a static IP address (not typical for home users):

```bash
sudo nmcli connection modify "Connection-Name" ipv4.addresses 192.168.1.100/24
sudo nmcli connection modify "Connection-Name" ipv4.gateway 192.168.1.1
sudo nmcli connection modify "Connection-Name" ipv4.dns 8.8.8.8
sudo nmcli connection modify "Connection-Name" ipv4.method manual
sudo nmcli connection up "Connection-Name"
```

Replace `Connection-Name` with your connection name (find it with `nmcli connection show`).

## Bluetooth

### Enable Bluetooth

```bash
sudo systemctl enable --now bluetooth
```

### Using Blueman (Graphical)

Blueman is the recommended Bluetooth manager for Cinnamon:

```bash
sudo pacman -S blueman
```

After installation, find Blueman in the application menu. Use it to pair and connect devices.

### Using bluetoothctl (Command Line)

```bash
bluetoothctl
```

Inside the interactive prompt:

```
[bluetoothctl]# power on
[bluetoothctl]# agent on
[bluetoothctl]# scan on
[bluetoothctl]# devices
[bluetoothctl]# pair XX:XX:XX:XX:XX:XX
[bluetoothctl]# connect XX:XX:XX:XX:XX:XX
[bluetoothctl]# trust XX:XX:XX:XX:XX:XX
```

### Troubleshooting Bluetooth

If Bluetooth is not working:

```bash
# Check if the adapter is detected
lsusb | grep Bluetooth

# Check service status
systemctl status bluetooth

# Restart the service
sudo systemctl restart bluetooth
```

## Firewall

AcreetionOS does not enable a firewall by default. On a home network behind a router, this is usually fine. If you want extra protection, here are your options.

### UFW (Uncomplicated Firewall)

UFW is simple and great for beginners.

```bash
# Install UFW
sudo pacman -S ufw

# Set default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Enable UFW
sudo ufw enable

# Check status
sudo ufw status verbose
```

**Common UFW rules:**

```bash
# Allow SSH (if you need remote access)
sudo ufw allow ssh

# Allow a specific port
sudo ufw allow 80/tcp

# Allow a specific IP
sudo ufw allow from 192.168.1.100

# Disable UFW (if it causes issues)
sudo ufw disable
```

### Firewalld (Advanced)

Firewalld uses zones to manage rules.

```bash
# Install firewalld
sudo pacman -S firewalld

# Enable and start it
sudo systemctl enable --now firewalld

# Check status
sudo firewall-cmd --state
```

**Common firewalld commands:**

```bash
# Check which services are allowed
sudo firewall-cmd --list-services

# Allow SSH
sudo firewall-cmd --permanent --add-service=ssh

# Allow a port
sudo firewall-cmd --permanent --add-port=80/tcp

# Reload to apply changes
sudo firewall-cmd --reload
```

### Which One Should You Use?

- **UFW** - Choose this if you just want simple on/off protection
- **Firewalld** - Choose this if you need complex rules or manage multiple network zones

Do not run both at the same time. They will conflict.

## Network Troubleshooting Toolkit

### Check Your Connection

```bash
# Are you connected to a network?
ip link

# Do you have an IP address?
ip addr

# Can you reach the internet?
ping 8.8.8.8

# Can you resolve domain names?
nslookup google.com
```

### Restart NetworkManager

```bash
sudo systemctl restart NetworkManager
```

### List Available Wi-Fi Networks

```bash
nmcli dev wifi list
```

### Check Your IP Configuration

```bash
# Show routing table
ip route

# Show DNS servers
resolvectl status
```

### Reset Network Configuration

If nothing else works, reset the network:

```bash
sudo systemctl restart NetworkManager
sudo nmcli networking off
sudo nmcli networking on
```

## DNS Configuration

### Change DNS Servers

To use Cloudflare or Google DNS instead of your ISP's DNS:

```bash
# Use nmcli to set DNS
sudo nmcli connection modify "Connection-Name" ipv4.dns "1.1.1.1 8.8.8.8"
sudo nmcli connection up "Connection-Name"
```

### Test DNS Resolution

```bash
# Using the system resolver
getent hosts google.com

# Using dig
dig google.com
```