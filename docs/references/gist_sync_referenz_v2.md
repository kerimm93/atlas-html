# Gist-Sync Referenzsystem v2
*Single-File-Apps — Persistenz, Sync, Recovery*
*Stand: Juni 2026 — aktualisiert gegenüber v1 (März 2026)*

---

## Kurzkontext (für KI-Übergaben)

- App ist Single-File-HTML-/Vanilla-JS-App
- **Lokal-first:** IndexedDB-primär mit localStorage-Fallback
- Gist als Cloud-Spiegel (nicht Wahrheitsquelle)
- Konfliktbewusster bidirektionaler Sync
- Tombstone-Löschschutz
- Keine Frameworks, kein Rewrite

---

## 1. Grundprinzipien

1. **Lokale Daten sind zuerst real.** Der Gist ist Transport- und Abgleichsschicht.
2. **Kein stiller Datenverlust.** Konflikte → Konflikt-Modal, nicht blind Last-Write-Wins.
3. **Löschungen brauchen Tombstones.** Hartes Entfernen erzeugt Resurrection-Bugs.
4. **No-Op ist wirklich No-Op.** Wenn lokal = remote: kein Push, keine Anzeige.
5. **Persistenz und Sync sind getrennte Pfade.** `save()` triggert nie blind Sync.
6. **Destruktive Pull-/Import-Aktionen haben Confirm-Gates.**
7. **PWA/Service-Worker ist Auslieferungsschicht, nicht Datenlogik.**

---

## 2. Persistenzschichten (Modell ab Mai 2026)

```
UI ändert State
    ↓
save() — Persistenzschicht entscheidet
    ↓
┌──────────────────────────────────────────┐
│  IndexedDB (primär)        ← S / State   │  ab ~2–3 MB oder wachsendem Dataset
│  localStorage (Fallback)   ← C / Flags   │  Config, kleine Apps, UI-State
│  JSON-Export               ← Recovery    │
│  ZIP-Backup                ← Recovery    │
│  Raw-Backup-Gist           ← Recovery    │  Rohkarten / App-spezifisch
│  Gist                      ← Sync        │
└──────────────────────────────────────────┘
```

### State vs. Config trennen

- `S` (State): Projekte, Features, Einträge, Chats, Analysen, Tombstones → **IndexedDB**
- `C` (Config): Gist-Token/-ID, Theme, UI-Settings → **localStorage** (klein, unkritisch)
- Exporte enthalten State, **nicht** Config.
- UI-State (Toggle-Zustände etc.) → eigener Namespace `appname.ui.*` in localStorage (nicht in S)

### UI-State-Namespace-Pattern

```javascript
// UI-State NICHT in S, sondern eigener Namespace:
localStorage.setItem('roadtrip.ui.momentumCollapsed.proj123', 'true');
localStorage.getItem('roadtrip.ui.view');
```

---

## 3. Zustandsmodell

### Basis-Schema

```javascript
var S = {
  items: [],
  deletedIds: {},    // Tombstones — PFLICHT
  config: { name: '', context: '' },
  _lastExported: ''  // Freshness-Marker für Gist-Abgleich
};
```

### Pflichtfelder für syncbare Objekte

- `id` — Objektidentität
- `createdAt` — Erstvergleich
- `updatedAt` — wichtigstes Freshness-Signal pro Objekt
- Optional: `lastEditedByDeviceId`, `lastEditedByDeviceName`

### `_lastExported`

Ist **kein Inhaltsfeld**, sondern Freshness-Marker des zuletzt erfolgreich festgeschriebenen Gist-Stands. Für Inhaltsvergleiche neutralisieren. Push und Payload müssen **denselben Sync-Zeitstempel** benutzen (kein Drift).

---

## 4. Persistenz-Schichten im Code

### `save()` vs. `persistLocalOnly()`

- `save()` — normaler Anwendungspfad: persistieren + ggf. Auto-Sync triggern
- `persistLocalOnly()` — lokaler Sicherungspfad **ohne Sync-Nebenwirkungen** (z.B. während laufendem Sync)

### `_syncInProgress`-Guard (PFLICHT)

