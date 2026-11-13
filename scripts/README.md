# Administrative & Database Scripts (`scripts/`)

This directory houses administrative automation scripts, database seeding utilities, schema migration helpers, and pre-flight verification scripts for **Axis LinkUp**.

## 1. Script Categories

- **Seed Data:** Synthetic academic department structures, sample courses, and demo user accounts for local development.
- **Index Verification:** Scripts to verify that MongoDB compound indexes match the ESR (Equality, Sort, Range) rule.
- **Maintenance:** Administrative data cleanup, orphaned record sweepers, and retention policy archives.

## 2. Execution Guidelines

- Scripts execute in standalone Node.js environments via `tsx` or `ts-node`.
- Scripts must explicitly load environment variables from `.env.local` or `.env`.
- Database connections in scripts must be explicitly terminated with `mongoose.disconnect()` upon script completion.
