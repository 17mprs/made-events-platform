---
name: MADE EVENTS Platform — contesto progetto
description: Stack, IDs chiave, Web App URL, architettura frontend, endpoint backend mancanti, stato sprint
type: project
---

**Stack:** Google Apps Script (backend) + Google Sheets (DB) + Google Drive (storage) + React/Vite (frontend)

**Brand:** `MADE EVENTS` (aggiornato da "Made Event" — Sprint 12, 2026-03-24)

## IDs e URL

- GAS Script ID: `1ZxNug_6h51Mx-mS_o9Sv33zWaP-Q0i-bPsCpiE15DM0ghqmrmohsAp9G`
- Google Sheet ID: `12ITb5K_ZcskSFgLmpdWXvqqP2oh5cJ51KKhPq2PhlHQ`
- **Web App URL (ATTIVO):** `https://script.google.com/macros/s/AKfycbzLF8ib1CuN1mG5ymklp5DpxT1o18JJrwPPotxwnR1TIJStt4jcAqkRasHSpR5dnfQN/exec`
- Backend path: `/Users/MprS/Desktop/<code>/PROGETTI/MEDIA-event/backend/`
- Frontend path: `/Users/MprS/Desktop/<code>/PROGETTI/MEDIA-event/frontend/`
- Docs path: `/Users/MprS/Desktop/<code>/PROGETTI/MEDIA-event/docs/`

## GAS Deployments

- `@HEAD` — AKfycbyjAR2RiBWjcG-puXfjdF5a-lfYZWRZmAEBp393AmY (non Web App)
- `@3` — AKfycbzhgmk... (vecchio, scaduto)
- `@4` — AKfycbwQbAz... (versione v1.1-demo, non Web App)
- **ATTIVO** — AKfycbzLF8ib... (Web App pubblicata, "Chiunque", esegui come: me)

**Nota:** ogni volta che si fa `clasp deploy` + nuova Web App GAS, aggiornare `GAS_ENDPOINT` in `frontend/src/api/client.js`.

## Credenziali demo

- Admin: `admin@madeevent.it` / `Made2024!` (ruolo SUPER_ADMIN)
- Tenant reale nel foglio Tenants (NON "UUID" letterale — vedi bug risolto)

## File backend (17 totali)

```
Code.js, Config.js, Setup.js, auth.js, utils.js, tenants.js,
SheetUtils.js, Entities.js, RegistrationFlow.js,
Workflows.js, SpecialActions.js, DriveManager.js,
Logging.js, Gmail.js, Jobs.js, Demo.js, appsscript.json
```

## Stato Sprint (al 2026-03-24)

- Sprint 0 ✅ — .clasp.json, Config.js, Setup.js, Utils.js
- Sprint 1 ✅ — auth.js, tenants.js, Code.js (router completo)
- Sprint 2 ✅ — Entities.js (CRUD), RegistrationFlow.js (step 1/2/3 + scoring)
- Sprint 3 ✅ — Workflows.js (state machine + side effects)
- Sprint 4 ✅ — SpecialActions.js (submit, checkin, checkout)
- Sprint 5 ✅ — DriveManager.js (cartelle, upload, access control)
- Sprint 6 ✅ — Logging.js + Gmail.js (11 template email)
- Sprint 7 ✅ — Jobs.js (5 job scheduler + jobRegistrationSolleciti)
- Sprint 8 ✅ — Frontend onboarding hostess/steward (8 sezioni, upload, scoring)
- Sprint 9 ✅ — Demo.js (setupDemoData, createDemoAdmin, fixAdminPassword, fixAdminTenantId, debugTokenSecret)
- Sprint 10 ✅ — AdminDashboard: LeadsSection con filtri, paginazione, drawer, badge stato, ScoreBar
- Sprint 11 ✅ — Multi-route admin refactor: route separate, EventiPage card+foto, ClientiPage, CandidaturePage
- Sprint 12 ✅ — Brand → MADE EVENTS, overview ripristinata, EventiPage (saturazione, chiudi selezioni, modifica, match drawer), CandidaturePage (filtri evento+città, avatar, score, ordinamento)

## Architettura frontend admin (aggiornata Sprint 12)

