// === FAQ PAGE — MADE EVENTS Platform ===
// Accordion con tutte le domande frequenti per il portale talent.
import React, { useState } from 'react'
import Layout from '../components/Layout'
import { COLORS, COMPONENT_STYLES } from '../styles/theme'

const SIDEBAR_ITEMS = [
  { type:'section', label:'Talent' },
  { label:'Offerte di Lavoro',  to:'/portale#events' },
  { label:'Le Mie Candidature', to:'/portale#applications' },
  { label:'I Miei Turni',       to:'/portale#assignments' },
  { type:'section', label:'Account' },
  { label:'Il Mio Profilo',    to:'/portale#profile' },
  { type:'section', label:'Supporto' },
  { label:'FAQ',               to:'/portale/faq' },
]

const FAQS = [
  {
    q: 'Come mi candido per un evento?',
    r: 'Per candidarti è necessario registrarsi nella sezione "Registrati" e completare il proprio profilo inserendo foto conformi, dati personali e professionali. Le proposte di lavoro vengono inviate solo ai profili in linea con le richieste del cliente.',
  },
  {
    q: 'Come funziona il processo di lavoro?',
    r: 'Dopo registrazione e completamento profilo, accedi all\'area riservata e candidati alle offerte disponibili. Se selezionato ricevi conferma via email e WhatsApp. La conferma è vincolante.',
  },
  {
    q: 'Come funzionano le offerte di lavoro?',
    r: 'Nella sezione "Offerte di lavoro" visualizzi e ti candidi alle attività disponibili. Puoi candidarti a più eventi ma solo se realmente disponibile. Hai 24/48h per confermare se selezionato.',
  },
  {
    q: 'La candidatura garantisce la selezione?',
    r: 'No. I profili vengono scelti in base a requisiti del cliente e numero di candidature ricevute.',
  },
  {
    q: 'Perché non vengo selezionata/o?',
    r: 'Dipende da esperienza, immagine, lingue e disponibilità. Mantieni il profilo aggiornato per aumentare le possibilità.',
  },
  {
    q: 'Posso candidarmi a più eventi?',
    r: 'Sì, purché tu sia realmente disponibile nelle date.',
  },
  {
    q: 'Posso ritirare la candidatura?',
    r: 'Sì, fino a quando non sei stato confermato.',
  },
  {
    q: 'Cosa succede dopo la conferma?',
    r: 'La partecipazione è obbligatoria. Contratto e info operative saranno disponibili nella tua area personale.',
  },
  {
    q: 'Posso annullare dopo aver confermato?',
    r: 'Solo per gravi motivi comunicati tempestivamente. Le assenze non giustificate compromettono la collaborazione.',
  },
  {
    q: 'Cosa succede in caso di assenza?',
    r: 'La mancata presentazione senza preavviso è grave inadempienza e può comportare interruzione della collaborazione.',
  },
  {
    q: 'Come ricevo i dettagli dell\'evento?',
    r: 'Ricevi un briefing completo con orari, mansioni, location e dress code prima dell\'attività.',
  },
  {
    q: 'Cosa devo fare in caso di ritardo?',
    r: 'Contatta immediatamente l\'agenzia telefonicamente.',
  },
  {
    q: 'Come devo presentarmi?',
    r: 'Secondo il dress code indicato nel briefing. In generale: tailleur nero classico (pantalone a sigaretta e giacca), camicia bianca classica, scarpa nera elegante. Abbigliamento semplice, ordinato, senza loghi in vista.',
  },
  {
    q: 'Sono previsti rimborsi spese?',
    r: 'Solo se espressamente indicati nella proposta di lavoro.',
  },
  {
    q: 'Come funziona il pagamento?',
    r: 'Pagamento a 30 giorni fine mese. Esempio: lavoro il 4 gennaio → pagamento fine febbraio.',
  },
  {
    q: 'Le ore extra vengono pagate?',
    r: 'Sì, solo se autorizzate dall\'agenzia.',
  },
  {
    q: 'Devo inviare documenti prima di lavorare?',
    r: 'Sì, obbligatorio in formato PDF prima dell\'attività.',
  },
  {
    q: 'Come posso aggiornare il profilo?',
    r: 'Dall\'area riservata puoi modificare dati, esperienze e disponibilità.',
  },
  {
    q: 'Ho problemi di accesso, cosa faccio?',
    r: 'Usa "Password dimenticata" nella pagina di login.',
  },
  {
    q: 'Chi può vedere il mio profilo?',
    r: 'Solo l\'agenzia per selezione e presentazione ai clienti. I dati sensibili non sono pubblici.',
  },
  {
    q: 'Qual è il comportamento richiesto?',
    r: 'Puntualità, professionalità, educazione. Telefono vietato durante il servizio salvo necessità operative.',
  },
]

// ---------------------------------------------------------------------------
// FAQ ITEM — accordion singolo
// ---------------------------------------------------------------------------

function FaqItem({ q, r, index }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{
      borderBottom: `1px solid ${COLORS.border}`,
      ...(index === 0 ? { borderTop: `1px solid ${COLORS.border}` } : {}),
    }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{
          width: '100%', textAlign: 'left', padding: '18px 4px',
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16,
          fontFamily: 'Montserrat, sans-serif', fontSize: 14, fontWeight: 600, color: COLORS.text,
        }}
      >
        <span>{q}</span>
        <span style={{
          fontSize: 20, color: open ? COLORS.accent : COLORS.textSecondary,
          flexShrink: 0, lineHeight: 1, fontWeight: 300,
          transition: 'color 0.15s',
        }}>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div style={{
          paddingBottom: 18, paddingRight: 32,
          fontSize: 14, color: COLORS.text, lineHeight: 1.75,
        }}>
          {r}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// PAGE
// ---------------------------------------------------------------------------

export default function FAQPage() {
  return (
    <Layout sidebarItems={SIDEBAR_ITEMS}>
      <h1 style={{ ...COMPONENT_STYLES.sectionTitle }}>Domande frequenti</h1>
      <p style={{ fontSize: 13, color: COLORS.textSecondary, marginBottom: 36, maxWidth: 640 }}>
        Tutto quello che devi sapere su come funziona la collaborazione con MADE EVENTS.
        Non trovi la risposta? Contattaci direttamente.
      </p>

      <div style={{ maxWidth: 720 }}>
        {FAQS.map((faq, i) => (
          <FaqItem key={i} q={faq.q} r={faq.r} index={i} />
        ))}
      </div>
    </Layout>
  )
}
