# Terminologie-Mapping

Dieses Mapping beschreibt die fachliche Übersetzung von Roadtrip zu Atlas HTML.
Es ist zunächst eine UI- und Konzeptzuordnung, kein Auftrag zur sofortigen
Umbenennung interner Felder oder Storage-Keys.

| Roadtrip | Atlas HTML | Übergangsregel |
| --- | --- | --- |
| Roadtrip | Atlas HTML | Roadtrip bleibt als Herkunfts- und Legacy-Begriff erhalten. |
| Feature | Projektbaustein | Interne Felder wie `features` dürfen zunächst bestehen bleiben. |
| Sprint | Arbeitsphase / Sprint | `Sprint` bleibt dort zulässig, wo der iterative Chat-Workflow gemeint ist. |
| Codeanalyse | Materialanalyse / Gegenstands-Abgleich | Nicht nur Quellcode, sondern der jeweils untersuchte Gegenstand ist relevant. |
| Developer Diary | Projektjournal / Projekttagebuch | Journal-Ereignisse sollen chronologisch und nachvollziehbar bleiben. |
| Wiki | Projektdossier | Das Dossier bündelt kuratierte Projektinformationen. |
| FeatureFlow | Projektbaustein-/Workflow-Flow mit Mermaid | Bestehendes `featureFlow` kann vorerst als Legacy-Feld weitergeführt werden. |
| Hauptchat / `project-main` | Hauptchat | Rolle und Grundworkflow bleiben erhalten. |
| Sprintchat / `sprint` | Sprintchat / Arbeitsphasen-Chat | Rolle bleibt erhalten; UI kann beide Begriffe erklären. |
| Handoff | Handoff / Journal-Ereignis | Handoff bleibt technischer Begriff und wird zusätzlich im Journal sichtbar. |
| Notes / Raw Notes | Notizen / Rohnotizen | Spätere fachliche Einordnung erfolgt kontrolliert. |
| Analysis | Analyseartefakt | Kontext entscheidet zwischen Materialanalyse und Gegenstands-Abgleich. |
| Project | Projekt | Direkte Übernahme. |

## Benennungsregeln

1. Nutzerseitige Atlas-Texte sollen bevorzugt die Atlas-Begriffe verwenden.
2. Bestehende JSON-Felder, IDs, Konstanten und Storage-Keys werden nicht allein
   aus kosmetischen Gründen geändert.
3. Eine interne Umbenennung benötigt eine Lesemigration, einen Schreibpfad und
   Tests mit anonymisierten Legacy-Daten.
4. Exportverträge dürfen stabile technische Namen nutzen, müssen deren
   fachliche Bedeutung aber dokumentieren.
5. Hauptchat und Sprintchat werden nicht zu einem generischen Chatmodell
   eingeebnet; ihre Rollen bleiben unterscheidbar.

## Fachliche Abgrenzungen

### Projektbaustein

Ein Projektbaustein ist eine planbare, prüfbare oder bereits erkannte Einheit
innerhalb eines Projekts. Die Roadtrip-Unterscheidung zwischen `planned` und
`implemented` bleibt zunächst technisch bestehen.

### Arbeitsphase / Sprint

Arbeitsphase ist der allgemeine Atlas-Begriff. Sprint bezeichnet weiterhin den
konkreten, zeitlich oder inhaltlich begrenzten Ausführungszyklus mit Start- und
Abschluss-Handoff.

### Materialanalyse / Gegenstands-Abgleich

Materialanalyse untersucht bereitgestellte Materialien. Gegenstands-Abgleich
vergleicht dokumentierten Projektstand und tatsächlichen Gegenstand. Die heutige
Codeanalyse ist ein Spezialfall davon, nicht das gesamte Zielbild.

### Projektjournal und Handoff

Das Projektjournal ist die chronologische Sicht. Ein Handoff ist ein
strukturiertes Ereignis darin, das Kontext zwischen Hauptchat, Sprintchat und
weiteren Arbeitsschritten überträgt. Raw-Handoff-Inhalte dürfen nicht
automatisch als vertrauenswürdige Fachdaten gelten.

### Projektdossier

Das Projektdossier ist die kuratierte, eher stabile Wissenssicht. Es ersetzt
nicht das ereignisorientierte Projektjournal.
