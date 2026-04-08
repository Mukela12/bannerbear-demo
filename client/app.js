// ─── Config ───
// In production: Vercel frontend talks to Render backend via /api rewrites
// Locally or when API_BASE is set, use that directly
const API_BASE = window.__API_BASE || ''

// ─── State ───
let selectedTemplate = null
let selectedProof = null
let proofResults = []
let logoData = null
let allTemplates = []

// ─── Utility: safe DOM creation ───
function el(tag, attrs, children) {
  const node = document.createElement(tag)
  if (attrs) {
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'className') node.className = v
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v)
      else if (k.startsWith('on')) node.addEventListener(k.slice(2).toLowerCase(), v)
      else node.setAttribute(k, v)
    })
  }
  if (children) {
    const arr = Array.isArray(children) ? children : [children]
    arr.forEach(c => {
      if (typeof c === 'string') node.appendChild(document.createTextNode(c))
      else if (c) node.appendChild(c)
    })
  }
  return node
}

function clearEl(id) {
  const node = document.getElementById(id)
  while (node.firstChild) node.removeChild(node.firstChild)
  return node
}

// ─── Step navigation ───
function goToStep(n) {
  document.querySelectorAll('.step-tab').forEach(t => {
    const s = parseInt(t.dataset.step)
    t.classList.toggle('active', s === n)
    if (s < n) t.classList.add('completed')
    else t.classList.remove('completed')
  })
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'))
  document.getElementById('step-' + n).classList.add('active')
}

