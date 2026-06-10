# AcreetionOS Governance Model

This document describes how AcreetionOS is governed. We believe in transparency and community involvement in project decisions.

## Core Principles

- **System Sovereignty** - Users have full control over their systems. The project does not make decisions that remove user choice.
- **Transparency** - All significant decisions are made publicly and documented.
- **Meritocracy** - Influence is earned through contribution quality, not identity, status, or tenure.
- **Human-First** - The project serves people, not corporations or agendas.

## Project Leadership

### Benevolent Dictator for Life (BDFL)

AcreetionOS operates under a BDFL model. The BDFL has final authority on project decisions but delegates day-to-day operations to maintainers and the community.

**Current BDFL:** [Darren](https://github.com/darrenacretionos)

The BDFL's role includes:
- Setting the overall vision and direction for the project
- Making final decisions when consensus cannot be reached
- Appointing and removing maintainers
- Representing the project to the wider community
- Ensuring the project stays true to its core principles

### Maintainers

Maintainers are trusted community members who have write access to project repositories. They are appointed by the BDFL.

Maintainer responsibilities:
- Review and merge pull requests
- Triage and respond to issues
- Manage releases and ISO builds
- Enforce the code of conduct
- Guide new contributors

Current maintainers are listed in the [MAINTAINERS](https://github.com/AcreetionOS-Code/acreetionos-code.github.io/blob/main/MAINTAINERS) file in the repository root.

### Becoming a Maintainer

Maintainers are not elected. They are appointed based on:
- Consistent, high-quality contributions over time
- Deep understanding of the project and its values
- Good judgment and constructive communication
- Trustworthiness and reliability

If you are interested, continue contributing and the BDFL may reach out to you.

## Decision-Making Process

### Day-to-Day Decisions

Most decisions (bug fixes, small features, documentation improvements) are made through the normal pull request process:
1. A contributor submits a PR
2. Maintainers or community members review it
3. If there are no objections, it is merged
4. If there are issues, the contributor addresses feedback

### Significant Decisions

For decisions that affect the project significantly (major features, policy changes, architecture changes):

1. **Proposal** - Anyone can submit a proposal by opening a discussion or issue
2. **Community Discussion** - The proposal is discussed openly for a reasonable period (at least one week)
3. **Maintainer Review** - Maintainers evaluate the proposal based on community feedback
4. **BDFL Decision** - If maintainers cannot reach consensus, the BDFL makes the final call

### Emergency Decisions

Security vulnerabilities, critical bugs, or urgent infrastructure issues may be handled quickly by maintainers without full community discussion. After the emergency, the decision is documented and shared publicly.

## Repository Sovereignty

Each repository in the AcreetionOS organization is managed according to its own needs:

### Core Repositories

These are directly managed by the BDFL and maintainers:
- ISO build scripts
- Package configurations
- Core system settings

Changes to core repositories require maintainer approval.

### Community Repositories

These may have their own governance:
- Documentation
- Community tools
- Third-party integrations

These can accept contributions more freely but still follow the project's overall guidelines.

### Forking

AcreetionOS is free software. Anyone may fork any repository at any time for any reason under the terms of the license. We encourage forks that experiment with new ideas.

## Transparency

### What We Make Public

- All code is open source
- All issues and discussions are public
- All decision-making processes are documented
- Release notes explain what changed and why

### What We Do Not Make Public

- Private security reports until they are fixed
- Personal information of contributors

### Reporting Issues Privately

If you discover a security vulnerability, report it privately by contacting the BDFL or a maintainer through the project's Discord or email. Do not post security issues in public until they have been addressed.

## Community Roles

### Contributors

Anyone who contributes to the project in any way (code, documentation, testing, translation, helping others). No special status or permissions needed.

### Community Members

People who participate in discussions, use the OS, and provide feedback. Your voice matters regardless of whether you write code.

## Versioning and Releases

AcreetionOS uses rolling releases. There are no major version numbers. ISOs are built periodically with the latest updates. The date of the build serves as the version identifier.

The BDFL decides when to produce a new ISO. Generally, a new ISO is built when:
- Enough significant changes have accumulated
- A critical fix needs to be deployed
- Enough time has passed (typically monthly)

## Removing Maintainers

A maintainer may be removed by the BDFL for:
- Inactivity over an extended period
- Violation of the code of conduct
- Actions that harm the project
- Repeated poor judgment in technical decisions

Removal is a last resort. The BDFL will discuss concerns with the maintainer first and attempt to resolve issues amicably.

## Changing This Document

Changes to this governance document require:
1. A public proposal and discussion period (minimum two weeks)
2. Approval from the current BDFL
3. Documentation of the change and its rationale

## Questions

If you have questions about governance, open a discussion on GitHub or ask in the community Discord.