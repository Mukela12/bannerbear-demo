// ─── Config ───
const API_BASE = ''

// ─── Field definitions: layer name → form field config ───
// Layer names in Bannerbear templates should match the keys below for auto-population.
const FIELD_DEFINITIONS = {
  business_name:    { label: 'Business Name',    type: 'text',     default: 'Mountain Brew Coffee',          kind: 'text' },
  contact_name:     { label: 'Contact Name',     type: 'text',     default: 'Sarah Mitchell',                kind: 'text' },
  agent_name:       { label: 'Agent Name',       type: 'text',     default: 'Sarah Mitchell',                kind: 'text' },
  title:            { label: 'Job Title',        type: 'text',     default: 'Founder & Head Roaster',        kind: 'text' },
  tagline:          { label: 'Tagline',          type: 'text',     default: 'Handcrafted coffee, mountain fresh', kind: 'text' },
  phone:            { label: 'Phone',            type: 'text',     default: '(828) 555-0199',                kind: 'text' },
  email:            { label: 'Email',            type: 'text',     default: 'hello@mountainbrew.com',        kind: 'text' },
  website:          { label: 'Website',          type: 'text',     default: 'mountainbrew.com',              kind: 'text' },
  address:          { label: 'Address',          type: 'text',     default: '123 Main St, Asheville NC',     kind: 'text' },
  headline:         { label: 'Headline',         type: 'text',     default: 'GRAND OPENING',                 kind: 'text' },
  subheadline:      { label: 'Subheadline',      type: 'text',     default: 'This Saturday · 9am – 5pm',     kind: 'text' },
  body_text:        { label: 'Body Text',        type: 'textarea', default: 'Join us for our grand opening celebration. Free samples all day, live music, and giveaways.', kind: 'text' },
  cta:              { label: 'Call to Action',   type: 'text',     default: 'VISIT US TODAY',                kind: 'text' },
  date:             { label: 'Event Date',       type: 'text',     default: 'Saturday, May 17',              kind: 'text' },
  price:            { label: 'Price',            type: 'text',     default: '$499,000',                      kind: 'text' },
  property_address: { label: 'Property Address', type: 'text',     default: '42 Summit Ridge Rd, Asheville', kind: 'text' },
  beds_baths:       { label: 'Beds / Baths',     type: 'text',     default: '4 BD · 3 BA · 2,400 sqft',      kind: 'text' },
  logo:             { label: 'Logo',             type: 'file',     kind: 'image' },
  headshot:         { label: 'Headshot / Photo', type: 'file',     kind: 'image' },
  background_image: { label: 'Background Image', type: 'file',     kind: 'image' },
  background:       { label: 'Background Color', type: 'color',    kind: 'color' },
  accent:           { label: 'Accent Color',     type: 'color',    kind: 'color' },
}

// ─── 4 most popular PrintAI product types ───
const PRODUCT_TYPES = [
  {
    id: 'business_card',
    name: 'Business Card',
    dimensions: '1050 × 600 px  (3.5" × 2")',
    description: 'Personal contact cards for agents, consultants, and small businesses. Often includes a headshot for realtors and sales professionals.',
    fields: [
      'business_name', 'contact_name', 'title', 'tagline',
      'phone', 'email', 'website', 'address',
      'logo', 'headshot',
      'background', 'accent',
    ],
  },
  {
    id: 'flyer',
    name: 'Flyer',
    dimensions: '1275 × 1650 px  (8.5" × 11")',
    description: 'Promotional single-page handouts for events, sales, and announcements. Usually hero image plus detail copy.',
    fields: [
      'headline', 'subheadline', 'body_text', 'cta', 'date',
      'business_name', 'phone', 'website', 'address',
      'logo', 'background_image',
      'background', 'accent',
    ],
  },
  {
    id: 'yard_sign',
    name: 'Yard Sign',
    dimensions: '3600 × 2700 px  (24" × 18")',
    description: 'Real estate, political, and promotional lawn signs. Real estate versions usually have agent headshot + price + property details.',
    fields: [
      'headline', 'price', 'property_address', 'beds_baths',
      'agent_name', 'phone', 'website',
      'logo', 'headshot',
      'background', 'accent',
    ],
  },
  {
    id: 'banner',
    name: 'Banner',
    dimensions: '5000 × 2500 px  (40" × 20" and up)',
    description: 'Large-format outdoor / indoor banners for events, grand openings, and promotions.',
    fields: [
      'headline', 'subheadline', 'cta', 'date',
      'business_name', 'phone', 'website',
      'logo', 'background_image',
      'background', 'accent',
    ],
  },
]

