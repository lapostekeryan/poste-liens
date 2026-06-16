import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

async function callHuggingFace(prompt: string) {
  const token = process.env.HF_TOKEN
  const model = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct'
  if (!token) throw new Error('HF_TOKEN manquant')
  const res = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300
    })
  })
  if (!res.ok) throw new Error('Erreur Hugging Face')
  const data = await res.json()
  return data?.choices?.[0]?.message?.content || ''
}

async function callCloudflare(prompt: string) {
  const account = process.env.CF_ACCOUNT_ID
  const token = process.env.CF_API_TOKEN
  const model = process.env.CF_AI_MODEL || '@cf/meta/llama-3.1-8b-instruct-fp8-fast'
  if (!account || !token) throw new Error('Config Cloudflare manquante')
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/${encodeURIComponent(model)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages: [{ role: 'user', content: prompt }] })
  })
  if (!res.ok) throw new Error('Erreur Cloudflare')
  const data = await res.json()
  return data?.result?.response || ''
}

export async function POST(request: Request) {
  const { password, prompt, provider } = await request.json()
  if (process.env.APP_PASSWORD && password !== process.env.APP_PASSWORD) {
    return NextResponse.json({ error: 'Accès refusé.' }, { status: 401 })
  }
  if (!prompt) return NextResponse.json({ error: 'Prompt manquant.' }, { status: 400 })
  try {
    const text = provider === 'cloudflare' ? await callCloudflare(prompt) : await callHuggingFace(prompt)
    return NextResponse.json({ ok: true, text })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Erreur IA' }, { status: 500 })
  }
}