```
src/pages/
  AdminDashboard.jsx        → /admin
                              4 KPI cards cliccabili +
                              LeadsSection (bozze PARTIAL) +
                              TalentsSection (COMPLETED_PENDING + APPROVED)

  admin/
    shared.jsx              → ADMIN_SIDEBAR (route-based, exact:/admin),
                              PageHeader, LeadBadge, ScoreBar, TalentAvatar,
                              FILTER_INPUT, PAGE_SIZE(20), Pagination, LeadDrawer

    LeadPage.jsx            → /admin/lead
                              export LeadsSection (riusata in overview)
                              tabella bozze PARTIAL, "Sollecita completamento"

    TalentPage.jsx          → /admin/talent
                              export TalentsSection (riusata in overview)
                              tabella COMPLETED_PENDING + APPROVED, drawer approvazione

    EventiPage.jsx          → /admin/eventi
                              filtri: città (testo), stato, ordinamento (data|saturazione)
                              card: foto, toggle ATTIVO/NON ATTIVO (pallino verde/rosso),
                              barra saturazione colorata (verde<80%, arancio 80-100%, rosso>100%),
                              hostess_richieste editabile inline,
                              CHIUDI/APRI SELEZIONI (toggle locale),
                              DUPLICA (drawer pre-compilato senza date),
                              MODIFICA (drawer prefillato — stub, attende event.update backend),
                              Talent → drawer talent compatibili per-card
                              (filtra APPROVED per provincia/città/weekend/trasferte/esperienza)

    ClientiPage.jsx         → /admin/clienti
                              lista + form drawer crea/modifica

    CandidaturePage.jsx     → /admin/candidature
                              filtri: evento (dropdown), città talent, stato candidatura
                              ordinamento: più recenti | score talent ↓
                              tabella: avatar+foto, nome, città, ScoreBar, evento, turno, stato
                              Accetta/Rifiuta inline con loading state
```

### ADMIN_SIDEBAR items

```js
[
  { type:'section', label:'Dashboard' },
  { label:'Overview',       to:'/admin',           exact:true },
  { type:'section', label:'Talent' },
  { label:'Lead',           to:'/admin/lead' },
  { label:'Profili Talent', to:'/admin/talent' },
  { type:'section', label:'Operativo' },
  { label:'Clienti',        to:'/admin/clienti' },
  { label:'Eventi',         to:'/admin/eventi' },
  { label:'Candidature',    to:'/admin/candidature' },
]
```

Layout.jsx Sidebar: active detection usa `item.exact ? pathname===item.to : pathname.startsWith(item.to)`

### Route complete App.jsx

```
/                       → RootRedirect (→ /admin se SUPER_ADMIN/ADMIN)
/login                  → LoginPage
/registrazione          → RegisterUser
/registrazione/completa → RegisterComplete
/azienda                → RegisterAzienda
/demo-reset             → DemoReset (solo DEV)
/admin                  → AdminDashboard   [SUPER_ADMIN, ADMIN]
/admin/lead             → LeadPage         [SUPER_ADMIN, ADMIN]
/admin/talent           → TalentPage       [SUPER_ADMIN, ADMIN]
/admin/eventi           → EventiPage       [SUPER_ADMIN, ADMIN]
/admin/clienti          → ClientiPage      [SUPER_ADMIN, ADMIN]
/admin/candidature      → CandidaturePage  [SUPER_ADMIN, ADMIN]
/portale/*              → UserPortal       [USER]
/cliente/*              → ClientPortal     [CLIENTE]
```

## Endpoint backend MANCANTI (da implementare)

| Feature frontend | Endpoint GAS da aggiungere | File da modificare |
|---|---|---|
| MODIFICA evento | `event.update` — aggiorna campi evento esistente | `Code.js` (route), `Entities.js` (handler) |
| CHIUDI SELEZIONI (persistenza) | campo `selezioni_chiuse: bool` via `event.update` | stessa cosa |
| Hostess richieste (persistenza) | campo `hostess_richieste: number` via `event.update` | stessa cosa |
| Invita talent a candidarsi | `application.invite` — crea APPLICATION status INVITED | `Code.js`, `SpecialActions.js` o `Entities.js` |

**Nota implementazione `event.update`:**
- Pattern uguale a `client.update` già esistente
- In `Code.js`: aggiungere `case 'event.update': return handleEventUpdate(payload, context)`
- In `Entities.js`: aggiungere `function handleEventUpdate(payload, context)` che chiama `updateEntity('EVENT', payload.entity_id, payload, context.tenant_id)`
- La UI frontend (EventFormDrawer con `isEdit=true`) è già pronta — basta aggiungere `eventApi.update` in `client.js`

