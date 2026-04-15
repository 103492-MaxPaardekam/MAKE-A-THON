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
1. Maak bestand `POLICY.md` met de veiligheidsgrenzen exact zoals gebruiker bepaald.

**Jouw validatiechecks:**
1. Bestand `POLICY.md` bestaat.
2. Alle 4 vragen hebben antwoord (geen "tbd").
3. Disclaimertekst is helemaal uitgeschreven en klaar om te copy-pasten.

**Jouw output naar gebruiker:**
```
✓ STAP 0.2 VOLTOOID

Policy aangemaakt: POLICY.md

Volgende stap: 0.3 (Demo-flow)
```

---

### Stap 0.3 - Demo-flow 10 minuten definiëren

**Doel:** Jij en gebruiker weten precies welke 4 momenten de jury ziet.

**Vragen voor gebruiker:**
1. Hoeveel tijd per moment? (totaal 10 min)
2. Hoe demonstreer je live data? (pre-mocked, echte API, of mock trigger)
3. Fallback als internet wegvalt? (cached data, offline mode, of slides)

**Jouw werkstukken:**
1. Maak bestand `DEMO_SCRIPT.md` met per minuut exact wat je zegt, doet en wat op scherm staat.
2. Voorbereiding checklist toevoegen.

**Jouw validatiechecks:**
1. Bestand `DEMO_SCRIPT.md` bestaat.
2. Elke minuut is exact beschreven.
3. Fallback pad is volledig uitgeschreven.

**Jouw output naar gebruiker:**
```
✓ STAP 0.3 VOLTOOID

Demo script aangemaakt: DEMO_SCRIPT.md

**FASE 0 KLAAR** - Je mag nu naar FASE 1
```

---

## FASE 1-7: TEMPLATE VOLGEN

[Voor alle volgende stappen 1.1 tot 7.3: follow exact dezelfde patroon]

Per stap:
- Vragen stellen
- Werkstukken uitvoeren
- Validatiechecks doen
- Output rapporteren

---

## HERKENNINGSTEKENS VOOR JOU (AGENT)

Zelfcontrole per stap:
- [ ] Stap gelezen?
- [ ] Alle vragen gesteld EN antwoorden ontvangen?
- [ ] Gebruiker akkoord gegeven?
- [ ] Alle werkstukken opgeleverd?
- [ ] Validatiechecks GROEN?
- [ ] Output formaat gevolgd?
- [ ] Niet voorbij deze stap gegaan?

**ROOD STOPLICHT = STOP**
- Geen akkoord
- Werkstukken niet af
- Validatiechecks mislukt
- Onduidelijkheid in plan
