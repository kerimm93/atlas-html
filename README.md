# Atlas HTML

**Atlas HTML** ist eine lokal ausführbare Single-File-Web-App für strukturierte Denk-, Schreib-, Lern-, Reflexions- und Projektarbeit.

Die App basiert auf einem kontrollierten Fork von Roadtrip, übernimmt dessen robuste Grundarchitektur für lokale Persistenz, Projekte, Chats, Handoffs, Journal, Import/Export und Backups, richtet diese Mechaniken aber auf eine andere Nutzungsweise aus:

**Atlas HTML ist kein Coding-Sprint-Tracker.**
Es ist ein lokaler Projektatlas für schriftliches Denken, Materialarbeit, Journaling, Recherche, Reflexion und die Produktion von Texten.

---

## Wofür Atlas HTML gedacht ist

Atlas HTML hilft dabei, Projekte nicht nur als Aufgabenlisten zu verwalten, sondern als Denk- und Arbeitsräume.

Typische Projekte können sein:

* Essays, Fachtexte und Sachtexte
* Prosa, Szenen, Figurenarbeit und literarische Entwürfe
* Lernprojekte und Unterrichtsnotizen
* Recherche- und Reflexionsprojekte
* Konzeptpapiere, Design-Briefings und Projektpläne
* KI-gestützte Arbeitsprozesse mit ChatGPT, Claude, Codex oder Deep Research

Atlas fragt nicht primär:

> Was ist erledigt?

Sondern eher:

> Woran denke, schreibe, lerne oder forsche ich gerade?
> Welche Materialien gehören dazu?
> Welche Fragen sind offen?
> Welcher nächste Denkschritt oder Textschritt ist sinnvoll?

---

## Aktueller Stand

Atlas HTML ist aktuell eine lokal-first Single-File-App mit:

* Projektverwaltung
* Projektbausteinen
* Notizen
* Material-/Dokumentschicht
* Projektjournal
* Momentum-Ansicht
* Hauptchat-/Sprintchat-/Handoff-Grundmechaniken
* Import- und Analysebereich
* JSON-Export und JSON-Import
* ZIP-/Rohdaten-Backup
* GitHub-Gist-Sync-Grundmechanik aus Roadtrip
* Atlas-eigenen Browser-Storage-Namespaces
* überarbeiteter Sidebar-Navigation im Atlas-Stil

Die App läuft ohne Backend, ohne Build-Step und ohne Framework.

---

## Zentrale Konzepte

### Projekte

Ein Projekt ist ein Denk-, Schreib-, Lern- oder Arbeitsraum.

Ein Projekt kann zum Beispiel ein Essay, eine Kurzgeschichte, ein Lernvorhaben, ein Rechercheprojekt oder eine allgemeine Arbeitsidee sein.

Projekte enthalten unter anderem:

* Titel
* Typ
* Status
* Summary
* aktuellen Fokus
* nächsten Schritt
* Projektbausteine
* Notizen
* Materialien
* Projektjournal-/Chat-Kontext

---

### Projektbausteine

Projektbausteine sind die verallgemeinerte Form der Roadtrip-Features.

In Roadtrip sind Features meist Softwarefunktionen.
In Atlas können Projektbausteine viel allgemeiner sein:

* Kapitel
* Szenen
* Figuren
* Argumente
* Thesen
* Recherchefragen
* Lernschritte
* offene Denkprobleme
* Workflow-Schritte
* zu entwickelnde Textabschnitte
* KI-/Handoff-Prozesse

Projektbausteine können geplant, in Arbeit, blockiert, zurückgestellt oder umgesetzt sein.

---

### Materialien

Die Materialschicht ist der wichtigste Atlas-spezifische Ausbau.

Materialien sind projektbezogene Texte oder Dokumente, zum Beispiel:

* Markdown-Drafts
* Essay-Abschnitte
* Szenennotizen
* Figurennotizen
* Recherchematerial
* Unterrichtsmitschriften
* Projektberichte
* Chat-Handoffs
* Deep-Research-Ergebnisse
* Codex-Berichte
* Claude-Design-Briefings

Materialien können angelegt, bearbeitet, gelesen, archiviert, reaktiviert, gefiltert und als Prompt-Kontext kopiert werden.

Aktuell unterstützt die Materialschicht:

* persistentes `S.materials`
* projektbezogene Materialien
* Materialtypen
* Materialstatus
* Markdown-/Textinhalt
* lokaler `.md`-/`.txt`-Import
* Filter nach Projekt, Typ, Status und Suche
* Prompt-Kontext-Erzeugung aus ausgewählten Materialien
* JSON-Export und selektiven JSON-Import
* ZIP-Backup mit `materials.json`
* Restore mit optionalem `materials.json`
* Gist-/Sync-relevante Fingerprints inklusive Materialien

