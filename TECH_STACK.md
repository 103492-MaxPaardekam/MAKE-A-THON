# Tech Stack

Frontend: React Native + Expo (JavaScript, geen TypeScript) — Expo Web voor browser-demo
Backend: Node.js + Express (latest stable)
Database: MongoDB (lokale dev via MongoDB Community / Atlas gratis tier voor deployment)
Kaart: Mapbox GL JS via mapbox-gl (gratis tier, API-key vereist)
Deployment: Expo Web (frontend via `expo start --web`) + Render (API/backend)
Demo-modus: URL-param `?mode=demo` activeert verborgen mock-update knop

Justificatie: Expo Web elimineert platform-split (geen react-native-maps conflict), Mapbox geeft sterkste visuele jury-indruk, Express is in minuten opgezet, MongoDB heeft geen strict schema nodig voor gevarieerde incident-data van meerdere bronnen. Gehele team comfortabel in JavaScript.
