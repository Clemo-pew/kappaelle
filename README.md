# Kappaelle — Gestionale Task

Gestionale interno per assegnare task ai collaboratori e seguirne l'avanzamento.

- **Admin**: crea task (titolo, descrizione, cliente/progetto, priorità, scadenza), li assegna a uno o più collaboratori, vede l'avanzamento di ognuno con le note, filtra per cliente/collaboratore/mese/stato, gestisce account e clienti.
- **Collaboratore**: accede con le sue credenziali, vede solo i task a lui assegnati, li segna come **completati (100%)** oppure indica una **percentuale** (es. 75% "quasi finito") con una nota facoltativa.
- **Commenti e menzioni**: ogni task ha la sua pagina con i commenti; scrivendo `@` si menziona un collaboratore, che riceve una notifica e può vedere il task (anche se non è assegnato).
- **Notifiche interne**: campanella in alto con il numero di non lette (nuovo task assegnato, nuova menzione).
- **Link allegati**: ogni task può avere link con etichetta (Google Drive, Dropbox, WeTransfer, Figma…).

> **Aggiornamenti del database**: quando il file `supabase/schema.sql` cambia, basta rieseguirlo per intero nell'SQL Editor. È sicuro: non cancella né duplica i dati esistenti.

Stack: Next.js 16 (App Router) · Supabase (Auth + Postgres con Row Level Security) · Tailwind CSS 4 · deploy su Vercel.

---

## 1. Supabase

1. Crea un progetto su [supabase.com](https://supabase.com) (regione consigliata: *Central EU (Frankfurt)*).
2. **SQL Editor → New query**: incolla tutto il contenuto di [`supabase/schema.sql`](supabase/schema.sql) e premi **Run**.
3. **Authentication → Sign In / Providers**: disattiva **Allow new users to sign up**. Gli account li crea solo l'admin dal gestionale. Lascia attivo il provider *Email*.
4. **Crea il primo admin**
   - *Authentication → Users → Add user → Create new user*: inserisci la tua email e una password, spunta *Auto Confirm User*.
   - Poi in *SQL Editor* esegui (con la tua email):
     ```sql
     update public.profiles
     set role = 'admin', full_name = 'Nome Cognome'
     where email = 'tua@email.it';
     ```
5. **Project Settings → API**: copia `Project URL`, la chiave `anon` `public` e la chiave `service_role` (segreta).

## 2. Vercel

1. Su [vercel.com](https://vercel.com) → **Add New → Project** → importa il repository `Clemo-pew/kappaelle`.
2. In **Environment Variables** aggiungi:

   | Nome | Valore |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | chiave `anon` |
   | `SUPABASE_SERVICE_ROLE_KEY` | chiave `service_role` (serve per creare account e inviare notifiche push) |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | chiave pubblica per le notifiche push |
   | `VAPID_PRIVATE_KEY` | chiave privata per le notifiche push (segreta) |
   | `VAPID_SUBJECT` | `mailto:` + email di contatto |

   Le chiavi VAPID si generano con `npx web-push generate-vapid-keys`.

3. **Deploy**. Accedi con l'admin creato al punto 1.4.

## 3. Uso

1. **Clienti** → aggiungi i clienti/progetti.
2. **Collaboratori** → crea gli account (il pulsante ⟳ genera una password) e comunica le credenziali.
3. **Tutti i task → + Nuovo task** → compila e scegli uno o più collaboratori.
4. Ogni collaboratore in **I miei task** aggiorna la sua percentuale; l'admin vede in tempo reale la % di ciascuno, la media del task, l'ora dell'ultimo aggiornamento e le note.
5. Cliccando sul titolo di un task si apre la sua pagina: link allegati, avanzamento e **commenti**. Scrivi `@` e scegli un collaboratore per menzionarlo.
6. La **campanella** in alto mostra le notifiche non lette; aprendo il task collegato diventano lette.
7. **Importa CSV** (solo admin, da *Tutti i task*): scarica il modello, compilalo in Excel e salvalo come CSV, poi caricalo. Vedi l'anteprima con eventuali errori e importi solo le righe valide. Colonne: `titolo`*, `assegnati`* (email o nome, separati da virgola), `descrizione`, `cliente`, `priorita`, `scadenza` (gg/mm/aaaa), `link`.

## App sul telefono

- **iPhone** (iOS 16.4+): Safari → **Condividi → Aggiungi alla schermata Home**, apri Kappaelle dall'icona, poi **Notifiche → Attiva notifiche**.
- **Android**: Chrome → menu ⋮ → **Installa app** (o *Aggiungi a schermata Home*), poi **Attiva notifiche**.

Da quel momento arrivano le notifiche push (nuovo task, menzione) anche ad app chiusa, e l'icona mostra il numero di non lette (su iPhone e computer; su Android compare il pallino di notifica del launcher).

Un collaboratore **disattivato** non può più accedere, ma il suo storico resta. I task **archiviati** spariscono dalla vista dei collaboratori.

## Sicurezza

Le regole sono applicate dal database (Row Level Security), non solo dall'interfaccia:

- il collaboratore legge solo i task a cui è assegnato e può modificare solo la **propria** percentuale e nota;
- solo gli admin creano/modificano task, clienti, assegnazioni e ruoli;
- ogni nuovo utente nasce `employee`; il ruolo admin si assegna solo lato server;
- la chiave `service_role` è usata esclusivamente in server action protette.

## Sviluppo locale

```bash
cp .env.example .env.local   # e compila i valori
npm install
npm run dev                  # http://localhost:3000
```
