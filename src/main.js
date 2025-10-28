// src/main.js
import { createClient } from '@supabase/supabase-js'
import { bannerAd } from './ads.js'
import { showPopupAd } from './popup_ad.js'

/* --- 環境変数 --- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* --- 状態 --- */
let currentTab = 'popular'
let currentPage = 1
const PAGE_SIZE = 10
let cachedVideos = []

/* --- HTMLエスケープ --- */
function escapeHTML(s){ if(!s) return ''; return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[m]))}

/* --- 動画取得 --- */
async function fetchVideos(){
  const { data, error } = await supabase.rpc('get_videos', { p_sort: currentTab })
  if (error) { console.error('fetchVideos error:', error); return [] }
  return data || []
}

/* --- 描画 --- */
function render(){
  const listEl = document.getElementById('video-list')
  listEl.innerHTML = ''
  const start = (currentPage - 1) * PAGE_SIZE
  const pageItems = cachedVideos.slice(start, start + PAGE_SIZE)

  if (pageItems.length === 0) {
    listEl.innerHTML = `<div style="color:#aaa; text-align:center;">表示できる動画がありません。</div>`
  } else {
    for (const v of pageItems) {
      const thumb = v.thumbnail_url || 'https://via.placeholder.com/120x90?text=No+Image'
      const card = document.createElement('div')
      card.className = 'video'

      const img = document.createElement('img')
      img.src = thumb
      img.alt = escapeHTML(v.title || 'thumbnail')
      img.addEventListener('click', () => onThumbClick(v.id, v.link_url))

      const meta = document.createElement('div')
      meta.style.flex = '1'
      const title = document.createElement('div')
      title.className = 'video-title'
      title.textContent = v.title || '無題'
      const views = document.createElement('div')
      views.className = 'video-meta'
      views.textContent = `${v.views ?? 0} 回再生`

      meta.append(title, views)
      card.append(img, meta)
      listEl.append(card)
    }
  }

  document.getElementById('page-number').textContent = currentPage
  document.getElementById('prev-btn').disabled = currentPage === 1
  document.getElementById('next-btn').disabled = currentPage * PAGE_SIZE >= cachedVideos.length
}

/* --- サムネクリック --- */
async function onThumbClick(id, link){
  if (!link) return
  window.open(link, '_blank')
  const { error } = await supabase.rpc('increment_views', { p_id: id })
  if (error) console.error(error)
  const v = cachedVideos.find(x => x.id === id)
  if (v) v.views++
  render()
}

/* --- 初期読み込み --- */
async function loadAndRender(){
  cachedVideos = await fetchVideos()
  currentPage = 1
  render()
}

/* --- サイド広告読み込み --- */
async function loadAds() {
  const { data, error } = await supabase.from('ads').select('*').eq('active', true)
  if (error) { console.error('広告読み込みエラー:', error); return }

  data.forEach(ad => {
    const html = `
      <a href="${ad.link_url}" target="_blank">
        <img src="${ad.image_url}" alt="${ad.alt_text || '広告'}">
      </a>
    `
    if (ad.position === 'left') {
      document.getElementById('ad-left').innerHTML += html
    } else if (ad.position === 'right') {
      document.getElementById('ad-right').innerHTML += html
    }
  })
}

/* --- イベント登録 --- */
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('tab-popular').addEventListener('click', async () => {
    if (currentTab !== 'popular') { currentTab = 'popular'; loadAndRender() }
  })
  document.getElementById('tab-latest').addEventListener('click', async () => {
    if (currentTab !== 'latest') { currentTab = 'latest'; loadAndRender() }
  })
  document.getElementById('prev-btn').addEventListener('click', () => { if (currentPage > 1) { currentPage--; render() } })
  document.getElementById('next-btn').addEventListener('click', () => { if (currentPage * PAGE_SIZE < cachedVideos.length) { currentPage++; render() } })

  showPopupAd(3000)
  const adContainer = document.getElementById('banner-ad')
  if (adContainer) adContainer.innerHTML = bannerAd

  await loadAds()   // ✅ サイド広告を読み込み
  await loadAndRender()
})
