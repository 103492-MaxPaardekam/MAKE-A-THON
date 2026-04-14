## Stappenplan voor AI-agent: Save The World Crisis Helper MVP

Dit document beschrijft wat de AI-agent per stap moet doen. Het is geschreven DUIDELIJk VOOR DE AGENT, niet voor de gebruiker.

### Protocol per stap (BINDEND)

1. Agent leest alleen één stap tegelijk.
2. Agent stelt ALLE vragen uit de sectie "Vragen voor gebruiker" VOORDAT werkstukken begonnen.
3. Agent haalt gebruiker akkoord via een gestructureerd Besluitform.
4. Agent voert ALLEEN werkstukken uit die in "Werkstukken" staan.
5. Agent valideert op EXACT de criteria uit "Validatiechecks".
6. Agent rapporteert precies in het formaat uit "Output voor gebruiker".

### Fase 0 - Kaders (verplicht eerst)

1. Productstatement

- Done: probleem en oplossing in 2 zinnen scherp.
- Prompt: Schrijf 3 korte productstatements voor een burgergerichte crisis-safety app en kies de beste met motivatie.

2. Veiligheidsgrenzen

- Done: lijst met In Scope en Out of Scope staat vast.
- Prompt: Maak een policy voor een civiele safety-app: wat mag wel en niet getoond worden, inclusief duidelijke disclaimertekst.

3. Demoflow 10 minuten

- Done: tijdschema per minuut met 1 fallback pad.
- Prompt: Maak een 10-minuten jurydemo met timing per minuut en een fallbackscenario bij internet/API-problemen.

### Fase 1 - Basisarchitectuur

4. Stackkeuze

- Done: frontend, backend, dataopslag en deploy keuze vast.
- Prompt: Vergelijk 2 snelle stacks voor een hackathon MVP (web + mobiele PWA) en adviseer 1 keuze met trade-offs.

5. Projectstructuur

- Done: web, api en shared draaien lokaal.
- Prompt: Genereer een monorepo structuur met apps/web, apps/api en packages/shared inclusief scripts om alles lokaal te starten.

6. Datamodel v1

- Done: Incident, Region, AlertSubscription types gedeeld tussen web en api.
- Prompt: Ontwerp TypeScript modellen en validatieregels voor Incident, Region en AlertSubscription met voorbeeldpayloads.

### Fase 2 - Data intake

7. Connector bron 1

- Done: periodieke fetch werkt met timeout/retry.
- Prompt: Bouw een bronconnector met timeout, retries en logging; output in een uniforme adapter-interface.

8. Connector bron 2

- Done: tweede bron via dezelfde interface.
- Prompt: Voeg een tweede bronconnector toe met exact dezelfde adapter-interface en foutafhandeling.

9. Normalisatie + confidence

- Done: elk incident heeft bron, tijd, confidence, regio.
- Prompt: Implementeer normalisatie en deduplicatie van meerdere bronnen naar 1 incidentschema met confidence-bepaling.

10. Cache + fallback

- Done: laatste bekende status zichtbaar bij bronuitval.
- Prompt: Voeg caching en stale-status toe zodat de app bruikbaar blijft bij tijdelijke API-storingen.

### Fase 3 - API

11. Read endpoints

- Done: regions, incidents, safe-locations beschikbaar.
- Prompt: Bouw REST endpoints voor regions, incidents en safe-locations met input/output validatie.

12. Alert subscriptions

- Done: create/list/delete werkt met basis anti-spam.
- Prompt: Implementeer endpoints voor alert subscriptions met simpele rate limiting en foutmeldingen.

13. Health/status

- Done: team ziet direct bronstatus en API health.
- Prompt: Voeg healthcheck en status endpoint toe met bronstatus, laatste update en eventuele fouten.

### Fase 4 - Web MVP

14. Design tokens

- Done: consistente styling via tokens.
- Prompt: Maak een compact design token systeem (kleur, spacing, typografie) voor een duidelijke crisis-UI.

15. Live risicokaart

- Done: regio's tonen actuele statuskleur.
- Prompt: Bouw een interactieve risicokaart die periodiek incidentdata ophaalt en regio's inkleurt op status.

16. Incidentfeed

- Done: filters en detailpaneel werken.
- Prompt: Maak een incidentfeed met filters op tijd/regio/confidence en een detailpaneel met broninformatie.

17. Safe locations

- Done: gebruiker ziet snelle handelingsopties.
- Prompt: Bouw een safe-locations module met contactgegevens en route-link per locatie.

18. Disclaimer en labels

- Done: op kernschermen staan disclaimer, bronlabel en confidence badge.
- Prompt: Integreer disclaimer, bronlabels en confidence badges op alle kritieke views.

### Fase 5 - Mobiele PWA

19. Installable PWA

- Done: app kan op telefoon geïnstalleerd worden.
- Prompt: Maak de webapp installable als PWA met manifest, iconen en service worker.

20. Mobile-first UI

- Done: 3 kernacties binnen 30 seconden op mobiel.
- Prompt: Optimaliseer de UI voor mobiel zodat regio kiezen, alert lezen en safe location vinden snel gaat.

21. Offline basis

- Done: offline pagina toont laatste data + timestamp.
- Prompt: Voeg offline fallback toe met laatst bekende status en noodnummers.

### Fase 6 - Testen

22. API contracttests

- Done: kernendpoints groen.
- Prompt: Schrijf contracttests voor incidents, regions en subscriptions op schema en statuscodes.

23. End-to-end demo test

- Done: onboarding naar actieflow werkt zonder workaround.
- Prompt: Maak een E2E test voor de flow: onboarding -> kaart -> incident -> safe location.

24. Failure drills

- Done: fallback gedrag aantoonbaar bij storingen.
- Prompt: Simuleer bronuitval, trage responses en lege datasets; documenteer zichtbaar fallback gedrag.

### Fase 7 - Pitch en oplevering

25. Pitchdeck

- Done: 8-10 slides, binnen 10 minuten.
- Prompt: Schrijf een pitchdeck met slide-inhoud en spreektijd per slide voor een 10-minuten jury presentatie.

26. Demo script

- Done: primair en fallback klikpad uitgeschreven.
- Prompt: Maak een minutieus demo-script met klikpad, timing en fallbackplan bij technische problemen.

27. Jury Q&A

- Done: team kan 15 kritische vragen kort beantwoorden.
- Prompt: Genereer 15 realistische juryvragen over betrouwbaarheid, ethiek en schaalbaarheid met korte sterke antwoorden.

## Stoplicht voor scopebewaking

- Groen: kaart + feed + safe locations + disclaimer + bronlabels.
- Oranje: alerts en mobiele polish.
- Rood: geavanceerde AI-voorspelling of complexe native app.

## Dagindeling (kort)

- Woensdag: Fase 0-3 en begin Fase 4.
- Donderdag: rest Fase 4 + Fase 5 + begin Fase 6.
- Vrijdag ochtend: Fase 6 afronden + Fase 7 volledig.