// ─── Step 1: Load templates ───
async function loadTemplates() {
  try {
    const res = await fetch(API_BASE + '/api/templates')
    allTemplates = await res.json()
    const grid = clearEl('templates-grid')
    document.getElementById('templates-loading').style.display = 'none'

    if (allTemplates.length === 0) {
      grid.appendChild(el('div', { className: 'warning-box' }, 'No templates found. Create templates in the Bannerbear dashboard first.'))
      return
    }

    allTemplates.forEach(t => {
      const hasLayers = t.available_modifications && t.available_modifications.length > 0
      const card = el('div', {
        className: 'template-card',
        'data-uid': t.uid,
        onClick: () => selectTemplate(t.uid),
      }, [
        el('img', { src: t.preview_url || 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200"><rect fill="#242836" width="400" height="200"/><text x="50%" y="50%" text-anchor="middle" fill="#8b8fa3" font-size="14">No preview</text></svg>'), alt: t.name }),
        el('div', { className: 'info' }, [
          el('h4', null, t.name),
          el('div', { className: 'meta' }, t.width + ' x ' + t.height + 'px'),
          el('span', { className: 'layers-badge ' + (hasLayers ? 'has-layers' : 'no-layers') },
            hasLayers ? t.available_modifications.length + ' layers' : 'No layers yet'
          ),
          hasLayers ? el('div', { className: 'meta', style: { marginTop: '4px' } },
            t.available_modifications.map(m => m.name).join(', ')
          ) : null,
        ]),
      ])
      grid.appendChild(card)
    })
  } catch (err) {
    const loading = document.getElementById('templates-loading')
    loading.textContent = 'Failed to load templates: ' + err.message
    loading.style.color = 'var(--red)'
  }
}

function selectTemplate(uid) {
  selectedTemplate = allTemplates.find(t => t.uid === uid)
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'))
  const card = document.querySelector('.template-card[data-uid="' + uid + '"]')
  if (card) card.classList.add('selected')
  document.getElementById('btn-next-1').disabled = false
}

// ─── Step 2: Logo upload ───
document.getElementById('logo-upload').addEventListener('click', () => {
  document.getElementById('logo-input').click()
})

document.getElementById('logo-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return

  const uploadEl = document.getElementById('logo-upload')
  uploadEl.classList.add('has-file')
  // Clear and rebuild upload area
  while (uploadEl.firstChild) uploadEl.removeChild(uploadEl.firstChild)
  uploadEl.appendChild(document.getElementById('logo-input') || el('input', { type: 'file', id: 'logo-input', accept: 'image/*', style: { display: 'none' } }))
  const preview = el('img', { className: 'logo-preview', src: URL.createObjectURL(file), alt: 'Logo preview' })
  uploadEl.appendChild(preview)
  uploadEl.appendChild(el('p', { style: { fontSize: '12px', color: 'var(--green)', marginTop: '4px' } }, file.name))

  const form = new FormData()
  form.append('logo', file)
  try {
    const res = await fetch(API_BASE + '/api/upload-logo', { method: 'POST', body: form })
    logoData = await res.json()

    const colorsEl = document.getElementById('logo-colors')
    const swatchesEl = clearEl('color-swatches')
    colorsEl.style.display = 'block'

    logoData.colors.all.forEach(c => {
      const swatch = el('div', { className: 'swatch', style: { background: c }, title: c })
      swatchesEl.appendChild(swatch)
    })
    swatchesEl.appendChild(el('span', { style: { fontSize: '12px', color: 'var(--text2)', marginLeft: '8px' } },
      'Primary: ' + logoData.colors.primary + ' | Secondary: ' + logoData.colors.secondary + ' | Accent: ' + logoData.colors.accent
    ))
  } catch (err) {
    console.error('Logo upload failed:', err)
  }
})

// ─── Step 3: Generate proofs ───
function log(panelId, msg, type) {
  const panel = document.getElementById(panelId)
  const entry = el('div', { className: 'log-entry ' + (type || '') }, [
    el('span', { className: 'time' }, new Date().toLocaleTimeString() + ' '),
    document.createTextNode(msg),
  ])
  panel.appendChild(entry)
  panel.scrollTop = panel.scrollHeight
}

async function generateProofs() {
  const grid = clearEl('proofs-grid')
  const logPanel = clearEl('log-panel')
  const warning = document.getElementById('proofs-warning')
  warning.style.display = 'none'
  warning.textContent = ''
  proofResults = []
  selectedProof = null
  document.getElementById('btn-approve').style.display = 'none'
  document.getElementById('btn-generate').disabled = true

  if (!selectedTemplate) {
    warning.textContent = 'No template selected. Go back to step 1.'
    warning.style.display = 'block'
    document.getElementById('btn-generate').disabled = false
    return
  }

  const layers = selectedTemplate.available_modifications || []
  if (layers.length === 0) {
    warning.style.display = 'block'
    warning.appendChild(el('strong', null, selectedTemplate.name))
    warning.appendChild(document.createTextNode(' has no modifiable layers.'))
    warning.appendChild(el('br'))
    warning.appendChild(el('br'))
    warning.appendChild(document.createTextNode('To test the full flow, add layers in the Bannerbear editor:'))
    warning.appendChild(el('br'))
    warning.appendChild(document.createTextNode('1. Add text layers: business_name, phone, email, tagline'))
    warning.appendChild(el('br'))
    warning.appendChild(document.createTextNode('2. Add an image layer: logo'))
    warning.appendChild(el('br'))
    warning.appendChild(document.createTextNode('3. Add a rectangle layer: background'))
    warning.appendChild(el('br'))
    warning.appendChild(el('br'))
    warning.appendChild(el('em', null, 'The Welcome Template has layers you can test with now.'))
    document.getElementById('btn-generate').disabled = false
    return
  }

  document.getElementById('proofs-loading').style.display = 'block'
  log('log-panel', 'Using template: ' + selectedTemplate.name + ' (' + selectedTemplate.uid + ')', 'info')
  log('log-panel', 'Layers: ' + layers.map(l => l.name).join(', '), 'info')

  // Build text fields
  const textFields = {}
  ;['business_name', 'contact_name', 'phone', 'email', 'website', 'tagline'].forEach(f => {
    const val = document.getElementById(f).value
    if (val) textFields[f] = val
  })
  // Map to common Bannerbear layer names
  textFields.message = textFields.business_name
  textFields.title = textFields.business_name
  textFields.subtitle = textFields.tagline
  textFields.text = textFields.tagline
  textFields.name = textFields.contact_name

  log('log-panel', 'Text fields: ' + JSON.stringify(textFields))

  // Build palettes
  let palettes
  if (logoData && logoData.colors) {
    const c = logoData.colors
    palettes = [
      { primary: c.primary, secondary: c.secondary, accent: c.accent },
      { primary: shiftHue(c.primary, 30), secondary: c.secondary, accent: shiftHue(c.accent, -30) },
      { primary: '#1a1a2e', secondary: '#16213e', accent: c.primary },
    ]
    log('log-panel', 'Using logo-extracted palettes', 'info')
  } else {
    palettes = [
      { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560' },
      { primary: '#0f3460', secondary: '#533483', accent: '#e94560' },
      { primary: '#2d3436', secondary: '#636e72', accent: '#fdcb6e' },
    ]
    log('log-panel', 'No logo — using default palettes')
  }

  const logoUrl = logoData ? (API_BASE || window.location.origin) + '/api/logos/' + logoData.logoId : null

  log('log-panel', 'Sending 3 render requests to Bannerbear...', 'info')

  try {
    const res = await fetch(API_BASE + '/api/generate-proofs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_uid: selectedTemplate.uid,
        text_fields: textFields,
        logo_url: logoUrl,
        palettes: palettes,
      }),
    })
    const data = await res.json()

    if (data.warning) {
      warning.textContent = data.warning
      warning.style.display = 'block'
      document.getElementById('proofs-loading').style.display = 'none'
      document.getElementById('btn-generate').disabled = false
      return
    }

    log('log-panel', 'Got ' + data.proofs.length + ' render jobs', 'success')
    proofResults = data.proofs
    renderProofCards()
    pollProofs()
  } catch (err) {
    log('log-panel', 'Error: ' + err.message, 'error')
    document.getElementById('proofs-loading').style.display = 'none'
    document.getElementById('btn-generate').disabled = false
  }
}

