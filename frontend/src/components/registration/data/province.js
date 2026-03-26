// === PROVINCE ITALIANE — MADE EVENT Platform ===
// 107 province con sigla, nome completo e regione.
// Usato nei cascading select di Sezione 1 (luogo nascita/residenza) e Sezione 3 (province lavoro).

export const REGIONI = [
  'Abruzzo', 'Basilicata', 'Calabria', 'Campania', 'Emilia-Romagna',
  'Friuli-Venezia Giulia', 'Lazio', 'Liguria', 'Lombardia', 'Marche',
  'Molise', 'Piemonte', 'Puglia', 'Sardegna', 'Sicilia',
  'Toscana', 'Trentino-Alto Adige', 'Umbria', "Valle d'Aosta", 'Veneto',
]

export const PROVINCE = [
  // Abruzzo
  { sigla: 'AQ', nome: "L'Aquila",  regione: 'Abruzzo' },
  { sigla: 'CH', nome: 'Chieti',    regione: 'Abruzzo' },
  { sigla: 'PE', nome: 'Pescara',   regione: 'Abruzzo' },
  { sigla: 'TE', nome: 'Teramo',    regione: 'Abruzzo' },
  // Basilicata
  { sigla: 'MT', nome: 'Matera',    regione: 'Basilicata' },
  { sigla: 'PZ', nome: 'Potenza',   regione: 'Basilicata' },
  // Calabria
  { sigla: 'CZ', nome: 'Catanzaro', regione: 'Calabria' },
  { sigla: 'CS', nome: 'Cosenza',   regione: 'Calabria' },
  { sigla: 'KR', nome: 'Crotone',   regione: 'Calabria' },
  { sigla: 'RC', nome: 'Reggio Calabria', regione: 'Calabria' },
  { sigla: 'VV', nome: 'Vibo Valentia',  regione: 'Calabria' },
  // Campania
  { sigla: 'AV', nome: 'Avellino',  regione: 'Campania' },
  { sigla: 'BN', nome: 'Benevento', regione: 'Campania' },
  { sigla: 'CE', nome: 'Caserta',   regione: 'Campania' },
  { sigla: 'NA', nome: 'Napoli',    regione: 'Campania' },
  { sigla: 'SA', nome: 'Salerno',   regione: 'Campania' },
  // Emilia-Romagna
  { sigla: 'BO', nome: 'Bologna',   regione: 'Emilia-Romagna' },
  { sigla: 'FE', nome: 'Ferrara',   regione: 'Emilia-Romagna' },
  { sigla: 'FC', nome: 'Forlì-Cesena', regione: 'Emilia-Romagna' },
  { sigla: 'MO', nome: 'Modena',    regione: 'Emilia-Romagna' },
  { sigla: 'PR', nome: 'Parma',     regione: 'Emilia-Romagna' },
  { sigla: 'PC', nome: 'Piacenza',  regione: 'Emilia-Romagna' },
  { sigla: 'RA', nome: 'Ravenna',   regione: 'Emilia-Romagna' },
  { sigla: 'RN', nome: 'Rimini',    regione: 'Emilia-Romagna' },
  { sigla: 'RE', nome: 'Reggio Emilia', regione: 'Emilia-Romagna' },
  // Friuli-Venezia Giulia
  { sigla: 'GO', nome: 'Gorizia',   regione: 'Friuli-Venezia Giulia' },
  { sigla: 'PN', nome: 'Pordenone', regione: 'Friuli-Venezia Giulia' },
  { sigla: 'TS', nome: 'Trieste',   regione: 'Friuli-Venezia Giulia' },
  { sigla: 'UD', nome: 'Udine',     regione: 'Friuli-Venezia Giulia' },
  // Lazio
  { sigla: 'FR', nome: 'Frosinone', regione: 'Lazio' },
  { sigla: 'LT', nome: 'Latina',    regione: 'Lazio' },
  { sigla: 'RI', nome: 'Rieti',     regione: 'Lazio' },
  { sigla: 'RM', nome: 'Roma',      regione: 'Lazio' },
  { sigla: 'VT', nome: 'Viterbo',   regione: 'Lazio' },
  // Liguria
  { sigla: 'GE', nome: 'Genova',    regione: 'Liguria' },
  { sigla: 'IM', nome: 'Imperia',   regione: 'Liguria' },
  { sigla: 'SP', nome: 'La Spezia', regione: 'Liguria' },
  { sigla: 'SV', nome: 'Savona',    regione: 'Liguria' },
  // Lombardia
  { sigla: 'BG', nome: 'Bergamo',   regione: 'Lombardia' },
  { sigla: 'BS', nome: 'Brescia',   regione: 'Lombardia' },
  { sigla: 'CO', nome: 'Como',      regione: 'Lombardia' },
  { sigla: 'CR', nome: 'Cremona',   regione: 'Lombardia' },
  { sigla: 'LC', nome: 'Lecco',     regione: 'Lombardia' },
  { sigla: 'LO', nome: 'Lodi',      regione: 'Lombardia' },
  { sigla: 'MN', nome: 'Mantova',   regione: 'Lombardia' },
  { sigla: 'MI', nome: 'Milano',    regione: 'Lombardia' },
  { sigla: 'MB', nome: 'Monza e Brianza', regione: 'Lombardia' },
  { sigla: 'PV', nome: 'Pavia',     regione: 'Lombardia' },
  { sigla: 'SO', nome: 'Sondrio',   regione: 'Lombardia' },
  { sigla: 'VA', nome: 'Varese',    regione: 'Lombardia' },
  // Marche
  { sigla: 'AN', nome: 'Ancona',    regione: 'Marche' },
  { sigla: 'AP', nome: 'Ascoli Piceno', regione: 'Marche' },
  { sigla: 'FM', nome: 'Fermo',     regione: 'Marche' },
  { sigla: 'MC', nome: 'Macerata',  regione: 'Marche' },
  { sigla: 'PU', nome: 'Pesaro e Urbino', regione: 'Marche' },
  // Molise
  { sigla: 'CB', nome: 'Campobasso', regione: 'Molise' },
  { sigla: 'IS', nome: 'Isernia',   regione: 'Molise' },
  // Piemonte
  { sigla: 'AL', nome: 'Alessandria', regione: 'Piemonte' },
  { sigla: 'AT', nome: 'Asti',      regione: 'Piemonte' },
  { sigla: 'BI', nome: 'Biella',    regione: 'Piemonte' },
  { sigla: 'CN', nome: 'Cuneo',     regione: 'Piemonte' },
  { sigla: 'NO', nome: 'Novara',    regione: 'Piemonte' },
  { sigla: 'TO', nome: 'Torino',    regione: 'Piemonte' },
  { sigla: 'VB', nome: 'Verbano-Cusio-Ossola', regione: 'Piemonte' },
  { sigla: 'VC', nome: 'Vercelli',  regione: 'Piemonte' },
  // Puglia
  { sigla: 'BA', nome: 'Bari',      regione: 'Puglia' },
  { sigla: 'BT', nome: 'Barletta-Andria-Trani', regione: 'Puglia' },
  { sigla: 'BR', nome: 'Brindisi',  regione: 'Puglia' },
  { sigla: 'FG', nome: 'Foggia',    regione: 'Puglia' },
  { sigla: 'LE', nome: 'Lecce',     regione: 'Puglia' },
  { sigla: 'TA', nome: 'Taranto',   regione: 'Puglia' },
  // Sardegna
  { sigla: 'CA', nome: 'Cagliari',  regione: 'Sardegna' },
  { sigla: 'NU', nome: 'Nuoro',     regione: 'Sardegna' },
  { sigla: 'OR', nome: 'Oristano',  regione: 'Sardegna' },
  { sigla: 'SS', nome: 'Sassari',   regione: 'Sardegna' },
  { sigla: 'SU', nome: 'Sud Sardegna', regione: 'Sardegna' },
  { sigla: 'OG', nome: 'Ogliastra', regione: 'Sardegna' },
  { sigla: 'OT', nome: 'Olbia-Tempio', regione: 'Sardegna' },
  // Sicilia
  { sigla: 'AG', nome: 'Agrigento', regione: 'Sicilia' },
  { sigla: 'CL', nome: 'Caltanissetta', regione: 'Sicilia' },
  { sigla: 'CT', nome: 'Catania',   regione: 'Sicilia' },
  { sigla: 'EN', nome: 'Enna',      regione: 'Sicilia' },
  { sigla: 'ME', nome: 'Messina',   regione: 'Sicilia' },
  { sigla: 'PA', nome: 'Palermo',   regione: 'Sicilia' },
  { sigla: 'RG', nome: 'Ragusa',    regione: 'Sicilia' },
  { sigla: 'SR', nome: 'Siracusa',  regione: 'Sicilia' },
  { sigla: 'TP', nome: 'Trapani',   regione: 'Sicilia' },
  // Toscana
  { sigla: 'AR', nome: 'Arezzo',    regione: 'Toscana' },
  { sigla: 'FI', nome: 'Firenze',   regione: 'Toscana' },
  { sigla: 'GR', nome: 'Grosseto',  regione: 'Toscana' },
  { sigla: 'LI', nome: 'Livorno',   regione: 'Toscana' },
  { sigla: 'LU', nome: 'Lucca',     regione: 'Toscana' },
  { sigla: 'MS', nome: 'Massa-Carrara', regione: 'Toscana' },
  { sigla: 'PI', nome: 'Pisa',      regione: 'Toscana' },
  { sigla: 'PT', nome: 'Pistoia',   regione: 'Toscana' },
  { sigla: 'PO', nome: 'Prato',     regione: 'Toscana' },
  { sigla: 'SI', nome: 'Siena',     regione: 'Toscana' },
  // Trentino-Alto Adige
  { sigla: 'BZ', nome: 'Bolzano',   regione: 'Trentino-Alto Adige' },
  { sigla: 'TN', nome: 'Trento',    regione: 'Trentino-Alto Adige' },
  // Umbria
  { sigla: 'PG', nome: 'Perugia',   regione: 'Umbria' },
  { sigla: 'TR', nome: 'Terni',     regione: 'Umbria' },
  // Valle d'Aosta
  { sigla: 'AO', nome: "Aosta",     regione: "Valle d'Aosta" },
  // Veneto
  { sigla: 'BL', nome: 'Belluno',   regione: 'Veneto' },
  { sigla: 'PD', nome: 'Padova',    regione: 'Veneto' },
  { sigla: 'RO', nome: 'Rovigo',    regione: 'Veneto' },
  { sigla: 'TV', nome: 'Treviso',   regione: 'Veneto' },
  { sigla: 'VE', nome: 'Venezia',   regione: 'Veneto' },
  { sigla: 'VR', nome: 'Verona',    regione: 'Veneto' },
  { sigla: 'VI', nome: 'Vicenza',   regione: 'Veneto' },
]

/** Filtra province per regione */
export function provinceByRegione(regione) {
  return PROVINCE.filter(p => p.regione === regione)
}

/** Ritorna tutte le province ordinate alfabeticamente per nome */
export const PROVINCE_ALFA = [...PROVINCE].sort((a, b) => a.nome.localeCompare(b.nome, 'it'))
