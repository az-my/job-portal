# Solid Grid Job Portal

A high-contrast, high-density, lightning-fast job board platform built with Next.js (App Router + Server Actions + TypeScript) and Tailwind CSS. The UI is designed according to the "Solid Grid" style guidelines (visible dark borders, high contrast, bold typography, maximized data density).

## Key Features
- **Persona Switching**: Impersonate different roles instantly (Candidate, Employer, Admin).
- **Interactive Jobs Board**: Live search and job filtering.
- **My Dashboard**:
  - Candidates can apply to jobs (adding cover letters, resumes) and track application statuses.
  - Employers can review applications, download resumes, and progress candidate applications.
  - Admins have master console controls over users, jobs, and statuses.
- **Pre-seeded Users**: Preconfigured accounts including **dedisuhaimiacc@gmail.com** (Admin).

## Tech Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Shadcn UI / Base UI
- **Database**: Local JSON File (`data/db.json`)

## Getting Started

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Dev Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the portal.

3. **Build for Production**:
   ```bash
   npm run build
   ```