```javascript
var _syncInProgress = false;

function gistSync() {
  if (_syncInProgress) return;
  _syncInProgress = true;
  try {
    // ... Sync-Logik ...
  } finally {
    _syncInProgress = false;
  }
}

function save() {
  // lokal persistieren ...
  if (!_syncInProgress) {
    gistAutoSyncDebounced();  // 30s Debounce
  }
}
```

### Debounced Save

```javascript
var _saveTimer = null;
function saveDebounced(delay) {
  delay = delay || 600;
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(function() { save(); }, delay);
}
// Ausnahme: vor Gist-Sync, vor Export → save() direkt
```

### IndexedDB mit Write-Queue (Race-Condition-Schutz)

```javascript
var _dbWriteQueue = Promise.resolve();
function idbSet(key, value) {
  _dbWriteQueue = _dbWriteQueue.then(function() {
    return new Promise(function(resolve, reject) {
      var tx  = db.transaction(STORE_NAME, 'readwrite');
      var req = tx.objectStore(STORE_NAME).put(value, key);
      req.onsuccess = function() { resolve(); };
      req.onerror   = function(e) { reject(e.target.error); };
    });
  });
  return _dbWriteQueue;
}
```

---

## 5. Sync-Entscheidungslogik

Vor jedem Sync — genau diese Reihenfolge:

1. Ist Sync erlaubt? (Token + ID vorhanden, nicht disabled)
2. Ist bereits ein Sync aktiv? (`_syncInProgress`)
3. Ist lokal leer? → Pull statt Push
4. Ist remote leer? → Push
5. Sind Zeitstempel identisch? → **No-Op** (kein Push!)
6. Gibt es echte Inhaltsunterschiede? (nach `_lastExported`-Neutralisierung)
7. Gibt es Konflikte für dieselben IDs?
8. Muss gemergt werden?
9. Muss nur gepusht werden?
10. Muss nur gepullt werden?
11. Ist das Ergebnis inhaltlich identisch zu remote? → kein Push
12. Muss der gemeinsame Stand zurückgeschrieben werden?

Das System steht oder fällt mit dieser Entscheidungslogik.

---

## 6. Tombstones

```javascript
// Niemals hart löschen — immer Tombstone:
function recordDeletion(id) {
  S.deletedIds[id] = new Date().toISOString();
  save();
}
function isDeleted(id) {
  return !!S.deletedIds[id];
}
// In load() aufrufen — 90-Tage-Fenster:
function pruneDeletedIds() {
  var cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
  Object.keys(S.deletedIds).forEach(function(id) {
    if (new Date(S.deletedIds[id]).getTime() < cutoff) delete S.deletedIds[id];
  });
}
```

---

## 7. Merge-Logik

### Merge-Prinzip

- ID-basiertes Merge für syncbare Objekte
- `updatedAt` als Freshness-Signal pro Objekt
- Bei gleichzeitiger Änderung beider Seiten → Konflikt-Modal
- Lokal ist vorausgewählt (konservativ)

### Konflikt-Modal

- Zeigt beide Versionen
- **Bulk-Vorauswahl** für viele Konflikte — dann Ausnahmen anpassen
- **Kein Auto-Commit** — Nutzer muss explizit bestätigen

### Merge-Entscheidungsregeln

```
Gleiche ID, lokal neuer     → lokal gewinnt (kein Konflikt)
Gleiche ID, remote neuer    → remote gewinnt (kein Konflikt)
Gleiche ID, beide geändert  → Konflikt-Modal
ID nur lokal                → lokal behalten
ID nur remote               → remote übernehmen
ID in deletedIds            → ignorieren (Tombstone schlägt)
```

---

## 8. Recovery-Kanäle

| Kanal | Verwendung |
|---|---|
| JSON-Export | Vollständiger State-Export, Klartext, kein Entschlüsseln nötig |
| ZIP-Backup | Strukturierter Recovery-Pfad |
| Raw-Backup-Gist | App-spezifisch (z.B. Rohkarten in Daily Log) |
| Notfall-Export | Direkt aus In-Memory `S` — funktioniert auch wenn Storage tot |
| Papierkorb | Weiche Löschung, vor finalem Purge |

**Selektiver Raw-Restore:** Beim Import nur Einträge übernehmen die lokal fehlen — Standard-Modus ist Merge, nicht Replace.