function renderProofCards() {
  const grid = clearEl('proofs-grid')
  proofResults.forEach((p, i) => {
    const card = el('div', {
      className: 'proof-card' + (selectedProof === p ? ' selected' : ''),
      id: 'proof-' + i,
      onClick: () => selectProof(i),
    }, [
      el('div', { className: 'proof-status ' + p.status }, p.status),
      p.image_url
        ? el('img', { src: p.image_url, alt: 'Proof ' + p.variant })
        : el('div', { className: 'proof-loading-placeholder' }, el('div', { className: 'spinner' })),
      el('div', { className: 'proof-info' }, [
        el('div', { className: 'proof-label' }, 'Variant ' + p.variant),
        el('div', { className: 'proof-palette' }, [
          el('div', { className: 'dot', style: { background: p.palette.primary } }),
          el('div', { className: 'dot', style: { background: p.palette.secondary } }),
          el('div', { className: 'dot', style: { background: p.palette.accent } }),
        ]),
      ]),
    ])
    grid.appendChild(card)
  })
}

async function pollProofs() {
  const pending = proofResults.filter(p => p.status === 'pending' || p.status === 'rendering')
  if (pending.length === 0) {
    document.getElementById('proofs-loading').style.display = 'none'
    document.getElementById('btn-generate').disabled = false
    log('log-panel', 'All proofs rendered!', 'success')
    return
  }

  for (const proof of pending) {
    try {
      const res = await fetch(API_BASE + '/api/renders/' + proof.uid)
      const data = await res.json()
      proof.status = data.status
      if (data.image_url) {
        proof.image_url = data.image_url
        log('log-panel', 'Variant ' + proof.variant + ' completed', 'success')
      }
    } catch (e) { /* ignore poll errors */ }
  }

  renderProofCards()
  setTimeout(pollProofs, 2000)
}

