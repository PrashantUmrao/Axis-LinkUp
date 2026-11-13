# Axis LinkUp — Local Environment Setup Guide

> **Document ID:** DOC-SETUP-002  
> **Status:** Approved Setup Guide  
> **Phase:** Phase 2, Part 2.1 — Development Environment & Prerequisites  
> **Institution:** Axis Institute of Technology & Management  
> **Target Platform:** Microsoft Windows (PowerShell)  
> **Last Updated:** November 2026  

---

## 1. Overview & Purpose

This guide provides definitive, step-by-step instructions for preparing a local developer workstation to contribute to **Axis LinkUp**. It specifies mandatory tools, recommended versions, Windows-specific performance configurations, and verification routines.

---

## 2. Required Toolchain

Every developer machine contributing to Axis LinkUp must have the following primary tools installed:

| Tool | Minimum Version | Recommended Version | Primary Purpose |
| :--- | :--- | :--- | :--- |
| **Node.js** | `>= 18.17.0` | **`22.x LTS`** (Active LTS) | Server-side JavaScript runtime & Next.js execution |
| **npm** | `>= 10.0.0` | **`11.x`** | Package manager, lockfile governance, script runner |
| **Git** | `>= 2.30.0` | **`2.50+ for Windows`** | Distributed version control & hook integration |
| **Code Editor** | Latest | **Antigravity IDE / VS Code** | TypeScript 5+ editing, ESLint, Tailwind CSS intellisense |
| **GitHub CLI** | `>= 2.0.0` | **Latest** *(Optional)* | Pull request and repository management from terminal |
| **Web Browser** | Latest | **Google Chrome / MS Edge** | Development testing, DevTools, responsive emulation |

---

## 3. Installation Guidance for Missing Tools

### 3.1 Node.js & npm
If Node.js is missing or outdated:
- **Recommended Method (Version Manager):** Install `nvm-windows` to switch between Node versions cleanly:
  ```powershell
  winget install CoreyButler.NVMforWindows
  ```
- **Install Active LTS (Node 22):**
  ```powershell
  nvm install 22.20.0
  nvm use 22.20.0
  ```
- **Direct Installer:** Download the official LTS installer from [nodejs.org](https://nodejs.org).

### 3.2 Git for Windows
If Git is missing:
- Install via Windows Package Manager:
  ```powershell
  winget install --id Git.Git -e --source winget
  ```
- Or download the 64-bit installer from [git-scm.com](https://git-scm.com).

### 3.3 GitHub CLI (`gh`) (Optional)
If `gh` is missing:
- Install via Windows Package Manager:
  ```powershell
  winget install --id GitHub.cli
  ```
- Authenticate with your GitHub account:
  ```powershell
  gh auth login
  ```

---

## 4. Git Configuration & Setup

### 4.1 Global User Identity
Configure your identity so commits are attributed correctly:
```powershell
git config --global user.name "Your Name"
git config --global user.email "your.email@axiscolleges.in"
```

### 4.2 Line Ending Handling (Windows vs. Linux)
Windows uses Carriage Return + Line Feed (`CRLF`), whereas Linux (and Vercel's build servers) uses Line Feed (`LF`). To prevent git diff noise:
```powershell
git config --global core.autocrlf true
```

### 4.3 Default Branch Name
Set the default branch to `main`:
```powershell
git config --global init.defaultBranch main
```

---

## 5. Windows-Specific Setup Notes & Optimizations

### 5.1 Enable Git Long Path Support
Next.js applications with deep `node_modules` nesting can exceed the standard 260-character Windows path limit. Enable long paths in Git:
```powershell
git config --system core.longpaths true
# Or locally for this repository:
git config core.longpaths true
```

### 5.2 PowerShell Script Execution Policy
Husky pre-commit hooks and local npm scripts execute PowerShell scripts. If script execution is restricted:
```powershell
# Check current execution policy:
Get-ExecutionPolicy -Scope CurrentUser

# Set execution policy to RemoteSigned (allows locally written scripts):
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 5.3 Case Sensitivity Notice
- **Windows NTFS** is case-preserving but case-insensitive.
- **Linux (Vercel)** is strictly case-sensitive.
- **Best Practice:** Never rename files by solely changing letter casing (e.g., `userCard.tsx` to `UserCard.tsx`) without staging the change explicitly via Git:
  ```powershell
  git mv userCard.tsx TempCard.tsx
  git mv TempCard.tsx UserCard.tsx
  ```

---

## 6. Verification Commands Checklist

Run the following commands in PowerShell from the project root to verify your workstation is fully primed:

```powershell
# 1. Verify Node.js version (Must output v18.17.0+ or v20+/v22+)
node -v

# 2. Verify npm version (Must output 10.x or 11.x)
npm -v

# 3. Verify Git version
git --version

# 4. Verify Git User Identity
git config user.name
git config user.email

# 5. Verify Script Execution Policy
Get-ExecutionPolicy -Scope CurrentUser

# 6. Verify Optional GitHub CLI
gh --version
```

### Expected Output Summary:
```
Node.js:  v22.20.0 (or v20.x+)
npm:      11.6.0 (or 10.x+)
Git:      git version 2.52.0.windows.1 (or 2.30+)
Identity: [Your Name] / [Your Email]
Policy:   RemoteSigned (or Unrestricted / Bypass)
```

---

## 7. Next Step in Setup Sequence

Once your environment is verified, proceed to **Phase 2, Part 2.2**:
- Initialize Git repository (`git init -b main`).
- Deploy `.gitignore` and `.gitattributes`.
- Initialize Next.js 15+ App Router application with approved TypeScript & Tailwind configuration.