---

### Notizen

Notizen sind schnelle, kleinere Projektgedanken.

Sie eignen sich für:

* offene Fragen
* Entscheidungen
* Ideen
* Beobachtungen
* kleine Rohnotizen
* spätere Verarbeitung zu Projektbausteinen oder Materialien

---

### Projektjournal

Das Projektjournal sammelt Chat-, Sprint-, Handoff- und Arbeitsverlauf.

Es ist nicht nur ein technisches Log, sondern soll langfristig als Reflexions- und Entwicklungsgeschichte eines Projekts dienen.

---

### Momentum

Die Momentum-Ansicht zeigt aktuelle Projektbewegung:

* aktive Projekte
* offene Schritte
* Denk-Threads
* aktuelle Fokusbereiche

Sie soll helfen, wieder in ein Projekt einzusteigen, ohne den gesamten Kontext neu suchen zu müssen.

---

## UI-Richtung

Atlas HTML wird schrittweise von einer Roadtrip-artigen Projektoberfläche zu einem ruhigeren Schreib-, Denk- und Materialraum umgestaltet.

Der aktuelle UI-Stand enthält bereits:

* schmalere Sidebar über `--sidebar-w`
* vertikale Navigation mit Icons
* Atlas-spezifischere Navigationsgruppen
* ruhigere Projektliste
* aktive Navigation mit Akzentindikator
* E-Ink-kompatible Darstellung
* reduzierte globale Stats im leeren Zustand

Die weitere UI-Richtung ist:

* weniger Dashboard-Gefühl
* mehr Schreib- und Denkraum
* bessere Material-/Dokumentansicht
* Schreibfokus-Ansicht
* Projekt-Cockpit mit klareren Bereichen
* Projektjournal als Timeline
* KI-/Handoff-Bereich als Rückführung in das Projektgedächtnis

---

## Technischer Rahmen

Atlas HTML ist bewusst einfach gehalten:

* Single-File-App
* Vanilla HTML/CSS/JavaScript
* kein Framework
* kein Build-Step
* kein Backend
* lokal-first
* Browser-Persistenz über IndexedDB mit Fallbacks
* JSON-Export/Import
* ZIP-/Rohdaten-Backup
* perspektivisch GitHub-Gist-Sync

Die App soll weiterhin direkt lokal oder über GitHub Pages ausführbar bleiben.

---

## Lokale Speicherung

Atlas HTML verwendet eigene Browser-Namespaces, damit keine Kollision mit Roadtrip-Daten entsteht.

Wichtige lokale Namespaces:

```js
atlas_html_v0_1
atlas_html_v0_1_config
atlas_html_v0_1_storage_meta
atlas_html_db_v1
atlas_html.ui.showCompletedSprintsByProject
atlas_html.ui.projectMomentumCollapsedByProject
```

Roadtrip-interne Namen können im Code weiterhin vorkommen, wenn sie bewusst geerbte Mechaniken, Handoff-Verträge oder Kompatibilität markieren. Sie sollen nicht blind entfernt werden.

Wichtig ist die Unterscheidung:

* gefährliche Roadtrip-Persistenzkeys: müssen vermieden werden
* bewusst geerbte Roadtrip-Verträge: dürfen bleiben
* sichtbare Roadtrip-Sprache in der UI: soll schrittweise durch Atlas-Begriffe ersetzt werden
* kosmetische Funktionsnamen: später auditierbar, aber nicht dringend

---

## Import, Export und Backup

Atlas HTML unterstützt mehrere Datenwege:

### JSON-Export

Exportiert den lokalen App-State als JSON.

### JSON-Import

Importiert ausgewählte oder vollständige Atlas-/Roadtrip-kompatible Daten.

### Rohdaten-/ZIP-Backup

Sichert App-Daten in strukturierter Form. Materialien werden dabei als `materials.json` berücksichtigt.

### Gist-Sync

Die Gist-Sync-Grundmechanik stammt aus Roadtrip und bleibt vorerst kompatibel.
Materialien wurden in relevante Fingerprints, Merge-Pfade und User-Data-Erkennung einbezogen.

---

## KI-Workflow

Atlas HTML ist prompt-first gedacht.

Die App soll KI nicht direkt verstecken oder automatisieren, sondern strukturierte Übergänge ermöglichen:

1. Projektkontext sammeln
2. Materialien auswählen
3. Prompt-Kontext erzeugen
4. ChatGPT, Claude, Codex oder Deep Research nutzen
5. Ergebnisse als Material, Notiz, Projektbaustein oder Journal-Eintrag zurückführen