function selectProof(index) {
  if (!proofResults[index] || !proofResults[index].image_url) return
  selectedProof = proofResults[index]
  document.querySelectorAll('.proof-card').forEach(c => c.classList.remove('selected'))
  const card = document.getElementById('proof-' + index)
  if (card) card.classList.add('selected')
  document.getElementById('btn-approve').style.display = 'inline-flex'
  document.getElementById('btn-approve').disabled = false
}

// ─── Step 4: Approve → PDF ───
document.getElementById('btn-approve').addEventListener('click', async () => {
  if (!selectedProof) return
  goToStep(4)

  document.getElementById('pdf-loading').style.display = 'block'
  document.getElementById('pdf-result').style.display = 'none'
  document.getElementById('flow-summary').style.display = 'none'
  clearEl('log-panel-pdf')

  log('log-panel-pdf', 'Approving variant ' + selectedProof.variant + '...', 'info')
  log('log-panel-pdf', 'Re-rendering with render_pdf: true (3x credit cost)', 'info')

  try {
    const layers = selectedTemplate.available_modifications || []
    const textFields = {}
    ;['business_name', 'contact_name', 'phone', 'email', 'website', 'tagline'].forEach(f => {
      const val = document.getElementById(f).value
      if (val) textFields[f] = val
    })
    textFields.message = textFields.business_name
    textFields.title = textFields.business_name

    const modifications = []
    layers.forEach(layer => {
      if (textFields[layer.name]) {
        modifications.push({ name: layer.name, text: textFields[layer.name] })
      }
      if (layer.name.toLowerCase().includes('face') && logoData) {
        modifications.push({ name: layer.name, image_url: (API_BASE || window.location.origin) + '/api/logos/' + logoData.logoId })
      }
      if (layer.name.toLowerCase().includes('logo') && logoData) {
        modifications.push({ name: layer.name, image_url: (API_BASE || window.location.origin) + '/api/logos/' + logoData.logoId })
      }
    })

    const res = await fetch(API_BASE + '/api/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_uid: selectedTemplate.uid, modifications: modifications }),
    })
    const data = await res.json()

    log('log-panel-pdf', 'Render job: ' + data.uid, 'info')

    const pollPdf = async () => {
      const check = await fetch(API_BASE + '/api/renders/' + data.uid)
      const pdfData = await check.json()

      if (pdfData.status === 'completed') {
        document.getElementById('pdf-loading').style.display = 'none'

        const resultPanel = clearEl('pdf-result')
        resultPanel.style.display = 'block'
        document.getElementById('flow-summary').style.display = 'block'

        resultPanel.appendChild(el('h3', { style: { color: 'var(--green)' } }, 'Design Approved'))
        resultPanel.appendChild(el('img', { src: pdfData.image_url, alt: 'Approved proof' }))

        const links = el('div', { style: { marginTop: '16px' } })
        links.appendChild(el('p', { style: { fontSize: '13px', color: 'var(--text2)', marginBottom: '8px' } }, 'Final outputs:'))
        links.appendChild(el('a', { href: pdfData.image_url || '#', target: '_blank', className: 'btn btn-outline' }, 'Download PNG'))
        if (pdfData.pdf_url) {
          links.appendChild(document.createTextNode(' '))
          links.appendChild(el('a', { href: pdfData.pdf_url, target: '_blank', className: 'btn btn-success' }, 'Download PDF'))
        } else {
          links.appendChild(document.createTextNode(' '))
          links.appendChild(el('span', { style: { fontSize: '12px', color: 'var(--text2)' } }, '(PDF not available for this template)'))
        }
        resultPanel.appendChild(links)

        resultPanel.appendChild(el('p', { style: { fontSize: '11px', color: 'var(--text2)', marginTop: '16px' } },
          'In production: PDF runs through ensurePrintReady() for bleed + DPI + CMYK conversion'
        ))

        log('log-panel-pdf', 'PNG: ' + pdfData.image_url, 'success')
        log('log-panel-pdf', 'PDF: ' + (pdfData.pdf_url || 'N/A'), pdfData.pdf_url ? 'success' : 'warn')
        const renderTime = Math.round((new Date(pdfData.updated_at) - new Date(pdfData.created_at)) / 1000)
        log('log-panel-pdf', 'Render time: ' + renderTime + 's', 'info')
        log('log-panel-pdf', 'Next in production: ensurePrintReady() adds bleed + DPI + CMYK', 'info')
      } else if (pdfData.status === 'failed') {
        document.getElementById('pdf-loading').style.display = 'none'
        log('log-panel-pdf', 'Render failed', 'error')
      } else {
        log('log-panel-pdf', 'Still rendering...', '')
        setTimeout(pollPdf, 2000)
      }
    }
    setTimeout(pollPdf, 3000)
  } catch (err) {
    document.getElementById('pdf-loading').style.display = 'none'
    log('log-panel-pdf', 'Error: ' + err.message, 'error')
  }
})

