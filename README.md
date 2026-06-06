# World Cup 2026 Pick'Ems

A static World Cup 2026 group and knockout bracket predictor. Rank each group,
choose the best third-place teams, complete the bracket, and export the result
as an image.

## Development

Requires Node.js 22 or later.

```bash
npm ci
npm run dev
```

Run all repository checks:

```bash
npm run check
```

## GitHub Pages

The repository includes a GitHub Actions workflow that builds the Next.js
static export and deploys the `out` directory.

1. Open **Settings > Pages** in the GitHub repository.
2. Set **Source** to **GitHub Actions**.
3. Push to `main`, or run **Deploy to GitHub Pages** manually from the Actions
   tab.

Project-site paths such as `/world-cup-26-bracket` are applied automatically
during GitHub Actions builds.

## License

[MIT](LICENSE)
