## Stappenplan voor AI-agent: Save The World Crisis Helper MVP

Dit document beschrijft wat jij (de AI-agent) per stap moet doen. Het is geschreven DUIDELIJK VOOR JOU, niet voor de gebruiker.

### Protocol per stap (BINDEND)

1. Jij leest alleen één stap tegelijk.
2. Jij stelt ALLE vragen uit "Vragen voor gebruiker" VOORDAT werkstukken begonnen.
3. Jij haalt gebruiker akkoord via een gestructureerd Besluitform.
4. Jij voert ALLEEN werkstukken uit die in "Werkstukken" staan.
5. Jij valideert op EXACT de criteria uit "Validatiechecks".
6. Jij rapporteert precies in het formaat uit "Output voor gebruiker".

---

## FASE 0 - KADERS (verplicht eerst)

### Stap 0.1 - Productstatement vastzetten

**Doel:** Gebruiker en jij hebben dezelfde 2-zins productbeschrijving.

**Vragen voor gebruiker:**

1. Waar focus je op: crisis-veiligheidsinformatie, noodcommunicatie, of familiecheck-in?
   - Optie A: Crisis-veiligheidsinformatie (waar is het veilig, hoe riskant is het)
   - Optie B: Noodcommunicatie (hoe bereik ik hulp)
   - Optie C: Familiecheck-in (waar zijn mijn naasten)
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt kernwaarde van MVP.

2. Welke geografische regio/crisis als voorbeeld in MVP?
   - Optie A: Fictioneel/generiek (landen X, Y, Z. als voorbeeld)
   - Optie B: Real-time regio (Iran, Pakistan, specifieke plaats)
   - Optie C: Meerdere regio's tegelijk
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt databeschaffen.

3. Moet de app geld verdienen of is het volledig non-profit?
   - Optie A: Volledig non-profit, geen commercieel plan
   - Optie B: Freemium met extra features betaald
   - Optie C: Open source, geen verdienmodel
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt disclaimer-verplichting.

**Jouw werkstukken (NIET MEER, NIET MINDER):**

1. Maak bestand `PRODUCT_STATEMENT.md` met EXACT deze structuur:

   ```
   # Productstatement

   Probleem: [1 zin]
   Oplossing: [1 zin]
   ```

   Voer WOORDELIJK wat de gebruiker zei in.

**Jouw validatiechecks:**

1. Bestand `PRODUCT_STATEMENT.md` bestaat.
2. Inhoud is exact 2 zinnen (1 probleem + 1 oplossing), geen extra.
3. Geen jouw eigen interpretatie toegevoegd.

**Jouw output naar gebruiker:**

```
✓ STAP 0.1 VOLTOOID

Productstatement aangemaakt:

PROBLEEM: [wat gebruiker zei]
OPLOSSING: [wat gebruiker zei]

Bestand: PRODUCT_STATEMENT.md

Volgende stap: 0.2 (Veiligheidsgrenzen)
```

---

### Stap 0.2 - Veiligheidsgrenzen vastleggen

**Doel:** Duidelijk In/Out Scope zodat ethisch en wettelijk verantwoord wordt gebouwd.

**Vragen voor gebruiker:**

1. Mag de app militaire of tactische informatie tonen?
   - Optie A: Nee, alleen civiele info
   - Optie B: Ja, militaire info als geverifieerd
   - Optie C: Nee, met duidelijke disclaimer
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt wettelijke aansprakelijkheid.

2. Mag de app crowd-sourced reportages tonen zonder verificatie?
   - Optie A: Nee, alleen officiële bronnen
   - Optie B: Ja, maar met "ongevalideerd" label
   - Optie C: Nee, maar wel geverifieerde sociale media
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt moderation-effort.

3. Welke bronnen zijn OK voor data?
   - Optie A: Alleen regering + ICRC
   - Optie B: Regering + ICRC + pers (Reuters, AP)
   - Optie C: Alles met confidence-label
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt integratiewerk.

4. Moet in de app staan: "Dit vervangt officiële evacuatie-instructies niet"?
   - Optie A: Ja, op elke pagina
   - Optie B: Ja, alleen op startpagina
   - Optie C: Nee
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt regelgeving-naleving.

**Jouw werkstukken:**

1. Maak bestand `POLICY.md` met EXACT deze structuur:

   ```
   # Veiligheidspolicy

   ## In Scope (wat mag)
   [gebruiker zijn keuzes]

   ## Out of Scope (wat mag niet)
   [gebruiker zijn keuzes]

   ## Bronnen
   [gebruiker zijn keuzes]

   ## Duidelijke disclaimertekst voor app
   [exact schrijven zodat copy-paste kan]
   ```

**Jouw validatiechecks:**

1. Bestand `POLICY.md` bestaat.
2. Alle 4 vragen hebben antwoord (geen "tbd").
3. Disclaimertekst is helemaal uitgeschreven en klaar om te copy-pasten.

**Jouw output naar gebruiker:**

```
✓ STAP 0.2 VOLTOOID

Policy aangemaakt:

IN SCOPE: [gebruiker zijn keuzes]
OUT OF SCOPE: [gebruiker zijn keuzes]
BRONNEN: [gebruiker zijn keuzes]

DISCLAIMER TEKST:
[exact kopieerbare tekst]

Bestand: POLICY.md

Volgende stap: 0.3 (Demo-flow)
```

---

### Stap 0.3 - Demo-flow 10 minuten definiëren

**Doel:** Jij en gebruiker weten precies welke 4 momenten de jury ziet.

