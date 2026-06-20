# Security

## Arch Linux Security Advisories

AcreetionOS follows [Arch Linux security advisories](https://security.archlinux.org) for all security updates. We do not maintain a separate security advisory system at this time.

Arch Linux does not provide a public API for security notifications, so we recommend:

- Subscribing to the [Arch Linux security mailing list](https://lists.archlinux.org/mailman3/lists/arch-security.lists.archlinux.org/)
- Watching the [Arch Linux security feed](https://security.archlinux.org)
- Joining our [Discord](https://discord.gg/VHqQkJASw7) for project-specific announcements

## Reporting a Security Issue

If you discover a security vulnerability in AcreetionOS-specific code (not upstream Arch Linux packages):

1. **Do not** open a public GitHub issue
2. Contact us via Discord or open a GitHub issue with "SECURITY" in the title
3. We aim to respond within 72 hours

## Our Approach

As a small team, we don't have dedicated security infrastructure. Our security model relies on:

- Arch Linux's rapid security response (typically hours, not days)
- Minimal package selection to reduce attack surface
- No telemetry, no tracking, no data collection
- Transparent build process (all code on GitHub/GitLab)

## Supply Chain

All ISO builds are performed via GitHub Actions from source. Build artifacts are uploaded directly to our mirrors. We do not use third-party build services.

## Security.txt

For automated security contact information, see `/.well-known/security.txt`.
