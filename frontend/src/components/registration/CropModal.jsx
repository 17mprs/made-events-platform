// === CROP MODAL — ritaglio interattivo foto profilo (busto/figura intera) ===
// Aspect ratio fisso derivato dalle dimensioni reali delle celle del template
// PDF (FOTO_BUSTO/FOTO_INTERA), così la foto caricata riempie la cella senza
// deformazioni o tagli imprevisti in fase di generazione scheda talent.
import React, { useState, useRef, useEffect } from 'react'
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'
import { COLORS } from '../../styles/theme'

// Crop iniziale: massima altezza possibile, centrato orizzontalmente,
// aspect ratio fisso — centerCrop clampa/centra dentro i bound reali
// dell'immagine (corretto anche per immagini non quadrate).
function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop({ unit: 'px', height: mediaHeight }, aspect, mediaWidth, mediaHeight),
    mediaWidth,
    mediaHeight
  )
}

async function getCroppedImg(image, crop) {
  const canvas = document.createElement('canvas')
  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height
  canvas.width = Math.round(crop.width * scaleX)
  canvas.height = Math.round(crop.height * scaleY)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(
    image,
    crop.x * scaleX, crop.y * scaleY,
    crop.width * scaleX, crop.height * scaleY,
    0, 0, canvas.width, canvas.height
  )
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    }, 'image/jpeg', 0.85)
  })
}

export default function CropModal({ isOpen, imageFile, aspect, onConfirm, onCancel }) {
  const [imgSrc, setImgSrc] = useState(null)
  const [crop, setCrop] = useState()
  const [completedCrop, setCompletedCrop] = useState(null)
  const imgRef = useRef(null)

  useEffect(() => {
    if (!imageFile) { setImgSrc(null); return }
    const url = URL.createObjectURL(imageFile)
    setImgSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [imageFile])

  if (!isOpen) return null

  function onImageLoad(e) {
    const { width, height } = e.currentTarget
    const initial = centerAspectCrop(width, height, aspect)
    setCrop(initial)
    setCompletedCrop(initial)
  }

  async function handleConfirm() {
    if (!imgRef.current || !completedCrop?.width || !completedCrop?.height) return
    const base64 = await getCroppedImg(imgRef.current, completedCrop)
    onConfirm(base64)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
    }}>
      <div style={{
        background: '#fff', borderRadius: '8px', padding: '24px',
        maxWidth: '90vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <p style={{ fontSize: '14px', fontWeight: 600, color: COLORS.text, margin: 0 }}>
          Ritaglia foto
        </p>

        <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
          {imgSrc && (
            <ReactCrop
              crop={crop}
              onChange={pixelCrop => setCrop(pixelCrop)}
              onComplete={pixelCrop => setCompletedCrop(pixelCrop)}
              aspect={aspect}
              keepSelection
            >
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <img
                ref={imgRef}
                src={imgSrc}
                onLoad={onImageLoad}
                style={{ maxHeight: '60vh', maxWidth: '100%', display: 'block' }}
              />
            </ReactCrop>
          )}
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: '10px 20px', borderRadius: '4px', border: `1px solid ${COLORS.border}`,
              background: '#F2F2F2', color: COLORS.text, fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            style={{
              padding: '10px 20px', borderRadius: '4px', border: 'none',
              background: COLORS.accent, color: '#fff', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}
          >
            Conferma
          </button>
        </div>
      </div>
    </div>
  )
}
