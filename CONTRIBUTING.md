# Contributing

Thanks for helping improve OpenWrite. This project is still early, so small pull requests with clear behavior are easiest to review.

## Local Setup

```sh
npm install
npm run dev
```

The app runs at `http://127.0.0.1:5173`. Backend health is available at `http://127.0.0.1:8787/api/health`.

## Before Opening a Pull Request

Run the full check:

```sh
npm run check
```

For focused work, these are also useful:

```sh
npm run typecheck
npm run test
npm run build
```

## Development Notes

- Keep vault content and local app state out of commits. `data/`, `.env`, and `.scratch/` are ignored for this reason.
- Prefer small, behavior-preserving refactors unless the change needs a broader design pass.
- Add tests when changing sync behavior, vault filesystem behavior, Markdown conversion, editor commands, or page-tree interactions.
- Keep durable content inspectable as Markdown files and attachment files in the selected vault.

## Pull Request Shape

Include:

- What changed.
- How you verified it.
- Any migration or local-data implications.
