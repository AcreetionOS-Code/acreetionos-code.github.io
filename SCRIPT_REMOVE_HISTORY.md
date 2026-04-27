Removing secrets from Git history (destructive)

Warning: The steps below rewrite git history. Only perform this if you understand the consequences.

Recommended approach using git-filter-repo (fast and safe):

1. Install git-filter-repo (https://github.com/newren/git-filter-repo)

2. Backup your repo: git clone --mirror <repo> repo-backup.git

3. Run filter to remove specific files and tokens:
   git filter-repo --invert-paths --paths .env --paths "secrets/" --replace-refs delete-no-add

4. Purge cached credentials in CI and rotate the keys immediately.

Alternative: BFG Repo-Cleaner (slower for large repos). Example:
  bfg --delete-files .env

After rewrite: force-push to the remote (only if you understand the consequences):
  git push --force --all

If you want, I can run these steps for you — confirm and I will proceed. You must be comfortable with force-pushing rewritten history.