## Funzioni utili in Demo.js (eseguire dal GAS Editor)

| Funzione | Scopo |
|---|---|
| `setupDemoData()` | Cancella e ricrea tutto: 7 lead + 2 clienti + 3 eventi (1 LIVE Gala con foto, 2 PLANNING Fiera+Wedding con foto) + turni + candidature + assignment |
| `createDemoAdmin()` | Crea/aggiorna admin@madeevent.it con pwd Made2024! |
| `fixAdminPassword()` | Ricalcola e salva l'hash corretto per admin@madeevent.it |
| `fixAdminTenantId()` | Corregge tenant_id dell'admin usando il Tenants sheet come fonte |
| `debugTokenSecret()` | Stampa TOKEN_SECRET e genera token di test nel log |

### Dati demo creati da setupDemoData()

- **Lead bozza (PARTIAL):** Anna Colombo (Milano), Roberto Esposito (Roma), Alessandro Gatti (Bologna, sezione 3/8)
- **Profili in attesa (COMPLETED_PENDING_APPROVAL):** Sofia Ferretti (score 92), Marco Bianchi (78), Giulia Rossi (65)
- **Profili approvati (APPROVED):** Luca Marino (score 58), Valentina Conti (45)
- **Clienti:** Luxuria Events S.r.l. (Milano), Bella Italia Catering S.p.A. (Roma)
- **Eventi:**
  - Gala della Moda Milano 2025 — LIVE — foto Unsplash — cliente: Luxuria Events
  - Fiera Internazionale Milano 2025 — PLANNING — foto Unsplash — cliente: Luxuria Events
  - Wedding Luxury Villa Borghese — PLANNING — foto Unsplash — cliente: Bella Italia Catering
- **Turni:** 2 (shiftGala OPEN, shiftFiera OPEN)
- **Candidature:** 2 PENDING (Luca→Gala, Valentina→Fiera)
- **Assignment:** 1 CONFIRMED (Luca Marino, Gala)

## Bug risolti (critici)

### tenant_id "UUID" (2026-03-24)
**Problema:** Il foglio Users conteneva la stringa letterale `"UUID"` come tenant_id per `admin@madeevent.it`.
Causava JWT con tenant sbagliato → 0 risultati in dashboard + AUTH_001 su ogni chiamata.
**Fix:** `fixAdminTenantId()` in Demo.js. Dopo va fatto logout + login.
**Prevenzione:** `setupDemoData()` usa `_getAdminTenantId_()` per leggere il tenant reale dagli Users.

### URL Web App scaduto (2026-03-24)
**Fix:** creare nuovo deployment dal GAS Editor come "App web" con accesso "Chiunque" e aggiornare `GAS_ENDPOINT` in `client.js`.

### hash_match false per admin@madeevent.it (2026-03-24)
**Fix:** `fixAdminPassword()` ricalcola e sovrascrive con `hashPassword('Made2024!')`.

## Note critiche architetturali

- `clasp push` aggiorna il codice HEAD ma NON aggiorna i deployment esistenti → dopo push significativi fare nuovo deployment Web App dal GAS Editor
- `TOKEN_SECRET` vive in `PropertiesService.getScriptProperties()` — persiste tra versioni, ma se le properties vengono cancellate tutti i token attivi diventano invalidi
- `SheetUtils.js` usa il primo campo `*_id` come PK; `deleted: true` esclude le righe da tutte le query
- Token JWT formato: `base64WebSafe(payload) + "." + base64WebSafe(HMAC-SHA256)` — decodificato lato frontend con `atob()` dopo replace `-→+` e `_→/`
- `curl -L` non funziona con GAS Web App (redirect chain richiede cookie di sessione Google); usare il browser o fetch() con `redirect: 'follow'`
- `LeadsSection` e `TalentsSection` sono componenti esportati (named export) da LeadPage.jsx e TalentPage.jsx — importati sia nelle pagine dedicate sia in AdminDashboard per l'overview

## Fonte di verità PRD

`docs/MADE_EVENT_PRD_AI.txt` — AI-optimized, blocchi modulari.
Ogni sprint deve rispettare PRD BLOCK:REGOLE_BUSINESS_CRITICHE (RB-01..RB-10).

**Why:** Progetto MVP fase 1 — validare gestione staffing eventi internamente per MADE EVENTS.
**How to apply:** Prima di ogni nuovo sprint leggere il PRD e verificare i constraint RB-01..RB-10.
