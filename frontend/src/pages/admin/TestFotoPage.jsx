// === TEST FOTO PAGE — isolamento CropModal di Section7.jsx (diagnostica) ===
// Route nascosta (non in nav), protetta da RequireAuth admin in App.jsx.
// Monta il vero componente Section7 (nessuna copia) contro l'endpoint GAS
// reale — lead_token/email passati via query string, mai hardcoded in
// sorgente: talent.getLead/talent.uploadRegistrationDoc sono PUBLIC_ACTIONS
// lato backend (nessun token richiesto), quindi un valore hardcoded qui
// finirebbe comunque nel bundle pubblico e sarebbe usabile senza login.
import React, { useState } from 'react'
import Section7 from '../../components/registration/sections/Section7'
import { COLORS } from '../../styles/theme'

export default function TestFotoPage() {
  const params  = new URLSearchParams(window.location.search)
  const leadId  = params.get('lead_token') || ''
  const email   = params.get('email') || ''
  const [data, setData] = useState({})

  const onChange = (key, value) => setData(prev => ({ ...prev, [key]: value }))

  if (!leadId) {
    return (
      <div style={{ padding: 40, fontFamily: 'Montserrat, sans-serif', color: COLORS.text, maxWidth: 560 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700 }}>Test Foto — Section7</h2>
        <p style={{ color: COLORS.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
          Aggiungi <code>?lead_token=...&email=...</code> alla URL per testare l'upload
          (crop incluso) contro un lead reale via endpoint GAS.
        </p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640, margin: '40px auto', padding: '0 24px', fontFamily: 'Montserrat, sans-serif' }}>
      <Section7 data={data} onChange={onChange} leadId={leadId} email={email} onNext={() => {}} />
    </div>
  )
}
