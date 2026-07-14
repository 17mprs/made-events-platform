// === OPZIONI CONDIVISE QUESTIONARIO ===
// Fonte unica delle opzioni a scelta fissa (select/checkbox/radio) usate sia
// dal questionario di registrazione (Section1-7) sia dall'area riservata
// talent (UserPortal.jsx) — evita che i due form divergano nel tempo.

export const range = (from, to, step = 1) => {
  const arr = []
  for (let i = from; i <= to; i += step) arr.push(i)
  return arr
}

// Sezione 2 — Profilo Fisico
export const TAGLIE_SHIRT = ['XXS', 'XS', 'S', 'M', 'L', 'XL']
export const TAGLIE_NUM   = range(36, 48, 2)   // 36 38 40 42 44 46 48
export const SCARPE       = range(35, 45)
export const ALTEZZE      = range(150, 195)

// Sezione 3 — Disponibilità Logistica
export const PATENTI = [
  { value: 'Nessuna',          label: 'Nessuna' },
  { value: 'Automobilistica',  label: 'Automobilistica (B)' },
  { value: 'Motociclistica',   label: 'Motociclistica (A)' },
]

// Sezione 4 — Lingue
export const LIVELLI_INGLESE = ['Base', 'Intermedio', 'Fluente', 'Madrelingua']
export const LIVELLI_ALTRA   = ['Non conosco', 'Base', 'Intermedio', 'Fluente', 'Madrelingua']

// Sezione 5 — Profilo Professionale
export const TITOLI_STUDIO = [
  'Scuola elementare',
  'Media inferiore',
  'Media superiore',
  'Laurea triennale',
  'Laurea magistrale',
]

export const PROFESSIONI = [
  'Studentessa',
  'Lavoratrice part-time',
  'Lavoratrice full-time',
  'Libera professionista',
  'Lavoro occasionale',
  'Altro',
]

export const TIPOLOGIE_ESPERIENZA = [
  'Accoglienza',
  'Accrediti / Registrazione partecipanti',
  'Accoglienza ECM',
  'Guardaroba',
  'Hospitality sportiva',
  'Concerti',
  'Promozioni',
  'Promoter vendita',
  'Sampling',
  'Teatri',
  'Fiere',
  'Congressi',
  'Eventi corporate',
  'Eventi luxury',
  'Wedding',
  'Coordinamento eventi',
  'Segreteria organizzativa',
]

export const ANNI_ESPERIENZA = ['0–1', '1–3', '3–5', 'Oltre 5']

// Sezione 6 — Dotazione Personale
export const DOTAZIONE_OPTIONS = [
  'Tailleur pantalone e giacca nero',
  'Camicia bianca classica',
  'Camicia nera classica',
  'Décolleté nere con tacco',
  'Scarpe eleganti nere basse (mocassino / ballerina / stringata)',
  'Tubino nero',
  'Sneaker bianche',
]

// Sezione 7 — Foto Profilo
export const CRITERI_NON_ACCETTAZIONE = [
  'Con altre persone',
  'Con filtri / ritocchi',
  'Con loghi / scritte',
  'Con occhiali da sole',
  'Sfocate o scattate da lontano',
  'Bassa risoluzione',
  'Con cornici decorative',
  'Formato stories / screenshot',
]

export const FOTO_FIELDS = {
  foto_busto:  { label: 'Foto mezzo busto / primo piano', accept: 'image/jpeg,image/png', maxMB: 5, required: true,  hint: 'Sfondo neutro, viso frontale, espressione naturale.' },
  foto_intera: { label: 'Foto figura intera',             accept: 'image/jpeg,image/png', maxMB: 5, required: true,  hint: 'Sfondo neutro, outfit professionale.' },
  foto_extra:  { label: 'Foto aggiuntiva',                accept: 'image/jpeg,image/png', maxMB: 5, required: false, hint: 'Opzionale.' },
}