// ─── State ───
let selectedTemplate = null
let selectedProof = null
let proofResults = []
let allTemplates = []
let activeFields = []  // list of field names currently visible in the form
// Map of layer name → { logoId, logoUrl, colors } for uploaded images.
// For color extraction we prefer the logo; headshots/backgrounds are uploaded but not used for palette.
let uploadedImages = {}
// Shortcut: the "primary" image used for palette extraction (the logo, if present)
let logoData = null

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

// ─── Render product types reference ───
function renderProductTypes() {
  const grid = document.getElementById('product-types-grid')
  if (!grid) return
  while (grid.firstChild) grid.removeChild(grid.firstChild)
  PRODUCT_TYPES.forEach(p => {
    const fieldChips = el('div', { className: 'field-chips' })
    p.fields.forEach(f => {
      const def = FIELD_DEFINITIONS[f]
      if (!def) return
      fieldChips.appendChild(el('span', { className: 'chip chip-' + def.kind }, f))
    })
    const card = el('div', { className: 'product-type-card' }, [
      el('h4', null, p.name),
      el('div', { className: 'product-type-dims' }, p.dimensions),
      el('div', { className: 'product-type-desc' }, p.description),
      el('div', { className: 'product-type-fields-label' }, 'Required layers:'),
      fieldChips,
    ])
    grid.appendChild(card)
  })
}