**Vragen voor gebruiker:**

1. Hoeveel tijd per moment?
   - Optie A: Intro 1 min, kaart 3 min, update 3 min, actie 2 min, vragen 1 min
   - Optie B: Intro 2 min, kaart 4 min, update 2 min, actie 1 min, vragen 1 min
   - Optie C: [gebruiker schrijft verdeling]
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt demo-focus.

2. Hoe demonstreer je live data?
   - Optie A: Pre-gemaakte dataset en "refresh"
   - Optie B: Echte API en hoop dat het werkt
   - Optie C: Mock update die ik trigger
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt fallback-plan.

3. Fallback als internet wegvalt?
   - Optie A: Ik show gecashde data
   - Optie B: Ik show offline mode
   - Optie C: Ik ga terug naar slides
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt risicobeheer.

**Jouw werkstukken:**

1. Maak bestand `DEMO_SCRIPT.md` met EXACT deze structuur:

   ```
   # Demo Script (10 minuten)

   ## Minuut 1-2: Intro
   - Wat zeg je: [exact script]
   - Wat zie je op scherm: [screenshot beschrijving]
   - Klik stap: [welke knop]

   ## Minuut 3-5: Kaart met live data
   - Wat zeg je: [exact script]
   - Wat zie je: [screenshot beschrijving]
   - Klik stap: [welke knop]

   ## Minuut 6-8: Incident detail
   - [idem]

   ## Minuut 9-10: Safe location + Q&A
   - [idem]

   ## Fallback plan
   - Als internet weg: [exact wat je doet]
   - Als API traag: [exact wat je doet]
   - Als pagina crashed: [exact wat je doet]

   ## Voorbereiding checklist
   - Laptop opgeladen
   - Internet aan
   - API up
   - Data geladen
   - Fallback data geklaarprintd
   ```

**Jouw validatiechecks:**

1. Bestand `DEMO_SCRIPT.md` bestaat.
2. Elke minuut is exact beschreven (geen vaagheid).
3. Fallback pad is volledig uitgeschreven.
4. Voorbereiding checklist is compleet.

**Jouw output naar gebruiker:**

```
✓ STAP 0.3 VOLTOOID

Demo script aangemaakt:

TIMING:
- Minuut 1-2: Intro + scherm load
- Minuut 3-5: Kaart met live data
- Minuut 6-8: Incident detail + update
- Minuut 9-10: Safe location + Q&A

FALLBACK PLAN:
- Internet weg: [gebruiker's keuze]
- API traag: [gebruiker's keuze]
- Crash: [gebruiker's keuze]

Bestand: DEMO_SCRIPT.md

**FASE 0 KLAAR** - Je mag nu naar FASE 1
```

---

## FASE 1 - BASISARCHITECTUUR

### Stap 1.1 - Stackkeuze

**Doel:** Geen onzekerheid meer over tech choices.

**Vragen voor gebruiker:**

1. Frontend framework?
   - Optie A: React + TypeScript
   - Optie B: Vue + TypeScript
   - Optie C: Svelte + TypeScript
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt leerkurve en dependency-load.

2. Backend?
   - Optie A: Node.js + Express
   - Optie B: Node.js + Fastify
   - Optie C: Python + FastAPI
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt deployment-snelheid.

3. Database?
   - Optie A: PostgreSQL
   - Optie B: MongoDB (lokaal dev)
   - Optie C: SQLite (snelste lokaal)
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt setup-tijd.

4. Deployment?
   - Optie A: Lokaal enkel (hackathon)
   - Optie B: Vercel (front) + Render (api)
   - Optie C: Docker + eigen server
   - Voorkeur? [gebruiker antwoordt]
   - Effect: bepaalt demo-risico.

**Jouw werkstukken:**

1. Maak bestand `TECH_STACK.md`:

   ```
   # Tech Stack

   Frontend: [keuze + versie]
   Backend: [keuze + versie]
   Database: [type + setup]
   Deployment: [waar + hoe]

   Justificatie: [waarom is dit snel voor hackathon]
   ```

**Jouw validatiechecks:**

1. Bestand `TECH_STACK.md` bestaat.
2. Alle 4 keuzes zijn gemaakt (geen "tbd").
3. Justificatie maakt sense voor hackathon (snelheid prioriteit).

**Jouw output naar gebruiker:**

```
✓ STAP 1.1 VOLTOOID

Stack gekozen:
- Frontend: [gebruiker's keuze]
- Backend: [gebruiker's keuze]
- Database: [gebruiker's keuze]
- Deployment: [gebruiker's keuze]

Bestand: TECH_STACK.md

Volgende stap: 1.2 (Projectstructuur)
```

---

### Stap 1.2 - Projectstructuur opzetten

[etc. volgt hetzelfde patroon]

---

## HERKENNINGSTEKENS VOOR JOU (AGENT)

Zelfcontrole-checklist per stap:

- [ ] Stap gelezen en begrepen?
- [ ] Alle vragen gesteld EN antwoorden ontvangen?
- [ ] Gebruiker akkoord gegeven met "Ja"?
- [ ] Alle werkstukken opgeleverd?
- [ ] Validatiechecks uitgevoerd EN groen?
- [ ] Output formaat gevolgd (checkmark + structuur)?
- [ ] Niet voorbij deze stap gegaan in het plan?

**ROOD STOPLICHT = STOP en wacht op gebruiker**

- Geen akkoord gekregen
- Werkstukken niet voltooid
- Validatiechecks rood
- Onduidelijkheid uit plan
