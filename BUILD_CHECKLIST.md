# Build Checklist — 15 april 2026

## Setup van project-skelet

- [ ] Project-folders aangemaakt: frontend/, backend/, shared/
- [ ] package.json's aangemaakt voor alle drie
- [ ] Root package.json aangemaakt voor script-commando's
- [ ] .env.template aangemaakt

## Volgende stappen per teamlid

### Persoon 1 — Frontend

- [ ] `cd frontend && npm install`
- [ ] Expo Web initializer uitvoeren (of eject als nodig)
- [ ] Mapbox setup:
  - [ ] Mapbox account maken (gratis tier)
  - [ ] API-key genereren
  - [ ] Token in .env kopieren
- [ ] Basis UI-shell met kaart aanmaken
- [ ] Mock data uit shared/ inladen

### Persoon 2 — Backend

- [ ] `cd backend && npm install`
- [ ] MongoDB verbinding opzetten (lokaal of Atlas connection string)
- [ ] Express server opstarten
- [ ] Basis API endpoints scaffolding
- [ ] Incident data model (schema) aanmaken

### Persoon 3 — Integration & Demo

- [ ] `cd shared && npm install` (eigenlijk niet nodig, maar voor controle)
- [ ] shared/incident-contract.json in reporoot plaatsen
- [ ] Bron-mapping scriptje schrijven (voor Air Alert Ukraine parsing)
- [ ] Mock-update endpoint testen

## Doelstellingen vandaag (einde shift 22:00)

- [ ] Frontend toont kaart met Kyiv-regio
- [ ] Backend draait en heeft basis endpoints
- [ ] Mock incidents tonen op kaart
- [ ] Presentatiemodus (?mode=demo) trigger mock-update
- [ ] Offline-fallback werkt (cached data zichtbaar)

## Commando's om alles te starten

```bash
# Alle dependencies installeren
npm run install:all

# Tegelijk frontend en backend starten
npm run dev

# Of apart:
npm run backend    # Terminal 1
npm run frontend:web  # Terminal 2
```

## Opmerkingen

- Semi-handmatig werk is OK voor dag 1
- Focus op werkend krijgen, niet op perfectie
- Demo-mode moet zichtbaar schakelman op ?mode=demo