// ─── Dynamic form builder (based on template's detected layers) ───
function buildDynamicForm(template) {
  const form = clearEl('dynamic-form')
  clearEl('image-uploads')
  const emptyMsg = document.getElementById('dynamic-form-empty')
  activeFields = []
  uploadedImages = {}
  logoData = null

  const layers = (template && template.available_modifications) || []
  if (layers.length === 0) {
    emptyMsg.style.display = 'block'
    return
  }
  emptyMsg.style.display = 'none'

  // Match layers to known field definitions by name (case-insensitive, normalize)
  const normalize = s => String(s || '').toLowerCase().replace(/[\s-]+/g, '_')
  const matched = new Set()

  layers.forEach(layer => {
    const n = normalize(layer.name)
    let def = FIELD_DEFINITIONS[n]
    let fieldKey = n

    // Loose matching fallbacks for common non-standard names
    if (!def) {
      if      (/headshot|portrait|face|avatar|profile/.test(n))            { def = FIELD_DEFINITIONS.headshot;     fieldKey = 'headshot' }
      else if (/logo|brand_image|brandmark/.test(n))                       { def = FIELD_DEFINITIONS.logo;         fieldKey = 'logo' }
      else if (/photo|bg_image|hero|cover|image|picture/.test(n))          { def = FIELD_DEFINITIONS.background_image; fieldKey = 'background_image' }
      else if (/subhead|sub_title|subtitle/.test(n))                       { def = FIELD_DEFINITIONS.subheadline;  fieldKey = 'subheadline' }
      else if (/headline|heading|^title$|main_title/.test(n))              { def = FIELD_DEFINITIONS.headline;     fieldKey = 'headline' }
      else if (/tagline|slogan/.test(n))                                   { def = FIELD_DEFINITIONS.tagline;      fieldKey = 'tagline' }
      else if (/phone|tel|mobile|cell/.test(n))                            { def = FIELD_DEFINITIONS.phone;        fieldKey = 'phone' }
      else if (/mail/.test(n))                                             { def = FIELD_DEFINITIONS.email;        fieldKey = 'email' }
      else if (/web|url|site/.test(n))                                     { def = FIELD_DEFINITIONS.website;      fieldKey = 'website' }
      else if (/property_addr|listing_addr/.test(n))                       { def = FIELD_DEFINITIONS.property_address; fieldKey = 'property_address' }
      else if (/addr|location/.test(n))                                    { def = FIELD_DEFINITIONS.address;      fieldKey = 'address' }
      else if (/agent|realtor|broker/.test(n))                             { def = FIELD_DEFINITIONS.agent_name;   fieldKey = 'agent_name' }
      else if (/bed|bath|sqft|specs/.test(n))                              { def = FIELD_DEFINITIONS.beds_baths;   fieldKey = 'beds_baths' }
      else if (/price|cost|\$/.test(n))                                    { def = FIELD_DEFINITIONS.price;        fieldKey = 'price' }
      else if (/body|descr|paragraph|details/.test(n))                     { def = FIELD_DEFINITIONS.body_text;    fieldKey = 'body_text' }
      else if (/cta|button|action/.test(n))                                { def = FIELD_DEFINITIONS.cta;          fieldKey = 'cta' }
      else if (/date|when|event_time/.test(n))                             { def = FIELD_DEFINITIONS.date;         fieldKey = 'date' }
      else if (/job_title|role|position/.test(n))                          { def = FIELD_DEFINITIONS.title;        fieldKey = 'title' }
      else if (/contact_name|full_name|person/.test(n))                    { def = FIELD_DEFINITIONS.contact_name; fieldKey = 'contact_name' }
      else if (/name|company|brand/.test(n))                               { def = FIELD_DEFINITIONS.business_name; fieldKey = 'business_name' }
      else if (/bg|background/.test(n))                                    { def = FIELD_DEFINITIONS.background;   fieldKey = 'background' }
      else if (/accent|stripe|bar|divider/.test(n))                        { def = FIELD_DEFINITIONS.accent;       fieldKey = 'accent' }
    }

    if (!def || matched.has(fieldKey)) return
    matched.add(fieldKey)

    // Store the layer-name → field-key mapping on the template for later use
    if (!template._layerMap) template._layerMap = {}
    template._layerMap[layer.name] = fieldKey

    activeFields.push({ key: fieldKey, layerName: layer.name, def })
  })

  // Render text fields into the grid
  activeFields.filter(f => f.def.kind === 'text').forEach(f => {
    const group = el('div', { className: 'form-group' })
    group.appendChild(el('label', null, f.def.label + '  '))
    group.appendChild(el('span', { className: 'layer-ref' }, '→ ' + f.layerName))
    const input = f.def.type === 'textarea'
      ? el('textarea', { id: 'field-' + f.key, rows: '3' })
      : el('input', { type: 'text', id: 'field-' + f.key })
    if (f.def.default) input.value = f.def.default
    group.appendChild(input)
    form.appendChild(group)
  })

  // Build one upload slot per image field (logo, headshot, background_image, etc.)
  const imageFields = activeFields.filter(f => f.def.kind === 'image')
  buildImageUploadSlots(imageFields)
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

// ─── Step 2: Dynamic image upload slots (per image layer) ───
function buildImageUploadSlots(imageFields) {
  const container = clearEl('image-uploads')
  if (imageFields.length === 0) return

  imageFields.forEach(f => {
    const slotId = 'img-slot-' + f.key
    const inputId = 'img-input-' + f.key

    const wrapper = el('div', { className: 'form-group', style: { marginBottom: '12px' } })
    const labelRow = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' } }, [
      el('label', { style: { marginBottom: '0' } }, f.def.label),
      el('span', { className: 'layer-ref' }, '→ ' + f.layerName),
    ])
    wrapper.appendChild(labelRow)

    const drop = el('div', { className: 'logo-upload', id: slotId })
    const fileInput = el('input', { type: 'file', id: inputId, accept: 'image/*', style: { display: 'none' } })
    drop.appendChild(fileInput)
    drop.appendChild(el('p', { style: { fontSize: '13px', color: 'var(--text2)' } }, 'Click to upload ' + f.def.label.toLowerCase()))

    drop.addEventListener('click', () => fileInput.click())
    fileInput.addEventListener('change', e => handleImageUpload(e, f, drop))

    wrapper.appendChild(drop)

    // Colors panel (only shown for logo uploads since we extract palette from the logo)
    if (f.key === 'logo') {
      const colorsEl = el('div', { id: 'logo-colors-' + f.key, style: { display: 'none' } }, [
        el('p', { style: { fontSize: '12px', color: 'var(--text2)', marginTop: '8px' } }, 'Extracted colors:'),
        el('div', { className: 'color-swatches', id: 'color-swatches-' + f.key }),
      ])
      wrapper.appendChild(colorsEl)
    }

    container.appendChild(wrapper)
  })
}

