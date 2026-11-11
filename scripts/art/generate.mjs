#!/usr/bin/env node
/*
 * Generates the sign-in screen background with OpenAI's image model.
 *
 *   node scripts/art/generate.mjs <out-dir> [--only=name,name] [--force] [--list]
 *
 * ART_ENV points at the env file holding OPENAI_API_KEY (default: .env.art at
 * the repo root, git-ignored). The key is never printed. ART_MODEL and
 * ART_QUALITY override the model and quality. Raw PNGs go to <out-dir>, and
 * existing ones are skipped unless --force. scripts/art/build.sh <out-dir>
 * then makes the web versions in web-v2/public/login.
 */
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)
const outDir = args.find(a => !a.startsWith('--'))
const only = args.find(a => a.startsWith('--only='))?.slice(7).split(',').filter(Boolean)
const force = args.includes('--force')
const listOnly = args.includes('--list')

// A fine-dining room after dark, lit in the Cafyz violet and electric blue. The
// scene sits in the top half (logo over the dark ceiling, a silver cloche on the
// left beside the welcome line); the lower half falls away into the screen's
// deep indigo so the sign-in form sits on calm, near-black ground.
const SCENES = [
  {
    name: 'neon-dining',
    size: '1024x1536',
    prompt:
      'Cinematic, photorealistic interior of an upscale modern fine-dining restaurant at night, vertical frame. ' +
      'Composition: the TOP 15 percent is a very dark, almost black indigo ceiling with nothing in it. ' +
      'In the upper-middle band (from about 15 to 50 percent of the height): on the LEFT, in the foreground, a gleaming polished silver cloche ' +
      '(a domed food cover with a round knob on top) resting on a dark glossy wooden table edge, catching violet and electric-blue reflections; ' +
      'behind it on the far left, a lush tropical plant in shadow and slim vertical violet neon light strips on a dark wall. ' +
      'On the RIGHT side, out of focus in the background: an elegant dining area with a few warm golden pendant lamps, empty tables with glasses, ' +
      'and a sweeping curved violet neon cove light along the ceiling edge. The centre of the frame above the cloche is dark, soft and uncluttered. ' +
      'The LOWER HALF of the frame (from 55 percent down) is a smooth, empty, near-black deep indigo and midnight navy gradient with no objects, ' +
      'only a faint violet glow at the bottom-left corner and a faint electric-blue glow at the bottom-right corner. ' +
      'Colour grade: deep indigo (#070511, #0A0B2D, #100B3D), neon violet (#B444FF, #A020F0) and electric blue (#007BFF) light, ' +
      'tiny touches of warm amber from the pendant lamps only. Luxurious, moody, premium, shallow depth of field, soft bokeh, fine detail. ' +
      'No people. Absolutely no text, no letters, no numbers, no signage, no logos, no watermark.',
  },
  // The band behind the logo at the top of the app's sidebar: a wide strip of the same
  // dining room, far out of focus, with a calm dark centre for the logo to sit on.
  {
    name: 'sidebar-brand',
    size: '1536x1024',
    prompt:
      'Wide cinematic banner, photorealistic and abstract: the interior of a luxury fine-dining restaurant at night, completely out of focus. ' +
      'Composition: the CENTRE third of the frame is very dark, calm and empty, a soft near-black midnight navy. ' +
      'From the LEFT edge, a smooth curved ribbon of violet neon cove light sweeps upward and fades before reaching the centre; ' +
      'from the RIGHT edge, a second thinner curved ribbon of electric-purple light mirrors it, with a faint indigo-blue haze behind it. ' +
      'Far in the background at both edges only: a few tiny soft bokeh dots from distant lamps, and the faint reflection of light on polished dark glass. ' +
      'The BOTTOM quarter of the frame falls away into smooth, flat near-black navy with no detail. ' +
      'Colour grade: near-black navy (#05040D, #080714, #090716), violet and electric purple light (#8B2CFF, #A735FF, #BD4AFF), ' +
      'a little deep indigo blue (#101B45). No other colours, no warm tones. Elegant, restrained, premium, soft glow, fine grain-free gradients. ' +
      'No people, no objects in focus. Absolutely no text, no letters, no numbers, no signage, no logos, no watermark.',
  },  // The full-height ground of the app's sidebar. The menu is read over it all day, so the
  // image is nearly all calm dark navy: light only at the top edge and the bottom corner.
  {
    name: 'sidebar-bg',
    size: '1024x1536',
    prompt:
      'Tall vertical abstract background for the navigation sidebar of a premium dark software interface. ' +
      'Almost the whole frame is a smooth, calm, near-black midnight navy (#080619, #0B0820) with a very gentle vertical gradient and no detail at all, ' +
      'because a list of menu text will sit on top of it and must stay perfectly readable. ' +
      'Only at the edges: in the TOP 12 percent, a soft glow of violet light (#A020F0, #6C35FF) like light falling from above, fading quickly downward; ' +
      'along the far LEFT edge, one very thin, very faint vertical ribbon of violet silk light that curves slightly and fades in and out; ' +
      'in the BOTTOM 18 percent, two or three soft, wide, flowing waves of translucent violet and indigo-blue glass or silk, low contrast, dark, elegant, ' +
      'with a faint electric-blue (#00D4FF at very low strength) highlight on one wave crest. ' +
      'The middle 65 percent of the frame is empty dark navy. Luxurious, restrained, modern, like the wallpaper of a high-end device. ' +
      'Fine smooth gradients with no banding and no noise. No objects, no people, no shapes that look like icons. ' +
      'Absolutely no text, no letters, no numbers, no logos, no watermark.',
  },
  {
    name: 'logo-a-cloche',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      'A premium brand logo for a restaurant management software called CAFYZ. An emblem above a wordmark. ' +
      'The emblem: a minimal, elegant restaurant cloche (domed food cover with a small round knob) drawn as one continuous glowing violet line that also forms the letter C around it, with a subtle glossy gradient from electric violet to deep indigo. ' +
      'Below it the wordmark CAFYZ in a refined, wide, geometric sans-serif in capital letters with slightly rounded terminals, in silver-white with a faint lavender tint. ' +
      'The artwork is centred with generous empty margin on all sides, on a fully transparent background: no backdrop, no plate, no shadow on a surface, no frame. ' +
      'Colours only from this family: electric violet (#8B2CFF, #A735FF, #BD4AFF), deep indigo (#3820A0, #24134D), soft lavender (#B9A7E8) and polished silver-white highlights. ' +
      'Premium, precise, modern luxury technology brand; crisp clean edges; reads clearly at small sizes. ' +
      'The only text anywhere is the single word CAFYZ, spelled exactly C-A-F-Y-Z. No tagline, no other words, no watermark.',
  },
  {
    name: 'logo-b-wordmark',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      'A premium wordmark logo for a restaurant management software called CAFYZ. No separate icon. ' +
      'The word CAFYZ in bold custom geometric capital letters with smooth, confident curves, filled with a rich glossy gradient running from bright electric violet on the left to deep indigo on the right, ' +
      'with a thin polished silver edge highlight along the top of each letter. The letter A has no crossbar and a small violet spark-shaped dot sits inside it, like a point of light. ' +
      'The artwork is centred with generous empty margin on all sides, on a fully transparent background: no backdrop, no plate, no shadow on a surface, no frame. ' +
      'Colours only from this family: electric violet (#8B2CFF, #A735FF, #BD4AFF), deep indigo (#3820A0, #24134D), soft lavender (#B9A7E8) and polished silver-white highlights. ' +
      'Premium, precise, modern luxury technology brand; crisp clean edges; reads clearly at small sizes. ' +
      'The only text anywhere is the single word CAFYZ, spelled exactly C-A-F-Y-Z. No tagline, no other words, no watermark.',
  },
  {
    name: 'logo-c-shield',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      'A premium brand logo for a restaurant management software called CAFYZ. A badge above a wordmark. ' +
      'The badge: a modern faceted shield with softly rounded corners, made of dark indigo glass with a glowing electric-violet rim and bevelled silver edge; inside it a bold stylised letter C whose opening holds a simple fork silhouette. ' +
      'Below the badge the wordmark CAFYZ in clean, wide, capital sans-serif letters in polished silver with a soft violet inner glow. ' +
      'The artwork is centred with generous empty margin on all sides, on a fully transparent background: no backdrop, no plate, no shadow on a surface, no frame. ' +
      'Colours only from this family: electric violet (#8B2CFF, #A735FF, #BD4AFF), deep indigo (#3820A0, #24134D), soft lavender (#B9A7E8) and polished silver-white highlights. ' +
      'Premium, precise, modern luxury technology brand; crisp clean edges; reads clearly at small sizes. ' +
      'The only text anywhere is the single word CAFYZ, spelled exactly C-A-F-Y-Z. No tagline, no other words, no watermark.',
  },
  {
    name: 'logo-d-ribbon',
    size: '1024x1024',
    background: 'transparent',
    prompt:
      'A premium brand logo for a restaurant management software called CAFYZ. A mark to the left of a wordmark, arranged in one horizontal line. ' +
      'The mark: a letter C formed by a single smooth curved ribbon of violet neon light, thicker in the middle and tapering at both ends, with a gradient from bright violet to deep indigo and a tiny bright highlight at its upper tip, like the lit rim of a plate seen from above. ' +
      'To its right the wordmark CAFYZ in elegant medium-weight capital sans-serif letters with wide spacing, in soft silver-white. ' +
      'The artwork is centred with generous empty margin on all sides, on a fully transparent background: no backdrop, no plate, no shadow on a surface, no frame. ' +
      'Colours only from this family: electric violet (#8B2CFF, #A735FF, #BD4AFF), deep indigo (#3820A0, #24134D), soft lavender (#B9A7E8) and polished silver-white highlights. ' +
      'Premium, precise, modern luxury technology brand; crisp clean edges; reads clearly at small sizes. ' +
      'The only text anywhere is the single word CAFYZ, spelled exactly C-A-F-Y-Z. No tagline, no other words, no watermark.',
  },
]

