# Source Endpoint and Mapping Plan

## Official source strategy

- Primary official source: Kyiv-specific official source
- Fallback official source: second official source if the primary feed is unavailable or unusable
- Preferred access form: RSS/feed or other structured public feed

## ReliefWeb strategy

- ReliefWeb is used for humanitarian context and advisory updates
- ReliefWeb items are mapped into the incident contract where possible

## Reuters strategy

- Reuters is shown in feed/detail views
- Reuters items may be mapped to a region when a city or country is mentioned
- Reuters does not determine map coloring

## Confidence and validation defaults by source type

| Source type        | confidenceScore | validationStatus |
| ------------------ | --------------- | ---------------- |
| Official           | 5               | verified         |
| NGO / humanitarian | 4               | verified         |
| Press              | 3               | unverified       |
| Social / crowd     | 1               | unverified       |

## First detailed mapping plan for the official source

| Contract field   | Source signal                                              | Transform rule                                            | Fallback               |
| ---------------- | ---------------------------------------------------------- | --------------------------------------------------------- | ---------------------- |
| title            | Headline / title text                                      | Trim and keep short readable summary                      | `Onbekend incident`    |
| region           | Location text in title, category, or description           | Parse to city/region string                               | `onbekend`             |
| coordinates.lat  | Latitude if present, otherwise derived from parsed region  | Use provided coordinate or geocode parsed region          | `null`                 |
| coordinates.lng  | Longitude if present, otherwise derived from parsed region | Use provided coordinate or geocode parsed region          | `null`                 |
| time             | Published or updated timestamp                             | Convert to ISO-8601                                       | `onbekend`             |
| source           | Feed identifier                                            | Fixed source label for the chosen official feed           | `official-kyiv-source` |
| confidenceScore  | Source type                                                | Fixed score for official source                           | `5`                    |
| validationStatus | Source type                                                | Fixed validation for official source                      | `verified`             |
| status           | Severity/category keywords if present                      | Map to `low`, `medium`, or `high`                         | `medium`               |
| advice           | Status/severity outcome                                    | Map `high -> gevaar`, `medium -> let op`, `low -> veilig` | `let op`               |

## Open points

- The exact Kyiv-specific source name and endpoint URL still need to be selected
- The exact fallback official source still needs to be named
