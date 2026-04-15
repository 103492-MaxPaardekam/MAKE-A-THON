## Plan: Save The World Crisis Helper MVP

## Bijbehorende skills (.github/skills)

- frontend-design: Voor webinterface, UX-flow en kaartpresentatie van de MVP.
- webapp-testing: Voor scenario-tests, validatie van demo-flow en regressiechecks.
- doc-coauthoring: Voor structuur en kwaliteit van planning, beslislog en pitchdocumentatie.
- internal-comms: Voor heldere statusupdates, rolverdeling en teamafspraken.

TL;DR: Bouw in 3 dagen een webapp + mobiele wrapper met gedeelde backend die burgers realtime, betrouwbaar en begrijpelijk informeert over veiligheid in conflictgebieden. Focus op 1 sterke demo-flow die binnen 10 minuten te pitchen is.

**Steps**

1. Scope en veiligheid afbakenen (blokkeert alle bouwstappen): alleen civiele veiligheidsinformatie, geen tactische/militaire details, duidelijke disclaimer dat dit geen officiële evacuatie-instructie vervangt.
2. Conceptkeuze finaliseren (blokkeert 3): kies 1 hoofdconcept voor uitvoerbaarheid in 3 dagen.
3. Databronnen en updatebeleid vastleggen (_depends on 2_): minimaal 2 betrouwbare bronnen met timestamp, bronlabel en confidence-indicatie.
4. MVP-feature set beperken (_depends on 3_): live risicokaart, incidentfeed, veilige locaties (hulpdiensten/consulaten), alerts per regio.
5. Architectuur voor web + mobiel opzetten (_parallel met 6_): gedeelde API/backend, web front-end als primaire demo, mobiele client als compacte companion.
6. UX-flow ontwerpen voor jurydemo (_parallel met 5_): 60-seconden onboarding, regio kiezen, live update ontvangen, veilige plek vinden.
7. Build-sprint dagindeling uitwerken (_depends on 4,5,6_):
   - Wo 15 april (12:00-22:00): basisarchitectuur + kaart + eerste datasource.
   - Do 16 april (09:00-22:00): alerts, confidence labels, fallback/caching, mobiel scherm.
   - Vr 17 april (09:00-13:00): polish, bugfixes, demo-script, pitchslides.
8. Pitchvoorbereiding voor 10 minuten (_depends on 7_): probleem, oplossing, live demo, impact, grenzen/ethiek, roadmap.

**Relevant files**

- /Users/paard/Documents/MAKE-A-THON/Make'a'ton 2026 info.docx — eventregels, tijdsloten, beoordelingscontext.

**Verification**

1. Elk incident toont: bron, tijd, confidence en regio.
2. Kaart en feed blijven bruikbaar bij tijdelijke datasource-uitval (laatste bekende status zichtbaar).
3. Demo past in 10 minuten inclusief 1 live update-scenario.
4. Product bevat duidelijke veiligheids- en aansprakelijkheidsdisclaimer.
5. Teamworkflow werkt zonder inhoudelijke begeleiderssupport (zelfredzame documentatie + takenbord).

**Decisions**

- In scope: werkende burgergerichte safety-informatie MVP met realtime component.
- Out of scope: geavanceerde voorspellingen, crowd-sourcing zonder moderatie, militair operationele features.
- Constraint uit event: code tijdens event bouwen; assets mogen vooraf; eindpresentatie binnen 10 minuten.

**Further Considerations**

1. Hoofdconcept: Optie A Safety Map, Optie B Safe Route, Optie C Family Check-in. Aanbeveling: A als basis + lichte elementen van B.
2. Platformbalans: Optie A web-first met mobiele PWA, Optie B web + native shell. Aanbeveling: A voor snelheid en stabiliteit.
3. Databetrouwbaarheid: Optie A alleen officiële feeds, Optie B officiële + gerenommeerde media met confidence labels. Aanbeveling: B.
