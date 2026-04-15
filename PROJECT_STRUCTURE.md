# Projectstructuur

Repository-structuur: Losse projecten in één root, zodat drie teamleden parallel kunnen werken zonder overlappende code.

## Mappen

- frontend/
- backend/
- shared/

## Root-configuratie

- .env
- package.json (voor gezamenlijke scripts vanaf morgen)

## Werkverdeling team

- Persoon 1: frontend/
- Persoon 2: backend/
- Persoon 3: shared/ + presentatiemodus + integratie

## Startstrategie

- Vandaag: alleen frontend apart starten
- Vanaf morgen: één root-commando dat frontend en backend samen start

## Presentatiemodus

- Frontend bevat aparte presentation/ of demo/ map voor demo-specifieke logica

## Package manager

- npm
