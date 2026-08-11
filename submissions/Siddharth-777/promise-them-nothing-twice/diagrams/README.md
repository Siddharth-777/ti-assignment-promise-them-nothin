# Diagrams

Mermaid source files documenting the RelayAPI rate limiter implementation.

| File | Description |
|------|-------------|
| `architecture.mmd` | System architecture — harness, three HTTPS app nodes, shared Redis, config and cert flows |
| `sequence.mmd` | Full request lifecycle sequence diagram from harness through middleware, config, Redis Lua, and back |
| `class.mmd` | Module dependency diagram showing actual exports and relationships across src/ and harness/ |

## Viewing

These render natively when viewed on GitHub (GitHub supports Mermaid in `.mmd` files and fenced code blocks).

To view locally:

- **VS Code**: Install the [Markdown Preview Mermaid Support](https://marketplace.visualstudio.com/items?itemName=bierner.markdown-mermaid) or [Mermaid Editor](https://marketplace.visualstudio.com/items?itemName=tomoyukim.vscode-mermaid-editor) extension
- **Browser**: Paste the contents into the [Mermaid Live Editor](https://mermaid.live)
- **CLI**: Use `mmdc` from the `@mermaid-js/mermaid-cli` npm package to render to SVG/PNG
