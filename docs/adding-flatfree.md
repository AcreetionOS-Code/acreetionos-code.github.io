# Adding the FlatFree Repository

FlatFree is a community Flatpak repository — free, open, and built for everyone. It's an alternative to Flathub that accepts AI-assisted submissions and doesn't police how code is written.

## Adding FlatFree

```bash
flatpak remote-add --if-not-exists flatfree https://flatfree.acreetionos.org/flatfree.flatpakrepo
```

## Installing from FlatFree

```bash
flatpak install flatfree org.acreetionos.MediaWriter
```

## Available Applications

Browse available apps at https://flatfree.acreetionos.org

## Why FlatFree?

FlatFree was created because Flathub bans applications "generated predominantly by AI." FlatFree rejects this gatekeeping - any tool used by a human is human work.

## CLI Tool

You can also use the `flatfree-submit` CLI to submit your own Flatpak manifests:

```bash
curl -L https://github.com/spivanatalie64/FlatFree/releases/download/v1.0.0/flatfree-submit -o flatfree-submit
chmod +x flatfree-submit
./flatfree-submit --help
```

## More Information

- GitHub: https://github.com/spivanatalie64/FlatFree
- Website: https://flatfree.acreetionos.org