// ─── Helpers ───
function shiftHue(hex, degrees) {
  let r = parseInt(hex.slice(1, 3), 16) / 255
  let g = parseInt(hex.slice(3, 5), 16) / 255
  let b = parseInt(hex.slice(5, 7), 16) / 255
  let max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h, s, l = (max + min) / 2
  if (max === min) { h = s = 0 }
  else {
    let d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }
  h = ((h * 360 + degrees) % 360) / 360
  if (h < 0) h += 1
  function hue2rgb(p, q, t) {
    if (t < 0) t += 1; if (t > 1) t -= 1
    if (t < 1/6) return p + (q - p) * 6 * t
    if (t < 1/2) return q
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6
    return p
  }
  let q2 = l < 0.5 ? l * (1 + s) : l + s - l * s
  let p2 = 2 * l - q2
  r = Math.round(hue2rgb(p2, q2, h + 1/3) * 255)
  g = Math.round(hue2rgb(p2, q2, h) * 255)
  b = Math.round(hue2rgb(p2, q2, h - 1/3) * 255)
  return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
}

function resetDemo() {
  selectedTemplate = null
  selectedProof = null
  proofResults = []
  logoData = null
  goToStep(1)
  document.querySelectorAll('.template-card').forEach(c => c.classList.remove('selected'))
  document.getElementById('btn-next-1').disabled = true
}

// ─── Navigation wiring ───
document.getElementById('btn-next-1').addEventListener('click', () => {
  if (!selectedTemplate) return
  goToStep(2)

  const layers = selectedTemplate.available_modifications || []
  const layersInfo = document.getElementById('template-layers-info')
  const layersList = clearEl('layers-list')
  layersInfo.style.display = 'block'

  if (layers.length > 0) {
    layers.forEach(l => {
      const type = l.image_url !== undefined ? 'image' : l.color !== undefined ? 'color' : 'text'
      layersList.appendChild(el('div', { className: 'layer-item' }, [
        el('span', { className: 'layer-type' }, type),
        el('strong', null, l.name),
      ]))
    })
  } else {
    layersList.appendChild(el('div', { className: 'warning-box' }, 'This template has no layers. Add them in the Bannerbear editor first.'))
  }
})

document.getElementById('btn-next-2').addEventListener('click', () => goToStep(3))
document.getElementById('btn-back-2').addEventListener('click', () => goToStep(1))
document.getElementById('btn-back-3').addEventListener('click', () => goToStep(2))
document.getElementById('btn-back-4').addEventListener('click', () => goToStep(3))
document.getElementById('btn-generate').addEventListener('click', generateProofs)
document.getElementById('btn-reset').addEventListener('click', resetDemo)

// ─── Init ───
loadTemplates()
