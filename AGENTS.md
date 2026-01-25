# Agent Guidelines

## Theme & Styling

This project uses a **light theme**. Use the following color conventions:

### Text Colors
- Primary text: `text-neutral-900`
- Secondary text: `text-neutral-500`
- Muted/tertiary text: `text-neutral-400`
- Success text: `text-emerald-600`
- Warning text: `text-amber-600`
- Error text: `text-red-600`

### Backgrounds
- Page background: `bg-neutral-50` or default
- Card background: `bg-white` with `border-neutral-200`
- Subtle backgrounds: `bg-neutral-100`
- Hover states: `hover:bg-neutral-50` or `hover:bg-neutral-100`

### Form Elements
- Input borders: `border-neutral-300`
- Input focus: `focus:border-emerald-500 focus:ring-emerald-500`
- Input background: `bg-white`

### DO NOT USE
- Dark theme colors like `bg-slate-800`, `bg-slate-900`, `text-slate-100`
- These were used in earlier code but should be replaced with light theme equivalents

## File Storage

- EPUB files are parsed in memory and content is stored in the database
- Original files are not currently stored (future: R2 or user's cloud storage)

## Database

- Uses Neon PostgreSQL with custom migrations in `api/src/db/migrate.ts`
- Run migrations with: `cd api && npx tsx src/db/migrate.ts`
