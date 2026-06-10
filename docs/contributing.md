# Contributing to AcreetionOS

Thank you for your interest in contributing to AcreetionOS. This project is community-driven and every contribution matters, no matter how small.

## Code of Conduct

All contributors are expected to treat each other with respect. We do not tolerate harassment, discrimination, or personal attacks. Our community values technical merit and constructive feedback over identity or status.

## Ways to Contribute

Not all contributions are code. Here are many ways to help:

### Reporting Bugs

Found a bug in AcreetionOS? Let us know.

1. **Search first** - Check the [issue tracker](https://github.com/AcreetionOS-Code/acreetionos-code.github.io/issues) to see if the bug has already been reported
2. **Open a new issue** - Click "New Issue" and choose the bug report template
3. **Include details:**
   - Your system specs (CPU, GPU, RAM, storage)
   - AcreetionOS version and kernel version (`uname -r`)
   - Exact steps to reproduce the bug
   - What you expected to happen
   - What actually happened
   - Any error messages or logs (copy and paste, do not paraphrase)
   - Screenshots if applicable

### Suggesting Features

Have an idea to make AcreetionOS better?

1. Open a feature request issue
2. Describe what you want and why
3. Explain how it would benefit users
4. Be specific about what the feature should do

Feature requests that align with AcreetionOS's values (privacy, simplicity, user-friendliness) are most likely to be considered.

### Submitting Code Changes (Pull Requests)

#### For the Website (This Repository)

The website at https://acreetionos.org is a static HTML/CSS/JS site hosted on GitHub Pages.

```bash
# Clone the repository
git clone https://github.com/AcreetionOS-Code/acreetionos-code.github.io.git
cd acreetionos-code.github.io

# Create a branch for your changes
git checkout -b my-feature

# Make your changes
# Test locally with a Python HTTP server
python3 -m http.server 8000

# Open http://localhost:8000 in your browser to preview

# Commit and push
git add .
git commit -m "Description of your changes"
git push origin my-feature
```

Then open a pull request on GitHub.

**Code style for the website:**
- Use semantic HTML5 elements
- Follow existing CSS patterns in `contact.css`
- No JavaScript frameworks - vanilla JS only
- Mobile-responsive design required
- Test in Firefox before submitting

#### For the Operating System Itself

If you want to contribute to AcreetionOS packages, configuration files, or ISO build scripts, those are managed in other repositories under the [AcreetionOS-Code organization](https://github.com/AcreetionOS-Code). Look for the relevant repository.

### Writing Documentation

Good documentation is essential. If you find something unclear or missing:

- Improve the documentation in the `docs/` directory of this repository
- Update the wiki on the website
- Write tutorials or guides

Documentation contributions follow the same pull request process as code.

### Testing

Help us find bugs before users do:

- Test pre-release ISOs and report issues
- Try AcreetionOS on different hardware
- Test after major updates
- Write and run test scripts

### Helping Other Users

Answer questions in the community Discord. Help new users. Share your tips and tricks. The community grows stronger when experienced users help newcomers.

### Translation

If you speak a language other than English, help translate the website and documentation. Create a pull request with your translations.

## Pull Request Guidelines

1. **One change per PR** - Keep pull requests focused on a single issue or feature
2. **Write good commit messages** - Explain what and why, not how
3. **Test your changes** - Make sure nothing is broken
4. **Be patient** - Maintainers review PRs in their free time
5. **Respond to feedback** - If changes are requested, address them

### Pull Request Workflow

1. Fork the repository on GitHub
2. Clone your fork: `git clone https://github.com/your-username/acreetionos-code.github.io.git`
3. Create a branch: `git checkout -b fix/issue-description`
4. Make your changes
5. Commit with a clear message: `git commit -m "Fix issue: description"`
6. Push to your fork: `git push origin fix/issue-description`
7. Open a pull request from your branch to the main repository's `main` branch

## Testing

Before submitting changes to the website, test locally:

```bash
# Install dependencies
npm install

# Run Firefox tests
bash tests/run_firefox_local.sh
```

## Community

- **Discord:** https://discord.acreetionos.org
- **GitHub:** https://github.com/AcreetionOS-Code
- **Website:** https://acreetionos.org

Join the Discord to meet other contributors, ask questions, and stay updated on project news.

## Getting Started Checklist

- [ ] Read the [Governance Model](governance.md)
- [ ] Join the community Discord
- [ ] Browse open issues and find something that interests you
- [ ] Introduce yourself in the contributors channel
- [ ] Make your first contribution

Every contributor starts somewhere. Do not be afraid to ask questions. We were all beginners once.