# Implementierungsplan

## Ausgangslage

`index.html` ist eine große, funktionsfähige Roadtrip-Single-File-Anwendung.
Diese Initialisierung ändert sie absichtlich nicht. Der Umbau zu Atlas HTML soll
in kleinen, überprüfbaren Sprints erfolgen.

## Phase 0: Repository vorbereiten

Status: abgeschlossen mit dieser Dokumentationsstufe.

- Atlas HTML als Repository- und App-Ziel benennen.
- Roadtrip als kontrollierte Fork-Herkunft dokumentieren.
- Architektur-, Terminologie-, Export- und Sync-Leitplanken festhalten.
- `.gitignore` für lokale Archive, Umgebungen, Logs und temporäre Dateien
  anlegen.
- keine privaten Daten oder echten Roadtrip-Exporte hinzufügen.

## Phase 1: Baseline und Schutznetz

- `index.html` mit synthetischen Daten in einem Browser-Smoke-Test öffnen.
- Kernabläufe erfassen: Laden, Speichern, Reload, JSON-Export/-Import,
  ZIP-Backup, selektiver Merge, Hauptchat, Sprintstart, Sprint-Handoff und
  Mermaid-Vorschau.
- anonymisierte Legacy-Fixtures für die unterstützten Roadtrip-Exportformen
  erstellen.
- vor Refactoring Dateigröße, Storage-Keys, State-Shape und Exportformate
  dokumentieren.
- prüfen, ob alle externen CDN-Abhängigkeiten im Offline-Fall kontrolliert
  degradieren.

Abnahme: Die wichtigsten Bestandsfunktionen sind reproduzierbar testbar.

## Phase 2: Sichtbare Atlas-Identität

- Dokumenttitel, App-Name und sichtbare Roadtrip-Texte gezielt auf Atlas HTML
  umstellen.
- eine kleine, zentrale Benennungsschicht für App-Name und Exportlabels
  erwägen, sofern sie echte Duplikation reduziert.
- Herkunftshinweis und Legacy-Kompatibilität in Settings oder Info-Bereich
  sichtbar machen.
- keine Storage-Keys, Datenfelder oder Exportformate in diesem Schritt ändern.

Abnahme: Die App tritt als Atlas HTML auf, bestehende lokale Roadtrip-Daten
laden weiterhin.

## Phase 3: Fachbegriffe in der Oberfläche

- Feature schrittweise als Projektbaustein anzeigen.
- Sprint dort als Arbeitsphase ergänzen, wo der allgemeinere Begriff passt.
- Codeanalyse als Materialanalyse / Gegenstands-Abgleich einordnen.
- Developer Diary als Projektjournal / Projekttagebuch und Wiki als
  Projektdossier abbilden, sobald die entsprechenden Oberflächen eindeutig
  identifiziert sind.
- FeatureFlow als Projektbaustein-/Workflow-Flow mit Mermaid anzeigen.
- Hauptchat, Sprintchat und Handoff erhalten.

Abnahme: Terminologie ist konsistent, interne Legacy-Felder bleiben lesbar.

## Phase 4: Kompatibilitätsschicht

- Roadtrip-Storage-Keys weiterhin lesen.
- Atlas-Keys erst mit erfolgreicher, idempotenter Migration schreiben.
- Migration niemals die einzige Kopie löschen lassen.
- Importer für bekannte Roadtrip-Hüllen mit klarer Formaterkennung kapseln.
- unbekannte Felder erhalten oder kontrolliert ignorieren; keine stillen
  destruktiven Normalisierungen.

Abnahme: Reload und Rollback funktionieren mit anonymisierten Legacy-Daten.

## Phase 5: Atlas-Export für Atlas Python

- den Entwurf aus `export-contract-draft.md` präzisieren.
- kanonischen Atlas-HTML-Export additiv implementieren.
- Secrets, Sync-Konfiguration und private URLs standardmäßig ausschließen.
- Exportvorschau, Counts und Warnungen anzeigen.
- Schema-Fixtures und einen defensiven Atlas-Python-Importer-Test abstimmen.
- Roadtrip-Backup-Exporte zunächst als Recovery-Pfad beibehalten.

Abnahme: Atlas Python kann gültige Exporte lesen und ungültige sicher
zurückweisen oder quarantänisieren.

## Phase 6: Journal und Dossier

- bestehende Handoff-Historie als Journal-Ereignisse sichtbar machen.
- Hauptchat- und Sprintchat-Verknüpfungen erhalten.
- Projektjournal und Projektdossier fachlich trennen.
- Raw-Handoff-Daten nur kontrolliert und optional anzeigen/exportieren.

Abnahme: Ereignisverlauf und kuratierter Projektstand sind nachvollziehbar,
ohne bestehende Chatdaten zu verlieren.

## Phase 7: Materialanalyse

- erst nach Stabilisierung von Begriffen und Exportvertrag planen.
- bestehende Codeanalyse als Legacy-Spezialfall kapseln.
- keine Analyseergebnisse automatisch als vertrauenswürdige Änderungen
  übernehmen.
- Review-, Deduplizierungs- und Herkunftsinformationen beibehalten.

Abnahme: Analyse ist reviewbar, defensiv und nicht auf Quellcode beschränkt.

## Phase 8: Sync härten

- Regeln aus `sync-safety-notes.md` umsetzen.
- Raw-Gist-Backup für private Daten deaktiviert lassen, bis Verschlüsselung und
  Preview geklärt sind.
- Konfliktvorschau, Remote-Vorbedingungen, Rollback und Audit ergänzen.
- erst danach Atlas-Namen und Atlas-Formate im Sync aktivieren.

Abnahme: dokumentierte Konflikttests, Recovery-Test und Secret-Prüfung sind
erfolgreich.

## Reihenfolge für den nächsten Codex-Sprint

1. Baseline-Smoke-Test und synthetisches Testfixture anlegen.
2. sichtbare App-Identität auf Atlas HTML umstellen.
3. Roadtrip-Kompatibilitätskonstanten unverändert lassen.
4. die wichtigsten sichtbaren Begriffe anhand des Terminologie-Mappings
   ersetzen.
5. Persistenz, Export/Import, Hauptchat, Sprintchat und Handoff erneut prüfen.

## Nicht nebenbei erledigen

- kein neues Framework oder Build-System,
- keine Aufteilung der ausgelieferten Single-File-App,
- kein neues Datenmodell,
- keine große Designüberarbeitung,
- keine Entfernung scheinbar ungenutzter Roadtrip-Funktionen ohne Nachweis,
- keine produktiven Secrets oder realen Nutzerdaten,
- kein Sync-Rewrite.
