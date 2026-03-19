# AcreetionOS Website Documentation

Welcome to the technical documentation for the AcreetionOS website.

## Quick Links

- [Architecture](architecture.md) - How the website is built
- [Deployment](deployment.md) - How updates go live

## For Contributors

### Making Changes

1. **Clone the repository**
   ```bash
   git clone https://github.com/AcreetionOS-Code/acreetionos-code.github.io.git
   cd acreetionos-code.github.io
   ```

2. **Create a branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Edit HTML files directly
   - Update `contact.css` for styling
   - Test locally with `python3 -m http.server 8000`

4. **Submit a pull request**
   - Push your branch: `git push origin feature/your-feature-name`
   - Open PR on GitHub
   - Request review from maintainers

### Code Style

- Use semantic HTML5 elements
- Follow existing CSS patterns (see `contact.css`)
- No frameworks - vanilla HTML/CSS/JS only
- Mobile-responsive design required

### Testing

```bash
# Install dependencies
npm install

# Run Firefox tests
bash tests/run_firefox_local.sh
```

### Browser Support

- **Primary:** Firefox (latest)
- **Secondary:** Chrome, Edge, Safari
- Graceful degradation for older browsers

## Resources

- [GitHub Repository](https://github.com/AcreetionOS-Code/acreetionos-code.github.io)
- [Issue Tracker](https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues)
- [Discord Community](https://discord.acreetionos.org)
