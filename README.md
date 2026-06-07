# Atlas HTML

Atlas HTML ist ein kontrollierter Fork von **Roadtrip**. Die vorhandene
[`index.html`](index.html) bleibt die technische Grundlage und wird schrittweise
von der Roadtrip-Terminologie in den Atlas-Kontext überführt. Dieses Repository
ist ausdrücklich kein Neubau.

## Aktueller Stand

Die Anwendung bleibt vorerst eine eigenständige Single-File-HTML-Anwendung. Die
Bestandsprüfung der `index.html` bestätigt unter anderem:

- lokale Persistenz über IndexedDB mit `localStorage`-Fallback,
- JSON-, Rohdaten-, Notfall- und ZIP-Backup-Grundmechanik,
- JSON-Import mit Ersetzen oder selektivem Merge,
- Hauptchat-, Sprintchat- und weitere Chattypen,
- Sprint-Start-, Sprint-Abschluss- und Handoff-Abläufe,
- FeatureFlow-Daten mit optionaler Mermaid-Vorschau,
- eine vorhandene, verschlüsselte Gist-Sync-Grundstruktur,
- weitere Roadtrip-Funktionen, die bis zu einer gezielten Migration erhalten
  bleiben.

Die internen Bezeichner, Storage-Keys, Exportnamen und UI-Texte heißen aktuell
an vielen Stellen weiterhin Roadtrip. Das ist in dieser Vorbereitungsphase
beabsichtigt: Kompatibilität und Datenhaltbarkeit haben Vorrang vor einer
vorschnellen Umbenennung.

## Zielbild

Atlas HTML soll eine lokale, kontrollierbare Projektarbeitsoberfläche werden.
Roadtrips Grundarchitektur wird bewusst übernommen:

- Single-File-Auslieferung,
- lokale und exportierbare Datenhaltung,
- Projektbausteine und Arbeitsphasen,
- Hauptchat/Sprintchat,
- Handoffs als nachvollziehbare Journal-Ereignisse,
- Projektdossier und Projektjournal,
- Materialanalyse bzw. Gegenstands-Abgleich,
- optionaler, sicherer Sync.

Eine spätere Atlas-HTML-Exportform soll von **Atlas Python** defensiv importiert
werden können. Der Python-Importer darf unbekannte oder fehlerhafte Inhalte
nicht blind übernehmen.

## Leitplanken

- Keine privaten Daten, Tokens, Secrets, Gist-IDs oder privaten Chat-URLs
  committen.
- Keine echten Roadtrip-Exporte als Fixtures einchecken.
- Roadtrip-Fachlogik erst entfernen, wenn Ersatz, Migration und Rückfallweg
  geklärt sind.
- Persistenz-, Import-, Export-, Backup-, Chat-, Handoff- und Sync-Verhalten
  vor Änderungen mit anonymisierten Testdaten absichern.
- Gist-Sync erst nach Umsetzung der dokumentierten Sync-Safety-Regeln für Atlas
  freigeben.

## Dokumentation

- [Intent](docs/atlas-html-intent.md)
- [Terminologie-Mapping](docs/terminology-mapping.md)
- [Exportvertrag, Entwurf](docs/export-contract-draft.md)
- [Sync-Safety-Notizen](docs/sync-safety-notes.md)
- [Implementierungsplan](docs/implementation-plan.md)

## Repository-Struktur

```text
.
├── index.html
├── README.md
└── docs/
```

`index.html` bleibt bis auf Weiteres die ausführbare Anwendung. Ein Build-System
oder ein neues Datenmodell gehört nicht zu dieser Initialisierung.
