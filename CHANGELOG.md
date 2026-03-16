# Changelog — AI Onboarding Agent

## [0.17.0] — 2026-03-15

### Added
- Proactive agent behavior: opening an employee record automatically triggers the agent, which detects a missing employment contract and offers to generate one

### Fixed
- CSV import accepts records without a start date
- iOS Safari: agent panel stays above the virtual keyboard at all times

---

## [0.13.0] — 2026-03-13

### Changed
- Cloud Run deployment configured with `min-instances=1` — no cold starts during the active usage period

### Fixed
- iOS safe area insets (notch, home indicator, browser chrome)
- CSV import now shows a success confirmation after bulk import

---

## [0.8.0] — 2026-03-12

### Added
- Persistent agent panel available on all pages — not limited to active onboarding sessions
- Idle chat mode: query employee data and navigate the app through natural conversation
- Agent-driven navigation — the agent navigates automatically, no manual instructions needed

### Fixed
- Mobile image upload: HEIC/HEIF files are now handled correctly
- iOS Safari auto-zoom on input focus prevented
- WebSocket reconnection on transient backend unavailability

---

## [0.5.0] — 2026-03-09

### Added
- Employee management: list view, detail view, edit, delete
- CSV import and export
- Employment contract generation based on onboarding data
- Voice input via Web Speech API
- Camera fallback to native file picker when camera access is unavailable

---

## [0.1.0] — 2026-03-09

### Added
- Initial release
- Gemini 2.5 Flash streaming for document extraction and multi-turn onboarding dialogue
- Profile preview with inline editing before saving
- In-memory employee storage for local use