Aktuell können Materialien bereits als Prompt-Kontext kopiert werden.

Geplante nächste Ausbaustufe:

* JSON-Handoff für Materialien
* direkte Rückführung von Codex-/Claude-/Deep-Research-Ergebnissen als Projektdokumente
* stärkere Einbindung von Materialien in Sprintstart-, Hauptchat- und Projektprompts

---

## Aktueller Redesign-Stand

Es existiert ein Claude-Design-Prototyp mit 10 navigierbaren Screens:

* Karte
* Schreibfokus
* Material
* Projekt-Cockpit
* Momentum
* Notizen
* Projektbausteine
* Projektjournal
* Import & Analyse
* Einstellungen

Der Prototyp ist ein Design-Artefakt und nicht die produktive App.

Die produktive App bleibt Vanilla JS / Single File. React-, Babel- oder JSX-Strukturen aus dem Prototyp werden nicht direkt übernommen.

Der erste Redesign-Umsetzungsschritt wurde bereits umgesetzt:

* Sidebar-Breite über `--sidebar-w`
* vertikale Navigation
* Inline-SVG-Icons
* ruhigere Sidebar-Projektliste
* kein neuer View
* keine Datenmodelländerung
* keine Storage-/Sync-/Export-/Import-Änderung

---

## Roadmap

### Kurzfristig

* Materialschicht mit echten Projektdaten testen
* UI-Shell weiter prüfen und ggf. nachjustieren
* Schreibfokus als eigener View
* Materialansicht als zweispaltige Dokumentarbeitsfläche
* Material-Handoff-JSON für KI-Ergebnisse

### Mittelfristig

* Projekt-Cockpit mit Tabs
* Projektjournal als Timeline
* bessere Dokumentansichten: Lesen, Tabelle, Kanban
* Materialien in Sprint-/Projekt-/Hauptchat-Prompts einbinden
* Größenwarnungen und Langtext-Strategie für große Materialien
* Legacy-Naming-Audit für Roadtrip-Begriffe

### Später

* stabilerer Gist-Sync nach Sync-Safety-Regeln
* optionaler Atlas-Exportvertrag für Python-/Desktop-Atlas
* mögliche Obsidian-/Vault-Integration
* optionale Trello-Sync-Strategie für Materialien oder Projektbausteine
* stärkeres Projektgedächtnis für langfristige Denk- und Schreibprozesse

---

## Nutzung

### Lokal öffnen

Die App kann direkt im Browser geöffnet werden:

```bash
open index.html
```

Oder über einen lokalen Server:

```bash
python3 -m http.server 8000
```

Dann im Browser öffnen:

```text
http://localhost:8000
```

### GitHub Pages

Atlas HTML kann als statische Seite über GitHub Pages veröffentlicht werden.

Wichtig: Browserdaten bleiben lokal im jeweiligen Browser.
GitHub Pages stellt nur die App-Datei bereit, nicht automatisch die persönlichen Projektdaten.

---

## Entwicklung

Bei Codeänderungen gelten folgende Regeln:

* minimal-invasive Änderungen
* keine Framework-Einführung
* keine neue Build-Pipeline
* keine Datenmodelländerung ohne Import-/Export-/Backup-Prüfung
* keine Änderung an Storage-Keys ohne ausdrückliche Migrationsentscheidung
* Roadtrip-Verträge nicht blind umbenennen
* neue State-Felder defensiv normalisieren
* Export, Import, Backup, Restore und Sync-Fingerprint mitprüfen
* nach JS-Änderungen Syntaxcheck durchführen

Empfohlene Validierung:

```bash
node --check /tmp/atlas-html-script.js
git diff --check
```

Zusätzlich sollte ein manueller Browser-Smoke-Test erfolgen:

1. App öffnen
2. Console auf Fehler prüfen
3. Navigation durchklicken
4. Projekt anlegen oder Demo-Daten laden
5. Material anlegen/bearbeiten
6. Reload prüfen
7. Export prüfen
8. Import/Restore prüfen
9. E-Ink-/Theme-Darstellung prüfen
10. Mobile Sidebar prüfen

---

## Projektstatus

Atlas HTML ist aktuell in einer frühen, aber bereits nutzbaren Phase.

Der wichtigste Fortschritt ist die Materialschicht:
Atlas kann jetzt nicht nur Projekte und Bausteine verwalten, sondern echte Projektmaterialien tragen.

Damit beginnt die eigentliche Atlas-Richtung:

**ein lokaler Projektatlas für Denken, Schreiben, Lernen, Reflexion und KI-gestützte Materialarbeit.**
