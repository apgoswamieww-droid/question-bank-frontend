# Question Bank
opencode -s ses_fc8c650d3ffe5tz4KT3NHna4jd
opencode -s ses_fc8c650d3ffe5tz4KT3NHna4jd
Desktop application for creating, editing, and exporting exam question papers. Built with React, TipTap, and Electron. Targets Indian educational institutions with support for MCQ-based exams and Gujarati language input.

## Features

- **MCQ Question Blocks** — Structured blocks with question, 4 options (A-D), answer, and marks
- **Rich Text Editor** — Bold, italic, underline, alignment, lists, font size
- **A4 Print Layout** — Auto-pagination, exam headers, section dividers, page numbering
- **PDF Export** — Via Electron's printToPDF
- **Gujarati Support** — Direct Unicode Gujarati text input
- **Math Equations** — KaTeX/LaTeX editor with categorized formula library
- **Image Support** — Paste, drop, or file insert with resize and alignment
- **Exam Settings** — Configure institute name, title, subject, sections, logo, instructions
- **Auto-Save** — Every 30 seconds with status indicator
- **Recent Files** — Quick access to recently opened documents
- **Keyboard Shortcuts** — Ctrl+N/O/S/Shift+S

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 19, TypeScript 6, Vite 8 |
| Editor | TipTap 3 (ProseMirror) |
| Math | KaTeX 0.18 |
| Desktop | Electron 43 |
| Testing | Vitest, @testing-library/react |
| Linting | ESLint 10, typescript-eslint |

## Getting Started

### Prerequisites

- Node.js 22+
- npm

### Setup

```bash
npm install
```

### Development

```bash
npm run dev
```

Starts Vite dev server and Electron simultaneously with hot reload.

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server + Electron |
| `npm run build` | Production build |
| `npm run build:win` | Build Windows distributable |
| `npm test` | Run tests |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type-check |

## Project Structure

```
question-bank/
├── electron/              # Electron main process
│   ├── main.cjs           # Window, IPC, file dialogs, PDF export
│   └── preload.cjs        # Context bridge
├── src/
│   ├── App.tsx            # Root component (composition root)
│   ├── extensions/        # Custom TipTap extensions
│   ├── hooks/             # Custom React hooks
│   ├── components/        # UI components
│   ├── print/             # Print/PDF layout engine
│   ├── types/             # TypeScript types
│   ├── utils/             # Utilities
│   └── test/              # Test setup
└── doc/                   # Development logs
```

## Custom File Format

Documents use `.qbank` — a JSON format containing:

```json
{
  "format": "question-bank",
  "version": 2,
  "title": "Exam Title",
  "metadata": { "instituteName": "...", "sections": [...] },
  "content": { /* TipTap JSON document */ }
}
```

## Testing

```bash
npm test           # Single run
npm run test:watch # Watch mode
```

Tests cover document migration, editor utilities, and validation logic.

## License

See [LICENSE](LICENSE) for details.
