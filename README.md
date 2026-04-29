# Mermaid Architecture Preview

Live preview of Mermaid diagrams in VS Code with custom icon support for architecture diagrams.

## Features

- Live preview of `.mmd` and `.mermaid` files with keystroke-by-keystroke updates
- Custom SVG icon registration for architecture diagrams (local files or remote URLs)
- Pre-built Iconify icon pack support (200,000+ icons)
- Export diagrams as SVG or PNG
- Automatic theme sync with VS Code (dark/light)

## Usage

1. Open a `.mmd` or `.mermaid` file
2. Click the preview icon in the editor title bar, or run **Mermaid: Open Preview** from the command palette

## Custom Icons

Add to your `settings.json`:

```jsonc
{
  // Individual SVG icons
  "mermaidPreview.icons": {
    "custom:database": "./icons/database.svg",
    "aws:lambda": "https://example.com/lambda.svg"
  },

  // Pre-built Iconify packs
  "mermaidPreview.iconPacks": [
    "https://unpkg.com/@iconify-json/logos@1/icons.json"
  ]
}
```

Then reference in your diagram:

````text
architecture-beta
  service db(custom:database)[My Database]
  service fn(aws:lambda)[Lambda Function]
````

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `mermaidPreview.icons` | `{}` | Map of `prefix:name` to SVG file path or URL |
| `mermaidPreview.iconPacks` | `[]` | URLs to Iconify JSON icon packs |
| `mermaidPreview.theme` | `"auto"` | Mermaid theme: `auto`, `light`, or `dark` |
