# Open Source Checklist

Use this before the first public push and before major public releases.

## Before First Push

- Confirm the intended license in `LICENSE`.
- Review `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, and `docs/ARCHITECTURE.md`.
- Confirm `.env`, `data/`, `.scratch/`, `node_modules/`, and build outputs are ignored.
- Run a secret scan:

```sh
rg -n --hidden -g '!node_modules/**' -g '!package-lock.json' -g '!data/**' -g '!.git/**' "(api[_-]?key|secret|token|password|BEGIN RSA|PRIVATE KEY|client_secret|DATABASE_URL)"
```

- Run the full project check:

```sh
npm run check
```

- Inspect the final file set:

```sh
git status --short --ignored
```

## Suggested First Commit

```sh
git add .
git status --short
git commit -m "Prepare OpenWrite for open source"
```

Only push after confirming no personal vault content, local cache, `.env`, or scratch notes are staged.