async function handleImageUpload(e, field, dropEl) {
  const file = e.target.files[0]
  if (!file) return

  // Rebuild drop area with preview
  while (dropEl.firstChild) dropEl.removeChild(dropEl.firstChild)
  dropEl.classList.add('has-file')
  dropEl.appendChild(e.target)  // keep the input element for future changes
  dropEl.appendChild(el('img', { className: 'logo-preview', src: URL.createObjectURL(file), alt: field.def.label }))
  dropEl.appendChild(el('p', { style: { fontSize: '12px', color: 'var(--green)', marginTop: '4px' } }, file.name))

  const form = new FormData()
  form.append('logo', file)
  try {
    const res = await fetch(API_BASE + '/api/upload-logo', { method: 'POST', body: form })
    const data = await res.json()
    uploadedImages[field.layerName] = data

    // If this is the logo, store it as the color-extraction source and show swatches
    if (field.key === 'logo') {
      logoData = data
      const colorsEl = document.getElementById('logo-colors-' + field.key)
      const swatchesEl = clearEl('color-swatches-' + field.key)
      if (colorsEl) colorsEl.style.display = 'block'
      data.colors.all.forEach(c => {
        swatchesEl.appendChild(el('div', { className: 'swatch', style: { background: c }, title: c }))
      })
      swatchesEl.appendChild(el('span', { style: { fontSize: '12px', color: 'var(--text2)', marginLeft: '8px' } },
        'Primary: ' + data.colors.primary + ' | Secondary: ' + data.colors.secondary + ' | Accent: ' + data.colors.accent
      ))
    }
  } catch (err) {
    console.error('Image upload failed:', err)
  }
}

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

  // Build text fields from the dynamic form (keyed by actual layer name)
  const textFields = {}
  activeFields.filter(f => f.def.kind === 'text').forEach(f => {
    const input = document.getElementById('field-' + f.key)
    if (input && input.value) textFields[f.layerName] = input.value
  })

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

  const origin = API_BASE || window.location.origin
  const logoUrl = logoData ? origin + '/api/logos/' + logoData.logoId : null

  // Build per-layer image map (logo, headshot, background_image, etc.)
  const imageFields = {}
  Object.entries(uploadedImages).forEach(([layerName, data]) => {
    imageFields[layerName] = origin + '/api/logos/' + data.logoId
  })

  log('log-panel', 'Sending 3 render requests to Bannerbear...', 'info')
  if (Object.keys(imageFields).length) log('log-panel', 'Image fields: ' + Object.keys(imageFields).join(', '), 'info')

  try {
    const res = await fetch(API_BASE + '/api/generate-proofs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template_uid: selectedTemplate.uid,
        text_fields: textFields,
        logo_url: logoUrl,  // legacy single-logo fallback
        image_fields: imageFields,
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
    const modifications = []
    // Text mods from the dynamic form
    activeFields.filter(f => f.def.kind === 'text').forEach(f => {
      const input = document.getElementById('field-' + f.key)
      if (input && input.value) modifications.push({ name: f.layerName, text: input.value })
    })
    // Image mods — one per uploaded image field (logo, headshot, background_image, etc.)
    const origin = API_BASE || window.location.origin
    Object.entries(uploadedImages).forEach(([layerName, data]) => {
      modifications.push({ name: layerName, image_url: origin + '/api/logos/' + data.logoId })
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
  uploadedImages = {}
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

  // Build dynamic form based on detected layers
  buildDynamicForm(selectedTemplate)
})

document.getElementById('btn-next-2').addEventListener('click', () => goToStep(3))
document.getElementById('btn-back-2').addEventListener('click', () => goToStep(1))
document.getElementById('btn-back-3').addEventListener('click', () => goToStep(2))
document.getElementById('btn-back-4').addEventListener('click', () => goToStep(3))
document.getElementById('btn-generate').addEventListener('click', generateProofs)
document.getElementById('btn-reset').addEventListener('click', resetDemo)

// ─── Init ───
renderProductTypes()
loadTemplates()
