# Demo Script (10 minuten)

## Minuut 0:00–1:00: Intro

- **Wie:** Teamlid 1
- **Wat zeg je:** "Stel je voor: je bent in Kyiv. Buiten klinkt luchtalarm. Je weet niet welke wijk veilig is, waar het dichtstbijzijnde consulaat is, of hoe je hulp bereikt. Voor dit probleem hebben wij een oplossing gebouwd."
- **Wat zie je op scherm:** Splash screen van de app met disclaimer
- **Klik stap:** App openen, disclaimer zichtbaar — Teamlid 2 neemt over

---

## Minuut 1:00–4:00: Kaart met risicodata

- **Wie:** Teamlid 2
- **Wat zeg je:** "Dit is de kaart. Alle actieve conflictgebieden zijn zichtbaar. Elk incident heeft een bronlabel en een confidence-indicator. We zoomen in op Kyiv."
- **Wat zie je op scherm:** Wereldkaart met conflictgebieden gemarkeerd → inzoomen op Kyiv → wijken gekleurd op risiconiveau → incidents met confidence-labels (bron: overheid = hoog, pers = middel, crowd = ongevalideerd)
- **Klik stap:** Inzoomen op Kyiv → incident aanklikken → detailpaneel opent met bron, tijd, confidence en regio

---

## Minuut 4:00–7:00: Live update (mock)

- **Wie:** Teamlid 3
- **Wat zeg je:** "De app ontvangt continu updates. Kijk wat er nu binnenkomt."
- **Wat zie je op scherm:** Nieuw incident verschijnt op de kaart (getriggerd via presentatiemodus) → notificatie in feed → kaart herkleurdt betrokken wijk
- **Klik stap:** Presentatiemodus-knop triggeren (alleen zichtbaar in ?mode=demo, onzichtbaar in afgeronde app) → incident verschijnt live

---

## Minuut 7:00–9:00: Actie — veilige locatie vinden

- **Wie:** Teamlid 2
- **Wat zeg je:** "Je wil nu weten: wat is de dichtstbijzijnde veilige plek? De app toont consulaten, ICRC-locaties en noodopvang. En als internet wegvalt — de app blijft werken."
- **Wat zie je op scherm:** Veilige locaties verschijnen als pins op kaart → één aankliken toont adres + contactinfo → offline-indicator demonstreren (vliegtuigmodus aan → app toont gecachede data + "Offline — laatste update: [tijd]" banner)
- **Klik stap:** Veilige locatie pin aanklikken → offline-modus demonstreren

---

## Minuut 9:00–10:00: Vragen jury

- **Wie:** Iedereen
- **Voorbereiding:** Ieder teamlid kent zijn/haar technisch domein voor beantwoording

---

## Fallback plan

| Situatie             | Actie                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| Internet weggevallen | App toont gecachede data automatisch + "Offline" banner — demo loopt door      |
| API traag of down    | Gecachede data is zichtbaar, confidence-labels intact — benoem het als feature |
| Pagina crashed       | Hard refresh → app herlaadt met gecachede state — 30 sec verlies max           |

---

## Voorbereiding checklist (dag van pitch)

- [ ] Laptop opgeladen (+ oplader mee)
- [ ] Internet verbinding getest op locatie
- [ ] App lokaal of gedeployed draaiend getest
- [ ] Presentatiemodus (?mode=demo) getest en werkend
- [ ] Mock-update trigger getest (incident verschijnt correct)
- [ ] Offline fallback getest (vliegtuigmodus → gecachede data zichtbaar)
- [ ] Kyiv-regio vooraf ingeladen in cache
- [ ] Alle teamleden weten hun moment en klik-volgorde
- [ ] Disclaimer zichtbaar op splash screen gecontroleerd
