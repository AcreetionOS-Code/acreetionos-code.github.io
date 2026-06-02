import glob, re, os

sidebar_css = '<link rel="stylesheet" href="sidebar.css">'
sidebar_js = '<script src="sidebar.js" defer></script>'

# Standard nav links for the sidebar data source (ordered by importance)
nav_links = (
    '<a href="index.html">Home</a>'
    '<a href="flash.html">Downloads</a>'
    '<a href="wiki.html">Wiki</a>'
    '<a href="contact.html">Contact</a>'
    '<a href="newsletter.html">Newsletter</a>'
    '<a href="https://security.archlinux.org">Security</a>'
    '<a href="developers.html">Developers</a>'
    '<a href="hosting.html">ISO Hosting</a>'
    '<a href="build.html">ISO Builder</a>'
    '<a href="git-tracker.html">Git Tracker</a>'
    '<a href="/acreetionos-news-tracker/">News Tracker</a>'
    '<a href="https://github.com/acreetionos-code/">GitHub</a>'
    '<a href="https://gitlab.acreetionos.org">GitLab</a>'
    '<a href="unofficial.html">Unofficial</a>'
)

skip_files = {'sidebars.html', 'sidebar.css', 'sidebar.js'}

for fp in sorted(glob.glob('*.html')):
    if fp in skip_files:
        continue
    if fp == 'index.html':
        continue  # already done

    with open(fp) as f:
        c = f.read()

    # Skip if already has sidebar
    if 'sidebar.js' in c or 'id="page-wrap"' in c:
        print(f"SKIP (has sidebar): {fp}")
        continue

    orig = c

    # 1. Add sidebar.css link in head (before </head>)
    if 'sidebar.css' not in c:
        c = c.replace('</head>', sidebar_css + '\n' + '</head>')

    # 2. Add sidebar.js before </body>
    if 'sidebar.js' not in c:
        c = c.replace('</body>', sidebar_js + '\n' + '</body>')

    # 3. Wrap body content in #page-wrap
    # Find the body opening and wrap everything between <body...> and the last </body>
    body_match = re.search(r'<body[^>]*>', c)
    if body_match:
        body_start = body_match.end()
        # Find the first element after body (skip whitespace)
        content_start = body_start
        while content_start < len(c) and c[content_start] in ' \n\r\t':
            content_start += 1
        # Insert <div id="page-wrap"> right after <body...>
        # But skip any existing skip-link or background-grid
        insert_pos = body_start
        # Check if there's a skip link right after body
        skip_match = re.search(r'<a[^>]*class="skip-link"[^>]*>.*?</a>', c[body_start:])
        if skip_match:
            insert_pos = body_start + skip_match.end()
        # Close page-wrap before </body>
        c = c[:insert_pos] + '<div id="page-wrap">' + c[insert_pos:]
        c = c.replace('</body>', '</div>\n</body>')

    # 4. Update nav links to use the standard set
    # Find the nav element and replace its contents
    nav_match = re.search(r'<nav[^>]*class="main-nav"[^>]*>', c)
    if nav_match:
        nav_start = nav_match.end()
        nav_end = c.find('</nav>', nav_start)
        if nav_end > nav_start:
            # Replace nav contents with our standard links
            c = c[:nav_start] + nav_links + c[nav_end:]

    if c != orig:
        with open(fp, 'w') as f:
            f.write(c)
        print(f"UPDATED: {fp}")
    else:
        print(f"NO CHANGE: {fp}")
