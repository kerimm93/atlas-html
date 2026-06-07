# Atlas-HTML-Exportvertrag: Entwurf

Status: konzeptioneller Entwurf, noch nicht in `index.html` implementiert.

## Ziel

Atlas HTML soll später einen versionierten JSON-Export erzeugen, den Atlas
Python defensiv importieren kann. Der Export ist ein Übergabevertrag, kein
ungeprüft wiederherzustellender Laufzeitspeicher.

Der vorhandene Roadtrip-Export bleibt bis zur Implementierung eines getesteten
Atlas-Formats erhalten. Aktuell existieren unter anderem ein direkter
State-Export, vollständige und kompakte Notfall-Exporte sowie ein
`roadtrip-zip-v1`-Backup.

## Vorgeschlagene Hülle

```json
{
  "format": "atlas-html-export",
  "schemaVersion": 1,
  "exportedAt": "2030-01-01T12:00:00.000Z",
  "producer": {
    "app": "Atlas HTML",
    "appVersion": "unknown",
    "lineage": "roadtrip-controlled-fork"
  },
  "data": {
    "projects": [],
    "projectComponents": [],
    "notes": [],
    "analyses": [],
    "chats": [],
    "journalEvents": [],
    "importHistory": []
  },
  "extensions": {}
}
```

Die Namen in diesem Beispiel sind noch nicht das neue interne Datenmodell.
Insbesondere `projectComponents` kann bei der Erzeugung zunächst aus dem
Roadtrip-Feld `features` abgeleitet werden.

## Pflichtfelder der Hülle

| Feld | Typ | Regel |
| --- | --- | --- |
| `format` | String | Exakt `atlas-html-export`. |
| `schemaVersion` | Integer | Positive, unterstützte Hauptversion. |
| `exportedAt` | String | Gültiger ISO-8601-Zeitpunkt. |
| `producer` | Objekt | Enthält mindestens `app` und `lineage`. |
| `data` | Objekt | Enthält die exportierten Bereiche. |

## Defensive Importregeln für Atlas Python

Atlas Python soll:

1. JSON-Größe, Verschachtelungstiefe und Elementzahlen begrenzen.
2. Nur ein Top-Level-Objekt akzeptieren.
3. `format` und `schemaVersion` vor dem Lesen fachlicher Daten prüfen.
4. unbekannte Hauptversionen ablehnen, statt sie bestmöglich zu erraten.
5. unbekannte Felder ignorieren oder isoliert in `extensions` halten.
6. Typen, IDs, Referenzen, Zeitstempel und zulässige Statuswerte validieren.
7. keine HTML-, Markdown-, Mermaid- oder Chat-Inhalte ausführen.
8. keine URLs automatisch abrufen und keine externen Ressourcen laden.
9. keine Tokens, Secrets oder Sync-Konfiguration übernehmen.
10. zuerst einen Importbericht bzw. Dry-Run erzeugen.
11. bei Teilfehlern Datensätze quarantänisieren und Warnungen ausgeben.
12. standardmäßig nicht destruktiv importieren; Merge oder neues Zielprojekt
    sind dem Ersetzen vorzuziehen.
13. den Originalexport oder dessen Hash für Audit und Wiederholung referenzieren.

## Identität und Referenzen

- Jede exportierte Entität benötigt eine stabile String-ID.
- Referenzen wie `projectId`, `sourceChatId` oder `parentChatId` werden gegen die
  exportierte Entitätsmenge geprüft.
- Fehlende Referenzen dürfen den Gesamtimport nicht unkontrolliert abbrechen;
  sie werden gemeldet und der betroffene Datensatz wird isoliert oder ohne die
  ungültige Verknüpfung importiert.
- Tombstones bzw. Löschmarken werden nicht automatisch als Löschauftrag für
  Atlas Python interpretiert. Dafür ist ein eigener, expliziter Modus nötig.

## Inhaltliche Bereiche

### Projekte

Projektmetadaten, Fokus und nächster Schritt. Konfigurationsdaten für Gist,
Trello oder andere externe Dienste gehören nicht in diesen Bereich.

### Projektbausteine

Planbare oder erkannte Einheiten inklusive Status, Priorität,
Akzeptanzkriterien und optionalem Mermaid-Quelltext. Mermaid wird als Text
transportiert und niemals beim Import ausgeführt.

### Chats und Journal-Ereignisse

Hauptchat und Sprintchat bleiben typisiert. Handoffs können als
Journal-Ereignisse exportiert werden. Raw-Chat- und Raw-Handoff-Inhalte sollten
optional, gekennzeichnet und bei Bedarf separat exportierbar sein.

### Analysen

Analysen werden als untrusted content behandelt. Atlas Python entscheidet
explizit, welche strukturierten Befunde übernommen werden.

## Datenschutz und Secrets

Nicht exportieren:

- GitHub-, Gist-, Trello- oder API-Tokens,
- Passphrasen und abgeleitete Schlüssel,
- lokale Secret-Konfiguration,
- unabsichtlich erfasste private URLs,
- Browser- oder Dateisystempfade ohne fachliche Notwendigkeit.

Chat-URLs und Raw-Texte brauchen eine ausdrückliche Exportoption und eine
sichtbare Vorschau.

## Kompatibilitätsstrategie

1. Atlas HTML liest während der Migration bekannte Roadtrip-Exporte weiterhin.
2. Atlas HTML schreibt ein neues, eindeutig markiertes Atlas-Format.
3. Ein Legacy-Block darf nur dokumentierte, nicht geheime Quellinformationen
   enthalten.
4. Änderungen am Vertrag erhöhen `schemaVersion` und erhalten Test-Fixtures mit
   rein synthetischen Daten.
5. Atlas Python meldet Producer, Version, importierte Anzahl, übersprungene
   Datensätze und Warnungen.

## Offene Entscheidungen

- endgültige Entitätsnamen und Pflichtfelder,
- Behandlung großer Raw-Inhalte und Anhänge,
- Prüfsummen pro Bereich oder pro Datensatz,
- ZIP-Container zusätzlich zum kanonischen JSON,
- Regeln für bidirektionale IDs zwischen Atlas HTML und Atlas Python.
