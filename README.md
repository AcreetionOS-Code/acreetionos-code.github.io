# AcreetionOS: The User-Friendly Arch Linux Experience

**AcreetionOS** is a modern, privacy-focused Linux distribution built on the powerful **Arch Linux** foundation. Designed for stability and ease of use, it bridges the gap between the bleeding-edge performance of Arch and the reliability required for daily driving.

![AcreetionOS Logo](https://acreetionos.org/logo.webp)

## Why AcreetionOS?

AcreetionOS is engineered for users who want the power of Arch without the hassle. We prioritize **System Sovereignty** and a "human-first" approach to open source.

- **🔰 Beginner Friendly:** A pre-configured **Cinnamon Desktop** environment that feels familiar and intuitive immediately after installation.
- **🚀 High Performance:** Optimized specifically for modern hardware with low-latency kernels and the **Pipewire** audio subsystem.
- **🛡️ Privacy & Stability:** We utilize **XLibre (X11)** for maximum compatibility and stability, avoiding the teething issues of early Wayland adoption.
- **📦 Rolling Release:** Install once, update forever. Always have the latest software without needing to reinstall your OS every six months.

## Technical Highlights

| Feature | Specification |
|---------|--------------|
| **Base** | Arch Linux (Rolling) |
| **Desktop** | Cinnamon (Customized) |
| **Display Server** | XLibre / X11 (Reliability Focus) |
| **Audio** | Pipewire |
| **Filesystem** | EXT4 (Proven Stability) |
| **Bootloader** | GRUB + Systemd-boot |

---

## Development & Contributing

This website is the central hub for the AcreetionOS community, hosted via GitHub Pages.

### Tech Stack

- **Frontend:** Pure HTML5, CSS3, JavaScript (No heavy frameworks)
- **Testing:** Playwright for Firefox-specific validation
- **Deployment:** Automated via GitHub Actions

### Local Development

To run the website locally for testing or development:

```bash
# Clone the repository
git clone https://github.com/AcreetionOS-Code/acreetionos-code.github.io.git
cd acreetionos-code.github.io

# Start a local server
python3 -m http.server 8000
# Access at http://localhost:8000
```

### Running Tests

We prioritize Firefox compatibility. To run the smoke test suite:

```bash
# Install dependencies (includes @playwright/test + wrangler for worker deploys)
npm install

# Install the Firefox browser runtime (once)
npm run install:browsers

# Run the tests
npm test
```

The suite serves the repo with `python3 -m http.server` and verifies every
public page returns 200 with a title, and that the homepage loads without
console errors. Test files live in `tests/`.

## Community

AcreetionOS is a community-driven project. We believe in transparency and the separation of identity from technical merit.

- **[Discord Community](https://discord.acreetionos.org)**
- **[Wiki Documentation](wiki.html)**
- **[Source Code](https://github.com/AcreetionOS-Code)**

## License

AcreetionOS is open-source software. See [LICENSE](LICENSE) for details.
