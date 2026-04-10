const express = require('express')
const path = require('path')
const multer = require('multer')
const sharp = require('sharp')

const app = express()
const PORT = process.env.PORT || 4000
const BB_API_KEY = process.env.BANNERBEAR_API_KEY || 'bb_pr_f70070a567c20a6a1633cc47601a27'
const BB_BASE = 'https://api.bannerbear.com/v2'
const BB_SYNC = 'https://sync.api.bannerbear.com/v2'

// CORS — allow Vercel frontend
const CLIENT_URL = process.env.CLIENT_URL || '*'
app.use((req, res, next) => {
  const origin = req.headers.origin
  if (CLIENT_URL === '*' || (origin && CLIENT_URL.split(',').some(u => origin.startsWith(u.trim())))) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*')
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

app.use(express.json())

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

// Store uploaded logos in memory for demo (keyed by a simple id)
const logoStore = new Map()

// ─── Bannerbear API helpers ───

async function bbFetch(endpoint, options = {}) {
  const url = `${options.sync ? BB_SYNC : BB_BASE}${endpoint}`
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${BB_API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Bannerbear ${res.status}: ${text}`)
  }
  return res.json()
}

// ─── Routes ───

// List all templates
app.get('/api/templates', async (req, res) => {
  try {
    const templates = await bbFetch('/templates')
    res.json(templates)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Get single template details
app.get('/api/templates/:uid', async (req, res) => {
  try {
    const template = await bbFetch(`/templates/${req.params.uid}`)
    res.json(template)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Upload logo and extract colors
app.post('/api/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

    const id = Date.now().toString(36)
    const buffer = req.file.buffer

    // Extract dominant colors using Sharp (pixel sampling approach)
    const colors = await extractColors(buffer)

    // Store for later use
    logoStore.set(id, {
      buffer,
      mimetype: req.file.mimetype,
      colors,
    })

    res.json({
      logoId: id,
      logoUrl: `/api/logos/${id}`,
      colors,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Serve uploaded logo (public URL for Bannerbear to fetch)
app.get('/api/logos/:id', (req, res) => {
  const logo = logoStore.get(req.params.id)
  if (!logo) return res.status(404).json({ error: 'Logo not found' })
  res.setHeader('Content-Type', logo.mimetype)
  res.setHeader('Cache-Control', 'public, max-age=3600')
  res.send(logo.buffer)
})

// Generate a single proof (async — returns immediately, poll for result)
app.post('/api/render', async (req, res) => {
  try {
    const { template_uid, modifications, render_pdf } = req.body
    if (!template_uid) return res.status(400).json({ error: 'template_uid required' })

    const payload = {
      template: template_uid,
      modifications: modifications || [],
      render_pdf: render_pdf || false,
      metadata: JSON.stringify({ demo: true, timestamp: Date.now() }),
    }

    // Use async API
    const result = await bbFetch('/images', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Generate a single proof (sync — waits for result, up to 10s)
app.post('/api/render-sync', async (req, res) => {
  try {
    const { template_uid, modifications, render_pdf } = req.body
    if (!template_uid) return res.status(400).json({ error: 'template_uid required' })

    const payload = {
      template: template_uid,
      modifications: modifications || [],
      render_pdf: render_pdf || false,
      metadata: JSON.stringify({ demo: true, timestamp: Date.now() }),
    }

    const result = await bbFetch('/images', {
      sync: true,
      method: 'POST',
      body: JSON.stringify(payload),
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Generate 3 proof variants (the core PrintAI flow)
app.post('/api/generate-proofs', async (req, res) => {
  try {
    const { template_uid, text_fields, logo_url, image_fields, palettes } = req.body
    if (!template_uid) return res.status(400).json({ error: 'template_uid required' })

    // First, get template to know available layers
    const template = await bbFetch(`/templates/${template_uid}`)
    const availableLayers = template.available_modifications || []

    if (availableLayers.length === 0) {
      return res.json({
        warning: 'This template has no modifiable layers. Add text/image layers in the Bannerbear editor first.',
        template_name: template.name,
        template_uid: template.uid,
        proofs: [],
      })
    }

    // Build 3 variant payloads
    const defaultPalettes = palettes || [
      { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560' },
      { primary: '#0f3460', secondary: '#533483', accent: '#e94560' },
      { primary: '#2d3436', secondary: '#636e72', accent: '#fdcb6e' },
    ]

    const proofPromises = defaultPalettes.map((palette, index) => {
      const modifications = []

      // Map text fields to available text layers
      for (const layer of availableLayers) {
        if (text_fields && text_fields[layer.name]) {
          modifications.push({ name: layer.name, text: text_fields[layer.name] })
        }
        // Per-layer image map takes priority (logo, headshot, background_image, etc.)
        if (image_fields && image_fields[layer.name]) {
          modifications.push({ name: layer.name, image_url: image_fields[layer.name] })
        } else if (logo_url && /logo|face/i.test(layer.name)) {
          // Legacy fallback: single logo URL applied to any logo/face layer
          modifications.push({ name: layer.name, image_url: logo_url })
        }
        // Apply palette colors to color-capable layers
        if (layer.color !== undefined || layer.background !== undefined) {
          if (layer.name.toLowerCase().includes('background') || layer.name.toLowerCase().includes('bg')) {
            modifications.push({ name: layer.name, background: palette.primary })
          } else if (layer.name.toLowerCase().includes('accent')) {
            modifications.push({ name: layer.name, color: palette.accent })
          }
        }
      }

      return bbFetch('/images', {
        method: 'POST',
        body: JSON.stringify({
          template: template_uid,
          modifications,
          render_pdf: false,
          metadata: JSON.stringify({ variant: index + 1, palette }),
        }),
      })
    })

    const proofs = await Promise.all(proofPromises)

    res.json({
      template_name: template.name,
      template_uid: template.uid,
      available_layers: availableLayers,
      proofs: proofs.map((p, i) => ({
        variant: i + 1,
        uid: p.uid,
        status: p.status,
        image_url: p.image_url,
        palette: defaultPalettes[i],
      })),
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Poll render status
app.get('/api/renders/:uid', async (req, res) => {
  try {
    const result = await bbFetch(`/images/${req.params.uid}`)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Approve a proof → re-render as PDF
app.post('/api/approve', async (req, res) => {
  try {
    const { template_uid, modifications } = req.body

    const result = await bbFetch('/images', {
      method: 'POST',
      body: JSON.stringify({
        template: template_uid,
        modifications: modifications || [],
        render_pdf: true,
        metadata: JSON.stringify({ approved: true, timestamp: Date.now() }),
      }),
    })

    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── Color extraction using Sharp ───

async function extractColors(buffer) {
  try {
    // Resize to small for fast color sampling
    const { data, info } = await sharp(buffer)
      .resize(50, 50, { fit: 'cover' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true })

    // Count pixel colors and find dominant ones
    const colorCounts = new Map()
    for (let i = 0; i < data.length; i += 3) {
      const r = Math.round(data[i] / 32) * 32
      const g = Math.round(data[i + 1] / 32) * 32
      const b = Math.round(data[i + 2] / 32) * 32
      const key = `${r},${g},${b}`
      colorCounts.set(key, (colorCounts.get(key) || 0) + 1)
    }

    // Sort by frequency, take top 5
    const sorted = [...colorCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([rgb]) => {
        const [r, g, b] = rgb.split(',').map(Number)
        return '#' + [r, g, b].map(c => c.toString(16).padStart(2, '0')).join('')
      })

    // Filter out near-white and near-black
    const filtered = sorted.filter(hex => {
      const r = parseInt(hex.slice(1, 3), 16)
      const g = parseInt(hex.slice(3, 5), 16)
      const b = parseInt(hex.slice(5, 7), 16)
      const brightness = (r + g + b) / 3
      return brightness > 30 && brightness < 230
    })

    const colors = filtered.length >= 3 ? filtered : sorted
    return {
      primary: colors[0] || '#1a1a2e',
      secondary: colors[1] || '#16213e',
      accent: colors[2] || '#e94560',
      all: colors,
    }
  } catch {
    return { primary: '#1a1a2e', secondary: '#16213e', accent: '#e94560', all: [] }
  }
}

// ─── Start ───

app.listen(PORT, () => {
  console.log(`\n  Bannerbear Demo running at http://localhost:${PORT}\n`)
  console.log(`  API Key: ${BB_API_KEY.slice(0, 12)}...`)
  console.log(`  Endpoints:`)
  console.log(`    GET  /api/templates          — list all Bannerbear templates`)
  console.log(`    POST /api/generate-proofs    — generate 3 proof variants`)
  console.log(`    POST /api/render-sync        — single synchronous render`)
  console.log(`    POST /api/approve            — approve & render PDF`)
  console.log(`    POST /api/upload-logo        — upload logo + extract colors`)
  console.log(`    GET  /api/renders/:uid       — poll render status\n`)
})
