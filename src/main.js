// src/main.js
import { createClient } from '@supabase/supabase-js'
import { bannerAd } from './ads.js'
import { showPopupAd } from './popup_ad.js'

/* --- 環境変数（Vite 経由） --- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が設定されていません。.env を確認してください。')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* --- 状態 --- */
let currentTab = 'popular'
let currentPage = 1
const PAGE_SIZE = 10
let cachedVideos = []

/* --- ヘルパー --- */
function escapeHTML(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[m]))}

/* --- データ取得 --- */
async function fetchVideos(){
  try {
    if (currentTab === 'popular') {
      const { data, error } = await supabase
        .from('videos')
        .select('id,title,thumbnail_url,link_url,views,created_at')
        .order('views', { ascending: false })
        .limit(200)
      if (error) { console.error('fetchVideos error:', error); return [] }
      return data || []
    } else {
      const { data, error } = await supabase
        .from('videos')
        .select('id,title,thumbnail_url,link_url,views,created_at')
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) { console.error('fetchVideos error:', error); return [] }
      return data || []
    }
  } catch(e){
    console.error('fetchVideos exception:', e)
    return []
  }
}

/* --- レンダリング --- */
function render(){
  const listEl = document.getElementById('video-list')
  listEl.innerHTML = ''
  const start = (currentPage - 1) * PAGE_SIZE
  const pageItems = cachedVideos.slice(start, start + PAGE_SIZE)
  if (pageItems.length === 0) {
    listEl.innerHTML = `<div style="color:var(--muted); text-align:center; padding:1rem;">表示できる動画がありません。</div>`
  } else {
    for (const v of pageItems) {
      const thumb = v.thumbnail_url && v.thumbnail_url.trim() !== '' ? v.thumbnail_url : 'https://via.placeholder.com/120x90?text=No+Image'
      const card = document.createElement('div')
      card.className = 'video'

      const img = document.createElement('img')
      img.src = thumb
      img.alt = escapeHTML(v.title || 'thumbnail')
      img.tabIndex = 0
      img.addEventListener('click', () => onThumbClick(v.id, v.link_url))
      img.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onThumbClick(v.id, v.link_url) } })

      const meta = document.createElement('div')
      meta.style.flex = '1 1 auto'
      const title = document.createElement('div')
      title.className = 'video-title'
      title.textContent = v.title || '無題'
      const views = document.createElement('div')
      views.className = 'video-meta'
      views.textContent = `${v.views ?? 0} 回再生`

      meta.appendChild(title)
      meta.appendChild(views)
      card.appendChild(img)
      card.appendChild(meta)
      listEl.appendChild(card)
    }
  }

  document.getElementById('page-number').textContent = currentPage
  document.getElementById('prev-btn').disabled = currentPage === 1
  document.getElementById('next-btn').disabled = currentPage * PAGE_SIZE >= cachedVideos.length
}

/* --- サムネクリック時（RPCを想定して安全にviewsを増やす） --- */
async function onThumbClick(id, link){
  if (!link) return
  // 新しいタブを先に開く（popup blocker 回避）
  window.open(link, '_blank', 'noopener')

  try {
    // Supabase 側に RPC (increment_views) を作っている前提
    // 例: create or replace function public.increment_views(p_id uuid) returns void ...
    const { error } = await supabase.rpc('increment_views', { p_id: id })
    if (error) console.error('increment error:', error)
    // ローカルキャッシュを更新（見た目だけ更新）
    const idx = cachedVideos.findIndex(x => x.id === id)
    if (idx !== -1) cachedVideos[idx].views = (cachedVideos[idx].views ?? 0) + 1
    render()
  } catch(e){
    console.error('onThumbClick exception:', e)
  }
}

/* --- 初期化 --- */
async function loadAndRender(){
  cachedVideos = await fetchVideos()
  currentPage = 1
  render()
}

/* --- イベントハンドラ登録 --- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('tab-popular').addEventListener('click', async () => {
    if (currentTab === 'popular') return
    currentTab = 'popular'
    document.getElementById('tab-popular').classList.add('active')
    document.getElementById('tab-latest').classList.remove('active')
    await loadAndRender()
  })
  document.getElementById('tab-latest').addEventListener('click', async () => {
    if (currentTab === 'latest') return
    currentTab = 'latest'
    document.getElementById('tab-latest').classList.add('active')
    document.getElementById('tab-popular').classList.remove('active')
    await loadAndRender()
  })

  document.getElementById('prev-btn').addEventListener('click', () => { if (currentPage > 1) { currentPage--; render() } })
  document.getElementById('next-btn').addEventListener('click', () => { if (currentPage * PAGE_SIZE < cachedVideos.length) { currentPage++; render() } })

  // popup ad
showPopupAd(3000)  // ← 3秒後にポップアップを表示

const adContainer = document.getElementById('banner-ad');
  if (adContainer) {
    adContainer.innerHTML = bannerAd;   // ads.js から読み込んだ広告を挿入
  }
  // 初回ロード
  loadAndRender()
})
