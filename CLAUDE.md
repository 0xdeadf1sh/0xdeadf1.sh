# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Personal blog at `https://0xdeadf1.sh/`, built with Hugo (extended) and the
[`tomfran/typo`](https://github.com/tomfran/typo) theme (vendored as a git
submodule at `themes/typo`). Deployed to GitHub Pages by
`.github/workflows/hugo.yaml` on every push to `main`.

## Commands

```bash
# Live-reload dev server (includes drafts)
hugo server -D

# Production build (matches CI: --gc --minify)
hugo --gc --minify

# Scaffold a new post from archetypes/default.md
hugo new content posts/<slug>.md

# First-time clone — the theme is a submodule, so:
git submodule update --init --recursive
```

CI pins `HUGO_VERSION=0.154.4` (extended) and `DART_SASS_VERSION=1.97.2`. The
extended build is required (Sass pipeline). The built site lands in `public/`,
which is `.gitignore`'d — the GitHub Actions workflow does a fresh build on
every push and uploads that as the Pages artefact, so the local `public/` is
only useful for previewing the production build.

## Architecture

Standard Hugo layout, with a few notes worth knowing before editing:

- **Theme overrides live in the repo root**, not in `themes/typo/`. Hugo
  resolves `layouts/`, `assets/`, and `static/` from the project root first,
  then falls back to the theme. So:
  - `layouts/_default/{home,single}.html` and `layouts/partials/{header,footer}.html`
    shadow the theme equivalents — edit these to change page structure.
  - `assets/css/custom.css` is the project-specific stylesheet (background
    gif, lime borders, code color). Loaded by the theme's CSS pipeline.
  - `assets/css/colors/eink.css` overrides the theme's `eink` palette
    (selected via `colorPalette = 'eink'` in `hugo.toml`).
- **Site config lives entirely in `hugo.toml`**, including the long
  `homeIntroContent` block that *is* the homepage body. Editing the homepage
  copy means editing that TOML string, not a content file.
- **Posts** are flat under `content/posts/*.md` with TOML front matter
  (`+++` delimiters). Per-post images go in `content/posts/img/` and are
  referenced as `./img/foo.png` or `/img/foo.png#center` (the `#center` suffix
  triggers a CSS rule in `custom.css`).
- **Drafts**: most in-progress posts have `draft = true` and won't appear in
  production builds. Use `hugo server -D` to preview them.
- **Markup features enabled site-wide**: math (KaTeX via theme), TOC,
  Mermaid (`mermaidTheme = 'dark'`), syntax highlighting with `monokai` +
  line numbers (`noClasses = false`, so highlighting CSS is generated, not
  taken from `syntax-highlighting.css` — that file is unused by default).
- **Static passthrough**: `static/` is copied verbatim to the site root.
  Favicons, the background gif, cover images, and `bubbles.js` live here.

## Conventions for this repo

- One sentence commit messages (see global `~/.claude/CLAUDE.md`). Recent
  history: `Update home page`, `Write part 1 of simulation article`.
- Don't auto-commit. Leave the diff for review.
- Posts and `hugo.toml` are **public-facing** content — apply the public-doc
  rules from the global `CLAUDE.md` (no internal-flavoured prose, no
  "likely fix" speculation, etc.).
- The "Written by a human, not by AI" badge is hard-coded into
  `layouts/_default/single.html`; preserve it on every post page unless
  explicitly asked to remove it.
