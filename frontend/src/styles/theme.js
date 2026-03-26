// === THEME.JS — MADE EVENT Platform Design System ===
// Fonte unica di verità per tutti i token di design.
// Usato come riferimento da tutti i componenti (inline styles).

export const COLORS = {
  text:           '#2E2E2E',
  textSecondary:  '#6B6B6B',
  accent:         '#7A1E2C',
  accentHover:    '#8F2536',
  accentLight:    '#F5E8EA',   // bordeaux al 10% — usato per sfondi highlight
  bg:             '#FFFFFF',
  border:         '#EAEAEA',
  surface:        '#FAFAFA',
  error:          '#C0392B',
  errorLight:     '#FDECEA',
  success:        '#2E7D32',
  successLight:   '#EDF7ED',
  warning:        '#E65100',
  warningLight:   '#FFF3E0',
}

export const FONTS = {
  family:  "'Montserrat', sans-serif",
  weight:  { light: 300, regular: 400, medium: 500 },
}

export const LETTER_SPACING = {
  logo:   '6px',
  menu:   '2px',
  title:  '1.5px',
  body:   '0.5px',
}

export const SPACING = {
  xs:  '4px',
  sm:  '8px',
  md:  '16px',
  lg:  '24px',
  xl:  '32px',
  xxl: '48px',
}

export const RADIUS = {
  sm: '2px',
  md: '4px',
  lg: '6px',
  xl: '12px',
}

export const LAYOUT = {
  headerHeight:  '90px',
  sidebarWidth:  '240px',
  maxContent:    '1200px',
}

// ---------------------------------------------------------------------------
// COMPONENT STYLE OBJECTS — base styles per componente
// ---------------------------------------------------------------------------

export const COMPONENT_STYLES = {
  header: {
    height:         LAYOUT.headerHeight,
    background:     COLORS.bg,
    borderBottom:   `1px solid ${COLORS.border}`,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'space-between',
    padding:        '0 40px',
    position:       'sticky',
    top:            0,
    zIndex:         100,
  },

  logo: {
    height:        '50px',
    display:       'flex',
    alignItems:    'center',
    gap:           '12px',
    letterSpacing: LETTER_SPACING.logo,
    fontWeight:    FONTS.weight.medium,
    fontSize:      '13px',
    textTransform: 'uppercase',
    color:         COLORS.text,
  },

  navLink: {
    fontSize:      '14px',
    fontWeight:    FONTS.weight.light,
    letterSpacing: LETTER_SPACING.menu,
    textTransform: 'uppercase',
    color:         COLORS.text,
    textDecoration:'none',
    paddingBottom: '2px',
    cursor:        'pointer',
    border:        'none',
    background:    'none',
    fontFamily:    FONTS.family,
    transition:    'color 0.25s',
  },

  card: {
    background:   COLORS.bg,
    border:       `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.lg,
    padding:      '30px',
    transition:   'border-color 0.25s',
    cursor:       'default',
  },

  cardHover: {
    borderColor: COLORS.accent,
  },

  buttonPrimary: {
    background:    COLORS.accent,
    color:         '#FFFFFF',
    border:        'none',
    borderRadius:  RADIUS.md,
    padding:       '14px 28px',
    fontFamily:    FONTS.family,
    fontWeight:    FONTS.weight.light,
    fontSize:      '14px',
    letterSpacing: LETTER_SPACING.title,
    textTransform: 'uppercase',
    cursor:        'pointer',
    transition:    'background 0.3s',
    display:       'inline-flex',
    alignItems:    'center',
    justifyContent:'center',
    gap:           '8px',
    whiteSpace:    'nowrap',
  },

  buttonSecondary: {
    background:    'transparent',
    color:         COLORS.accent,
    border:        `1px solid ${COLORS.accent}`,
    borderRadius:  RADIUS.md,
    padding:       '13px 28px',
    fontFamily:    FONTS.family,
    fontWeight:    FONTS.weight.light,
    fontSize:      '14px',
    letterSpacing: LETTER_SPACING.title,
    textTransform: 'uppercase',
    cursor:        'pointer',
    transition:    'background 0.3s, color 0.3s',
  },

  buttonDanger: {
    background:    'transparent',
    color:         COLORS.error,
    border:        `1px solid ${COLORS.error}`,
    borderRadius:  RADIUS.md,
    padding:       '10px 20px',
    fontFamily:    FONTS.family,
    fontWeight:    FONTS.weight.light,
    fontSize:      '13px',
    letterSpacing: LETTER_SPACING.body,
    cursor:        'pointer',
    transition:    'background 0.25s, color 0.25s',
  },

  buttonSmall: {
    padding:       '8px 16px',
    fontSize:      '12px',
    letterSpacing: LETTER_SPACING.body,
  },

  input: {
    width:       '100%',
    border:      `1px solid ${COLORS.border}`,
    borderRadius: RADIUS.md,
    padding:     '14px',
    fontFamily:  FONTS.family,
    fontWeight:  FONTS.weight.light,
    fontSize:    '14px',
    color:       COLORS.text,
    background:  COLORS.bg,
    outline:     'none',
    transition:  'border-color 0.2s',
    boxSizing:   'border-box',
    letterSpacing: LETTER_SPACING.body,
  },

  label: {
    display:       'block',
    fontSize:      '12px',
    fontWeight:    FONTS.weight.medium,
    letterSpacing: LETTER_SPACING.title,
    textTransform: 'uppercase',
    color:         COLORS.textSecondary,
    marginBottom:  '8px',
  },

  sectionTitle: {
    fontSize:      '18px',
    fontWeight:    FONTS.weight.light,
    letterSpacing: LETTER_SPACING.title,
    textTransform: 'uppercase',
    color:         COLORS.text,
    marginBottom:  '24px',
    paddingBottom: '12px',
    borderBottom:  `2px solid ${COLORS.accent}`,
    display:       'inline-block',
  },

  dividerAccent: {
    height:     '2px',
    background: COLORS.accent,
    border:     'none',
    margin:     '32px 0',
  },

  footer: {
    background:   COLORS.bg,
    borderTop:    `1px solid ${COLORS.border}`,
    padding:      '24px 40px',
    color:        COLORS.textSecondary,
    fontSize:     '13px',
    letterSpacing: LETTER_SPACING.body,
  },
}