### Notfall-Export (PFLICHT)

```javascript
function emergencyExport() {
  var blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'emergency_export_' + Date.now() + '.json';
  a.click();
}
// IMMER aus In-Memory S — nie aus localStorage lesen
```

---

## 9. Gist als App-Integrations-Layer (Shared-Gist-Modell)

Mehrere Apps können denselben Gist mit klarer Datei-Ownership nutzen:

```
1. App-State (privat pro App)
   dailylog_v2_data.json          → nur Daily Log
   roadtrip_data.json             → nur Roadtrip

2. Shared Exchange Layer (gemeinsamer Gist)
   shared_inbox.json              → App-übergreifende Inbox
   shared_prompt_blocks.json      → Prompt-Bibliothek
   shared_question_sets.json      → Fragenkataloge

3. Import-/Merge-Regeln (pro App)
   Jede App entscheidet selbst was sie exportiert/importiert.
```

**Regeln:**
- Eindeutige Dateinamen pro App (kein Kollisionsrisiko)
- Klare Ownership: wer schreibt, wer liest
- Append-only + `processed: false/true`-Flags für Inbox-Dateien
- Read-mostly für Shared Libraries

---

## 10. Bekannte Grenzen (Daily Log Analyse, Juni 2026)

Diese Grenzen sind in der Daily-Log-Referenzimplementierung bekannt und noch nicht behoben:

- `gistPush()` führt keinen Remote-Preflight durch — kann zwischenzeitlich geänderten Gist blind überschreiben
- 30s Auto-Sync nach `save()` ist technisch ein Auto-**Push**, kein erneuter Zwei-Wege-Sync
- Kein ETag/Revision/Optimistic Concurrency
- `mergeById()` bevorzugt `createdAt` vor `updatedAt` bei manchen Objekttypen — kann zu veralteten Daten führen
- Vor Force-Pull, JSON-Overwrite und ZIP-Overwrite kein automatisches lokales Pre-Destruction-Backup

---

## 11. Anti-Patterns

Niemals:
- Tokens in `S` speichern
- Tokens im Gist speichern
- `save()` überall blind in Sync-Pfaden aufrufen
- `_lastExported` als Inhaltsunterschied behandeln
- Push nur davon abhängig machen, ob sich lokal etwas geändert hat
- Gelöschte IDs ohne Tombstones behandeln
- Remote leeren Zustand über aktiven lokalen Zustand kippen
- Konflikte still verschlucken
- Bulk-Auswahl automatisch bestätigen (kein Auto-Commit!)
- Cache-/PWA-Phänomene als Datenlogik missdiagnostizieren
- Emergency-Export aus localStorage statt aus In-Memory `S`

---

## 12. Implementierungs-Checkliste

- [ ] `S` und `C` sauber getrennt
- [ ] `save()` triggert nicht blind in Sync-Pfaden
- [ ] `_syncInProgress`-Guard vorhanden
- [ ] `gistPush()` / `gistPull()` mit gemeinsamem Sync-Timestamp
- [ ] Tombstones implementiert
- [ ] `pruneDeletedIds()` in `load()` aufgerufen
- [ ] Konflikt-Modal vorhanden
- [ ] Bulk-Vorauswahl im Konflikt-Modal
- [ ] No-Op-Test erfolgreich (lokal = remote → kein Push)
- [ ] Notfall-Export aus In-Memory `S`
- [ ] Service Worker stört Sync nicht
- [ ] `_dbWriteQueue` bei IndexedDB

---

## 13. Referenz-Implementierungen

| App | Stand | Persistenz |
|---|---|---|
| Daily Log | ✅ IndexedDB-first (Mai 2026) | IndexedDB + localStorage-Fallback |
| Roadtrip | 🔄 localStorage, Migration geplant | localStorage |
| FIAE-RPG | localStorage (`fi_rpg_v4`) | localStorage |

---

*Stand: Juni 2026 — aktualisiert mit: IndexedDB-Migration-SOP, Daily-Log-Sync-Analyse, Shared-Gist-Architektur, UI-State-Namespace-Pattern.*
*Vorgänger: daily_log_app_gist_sync_referenzsystem v1 (März 2026)*
