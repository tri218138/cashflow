# Richman Cashflow

Static React + TypeScript app for forecasting cashflow from recurring events.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Deploy to GitHub Pages

This project is configured for GitHub Pages using GitHub Actions.

1. Push the repository to GitHub.
2. Make sure the default branch is `main`.
3. In GitHub, open `Settings > Pages`.
4. Set `Source` to `GitHub Actions`.
5. Push to `main` or run the `Deploy to GitHub Pages` workflow manually.

The workflow file is located at `.github/workflows/deploy-pages.yml`.

## Notes

- `vite.config.ts` uses `base: './'` so the built site can run correctly under GitHub Pages subpaths.
- The deploy artifact is generated from the `dist` folder.
