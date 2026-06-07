# Sync-Safety-Notizen

## Status

Gist-Sync ist perspektivisch für Atlas HTML relevant. Er darf jedoch nicht
allein durch Umbenennen der vorhandenen Roadtrip-Funktionen übernommen oder als
produktionsreif betrachtet werden.

Die aktuelle `index.html` enthält bereits:

- GitHub-Gist-Pull und -Push,
- PBKDF2-SHA256 und AES-GCM für den Haupt-Gist,
- eine nur sitzungsweise merkbare Passphrase,
- Fingerprint-Vergleich,
- Merge nach Entitäts-ID und Zeitstempeln,
- Tombstones über `deletedIds`,
- Rücksetzen des Runtime-State bei einem Cloud-Schreibfehler,
- Legacy-Klartext-Erkennung,
- einen separaten Raw-Gist-Backup-Pfad.

Diese Mechanik ist eine wertvolle Grundlage, aber noch keine vollständige
Sync-Sicherheitsgarantie.

## Verbindliche Regeln für eine Atlas-Übernahme

1. **Backup vor Mutation:** Vor erstem Sync, erzwungenem Push, Migration eines
   Legacy-Gists oder Konfliktauflösung muss ein lokaler Export angeboten werden.
2. **Dry-Run:** Vor dem Schreiben werden lokale, entfernte und resultierende
   Counts sowie betroffene IDs angezeigt.
3. **Explizite Richtung:** Pull, Merge und Remote-Überschreiben dürfen nicht in
   einer mehrdeutigen Schaltfläche verborgen sein.
4. **Kein Last-write-wins ohne Nachweis:** Fehlende oder ungültige Zeitstempel
   führen zu einem Konflikt, nicht zu stiller Auswahl.
5. **Feldkonflikte sichtbar machen:** Gleiche ID mit unterschiedlichen
   inhaltlichen Änderungen braucht eine prüfbare Konfliktansicht.
6. **Tombstones vorsichtig behandeln:** Löschmarken benötigen Typ, Zeitpunkt,
   Ursprung und Aufbewahrungsfrist. Unbekannte Tombstones löschen nichts.
7. **Remote-Vorbedingungen:** Vor PATCH müssen Gist-Version, ETag oder ein
   vergleichbarer Remote-Fingerprint erneut geprüft werden.
8. **Atomarer lokaler Commit:** Ein Remote-Ergebnis wird erst nach vollständiger
   Validierung in den lokalen dauerhaften State übernommen.
9. **Rollback-Artefakt:** Der Zustand vor einem Sync bleibt als exportierbare
   Momentaufnahme verfügbar.
10. **Schema-Gate:** Nur bekannte, migrierbare Formatversionen werden gemergt.
11. **Secrets getrennt halten:** Tokens und Passphrasen gehören weder in
    Exporte noch in Logs, Fehlermeldungen oder den synchronisierten State.
12. **Least privilege:** GitHub-Tokens sollen nur die minimal nötigen
    Berechtigungen besitzen.
13. **Keine privaten Defaults:** Repository und Testdaten enthalten keine
    Gist-IDs, Tokens, Passphrasen oder privaten Chat-URLs.
14. **Untrusted remote:** Entschlüsselter Gist-Inhalt bleibt fremder Input und
    wird vor Merge vollständig validiert.
15. **Audit:** Sync-Zeitpunkt, Richtung, Format, Ergebnis, Warnungen und
    betroffene Entitäten werden ohne Secrets protokolliert.

## Bekannte Risiken der aktuellen Grundlage

- Der explizite Push überschreibt den Remote-Gist vollständig.
- Zeitstempelbasierte Auswahl kann parallele Feldänderungen nicht zuverlässig
  zusammenführen.
- Ein JSON-Fingerprint ist nur lokal gemerkt und kein serverseitiger
  Konkurrenzschutz.
- Der Raw-Gist-Backup-Pfad überträgt Notizen und Analysen unverschlüsselt und
  ist daher für private Daten nicht freizugeben.
- Konfiguration speichert Gist- und Trello-Tokens derzeit lokal im Browser.
- Die Legacy-Klartext-Migration kann sensible Altdaten betreffen.
- Remote-Inhalte können sehr groß, beschädigt oder absichtlich problematisch
  sein; Größenlimits fehlen als dokumentierter Vertrag.
- Externe CDN-Abhängigkeiten und GitHub-Verfügbarkeit beeinflussen Backup- und
  Sync-Abläufe.

## Mindesttests vor Freigabe

- erster Sync: lokal leer, remote befüllt,
- erster Sync: lokal befüllt, remote leer,
- identische Zustände,
- parallele Änderungen an verschiedenen Entitäten,
- parallele Änderungen derselben Entität und desselben Feldes,
- Löschung gegen Änderung,
- ungültige oder fehlende Zeitstempel,
- falsche Passphrase und beschädigtes Ciphertext-Envelope,
- unbekannte Schema- oder Verschlüsselungsversion,
- Netzwerkabbruch vor und während des Remote-Schreibens,
- Remote-Änderung zwischen Lesen und Schreiben,
- Quota-Fehler beim lokalen Persistieren,
- sehr große und tief verschachtelte Payloads,
- Nachweis, dass Exporte und Logs keine Secrets enthalten.

Alle Tests verwenden ausschließlich synthetische Daten.

## Vorläufige Entscheidung

Die vorhandene Gist-Implementierung bleibt in der Roadtrip-Basis erhalten. Eine
Atlas-Benennung oder produktive Empfehlung erfolgt erst, wenn die Regeln oben
implementiert, überprüft und mit einem Recovery-Ablauf dokumentiert sind. Ein
Sync-Rewrite ist nicht Bestandteil der aktuellen Repository-Vorbereitung.