const envFile = process.env.ART_ENV || path.join(root, '.env.art')
const env = await fs.readFile(envFile, 'utf8').catch(() => '')
const key = env.match(/^OPENAI_API_KEY=\s*["']?([^\s"']+)/m)?.[1]
if (!key) {
  console.error(`No OPENAI_API_KEY in ${envFile}`)
  process.exit(1)
}

async function api(route, body) {
  const res = await fetch(`https://api.openai.com/v1${route}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const err = new Error(`${res.status} ${json?.error?.message || res.statusText}`.replace(/sk-[\w-]+/g, 'sk-…'))
    err.status = res.status
    throw err
  }
  return json
}

const ids = (await api('/models')).data.map(m => m.id)
const imageModels = ids.filter(id => id.startsWith('gpt-image')).sort()
console.log(`image models: ${imageModels.join(', ') || 'none'}`)
if (listOnly) process.exit(0)
if (!outDir) {
  console.error('Usage: node scripts/art/generate.mjs <out-dir> [--only=a,b] [--force] [--list]')
  process.exit(1)
}

const preferred = ['gpt-image-2', 'gpt-image-1.5', 'gpt-image-1']
const model = process.env.ART_MODEL || preferred.find(m => ids.includes(m)) || imageModels.pop()
const quality = process.env.ART_QUALITY || 'medium'
if (!model) {
  console.error('This key has no gpt-image model available.')
  process.exit(1)
}
console.log(`model: ${model}  quality: ${quality}`)

await fs.mkdir(outDir, { recursive: true })
let failed = 0
for (const scene of SCENES) {
  if (only && !only.includes(scene.name)) continue
  const file = path.join(outDir, `${scene.name}.png`)
  if (!force && await fs.stat(file).then(() => true, () => false)) {
    console.log(`skip  ${scene.name} (exists)`)
    continue
  }
  const started = Date.now()
  try {
    const json = await api('/images/generations', { model, prompt: scene.prompt, size: scene.size, quality, n: 1, ...(scene.background ? { background: scene.background, output_format: 'png' } : {}) })
    const b64 = json.data?.[0]?.b64_json
    if (!b64) throw new Error('no image in the response')
    await fs.writeFile(file, Buffer.from(b64, 'base64'))
    console.log(`done  ${scene.name}  ${Math.round((Date.now() - started) / 1000)}s`)
  } catch (err) {
    failed++
    console.log(`FAIL  ${scene.name}: ${err.message}`)
  }
}
process.exit(failed ? 1 : 0)
