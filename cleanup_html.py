import os
import re

def cleanup_html(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Remove duplicate skip-links
    # Find the first skip-link and keep it, remove subsequent ones
    skip_link_pattern = r'<a href="#main-content" class="skip-link">Skip to main content</a>'
    
    first_idx = content.find(skip_link_pattern)
    if first_idx != -1 and content.count(skip_link_pattern) > 1:
        prefix = content[:first_idx + len(skip_link_pattern)]
        suffix = content[first_idx + len(skip_link_pattern):]
        new_content = prefix + suffix.replace(skip_link_pattern, "")
        print(f"Fixed duplicate skip-links in {file_path}")
    else:
        new_content = content

    # 2. Fix duplicate </body></html>
    # Match </body></html> followed by optional whitespace and then </body></html> again
    duplicate_end_pattern = r'(</body>\s*</html>\s*){2,}'
    if re.search(duplicate_end_pattern, new_content, re.IGNORECASE):
        new_content = re.sub(duplicate_end_pattern, '</body></html>\n', new_content, flags=re.IGNORECASE)
        print(f"Fixed duplicate body/html tags in {file_path}")

    if new_content != content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(new_content)

def main():
    for root, dirs, files in os.walk('.'):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        for file in files:
            if file.endswith('.html'):
                cleanup_html(os.path.join(root, file))

if __name__ == "__main__":
    main()
