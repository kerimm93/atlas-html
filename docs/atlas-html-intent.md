# Atlas HTML: Intent

## Einordnung

Atlas HTML ist ein kontrollierter Roadtrip-Fork. Die vorhandene Roadtrip-
`index.html` ist die technische Ausgangsbasis und soll nicht durch eine neu
entwickelte App ersetzt werden. Die Migration erfolgt nachvollziehbar,
inkrementell und mit Rücksicht auf bestehende lokale Daten.

Der Name der Anwendung und des Repository-Konzepts lautet **Atlas HTML**.
Roadtrip bleibt als Herkunfts- und Kompatibilitätsbegriff sichtbar, solange
interne Verträge oder Bestandsdaten davon abhängen.

## Zweck

Atlas HTML soll später projektbezogene Materialien, Projektbausteine,
Arbeitsphasen, Chats, Handoffs, Journal-Ereignisse und Dossier-Inhalte in einer
lokalen Single-File-Anwendung zusammenführen. Die erste Ausbaustufe schafft
dafür nur die konzeptionelle und dokumentarische Grundlage.

Noch nicht Teil dieser Stufe sind ein neues Datenmodell, eine ausgebaute
Materialanalyse, ein Sync-Rewrite oder eine umfassende fachliche Transformation
der Oberfläche.

## Bewusst übernommene Roadtrip-Grundarchitektur

Folgende Eigenschaften werden als wertvolle Grundlage behandelt:

1. Eine direkt nutzbare `index.html` mit HTML, CSS und JavaScript in einer Datei.
2. Lokale Persistenz mit IndexedDB und `localStorage`-Fallback.
3. Export, Import, selektiver Merge, Notfall-Export und ZIP-Backup.
4. Projekte, Features, Notizen, Analysen, Chats und Importhistorie als bestehende
   Arbeitsstruktur.
5. Hauptchat und Sprintchat als unterschiedliche Kontextrollen.
6. Handoffs für Sprintstart, Sprintabschluss und Rückführung in den Hauptchat.
7. Mermaid-basierte Flow-Skizzen.
8. Eine vorhandene Sync-Grundstruktur mit Tombstones, Zeitstempeln und
   verschlüsseltem Gist-Payload.

Diese Übernahme ist keine Aussage, dass jede Roadtrip-Funktion unverändert zum
Atlas-Zielbild passt. Sie bedeutet, dass Änderungen kontrolliert und mit
Migration statt durch Löschung erfolgen.

## Migrationsprinzipien

- **Erhalten vor Umbenennen:** Zuerst Verhalten und Datenverträge erfassen,
  danach UI-Texte und interne Namen migrieren.
- **Kompatibilität vor Bereinigung:** Bestehende Roadtrip-Keys und Formate dürfen
  während einer Übergangsphase weiter lesbar bleiben.
- **Additiv vor destruktiv:** Neue Atlas-Felder und Formatversionen zunächst
  ergänzen; alte Felder erst nach dokumentierter Migration entfernen.
- **Defensive Grenzen:** Importe, Sync und Handoffs validieren fremde Daten vor
  jeder Zustandsänderung.
- **Keine privaten Artefakte:** Dokumentation und Tests verwenden ausschließlich
  synthetische, anonymisierte Daten.
- **Single File bleibt Produktmerkmal:** Eine spätere Modularisierung der
  Entwicklung darf die distributierbare Single-File-Struktur nicht ohne
  ausdrückliche Entscheidung aufheben.

## Nicht-Ziele dieser Vorbereitung

- keine große Änderung an `index.html`,
- keine Entfernung vorhandener Roadtrip-Fachlogik,
- kein neues Atlas-Datenmodell,
- keine Materialanalyse-Implementierung,
- kein Gist- oder Trello-Sync-Rewrite,
- keine echten Nutzer-, Chat- oder Exportdaten.

## Erfolgskriterium

Der nächste Codex-Sprint kann die `index.html` gezielt von Roadtrip zu Atlas HTML
transformieren, ohne zuerst Herkunft, Begriffe, Exportgrenzen oder Sync-Risiken
neu klären zu müssen.
