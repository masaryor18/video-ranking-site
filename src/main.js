// src/main.js
import { createClient } from '@supabase/supabase-js'
import { showPopupAd } from './popup_ad.js'

/* ---------------------------------------
   🔧 Supabase 設定
---------------------------------------- */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('❗ Supabase環境変数が設定されていません。.env を確認してください')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/* ---------------------------------------
   📦 状態管理
---------------------------------------- */
let currentTab = 'popular'
let currentPage = 1
const PAGE_SIZE = 10
let cachedVideos = []

/* ---------------------------------------
   🔤 HTMLエスケープ
---------------------------------------- */
function escapeHTML(s){
  if (!s) return ''
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[m]))
}

/* ---------------------------------------
   🎥 Supabase RPC で動画取得
---------------------------------------- */
async function fetchVideos(){
  try {
    const { data, error } = await supabase.rpc('get_videos', {
      p_sort: currentTab
    })

    if (error) {
      console.error('fetchVideos RPC error:', error)
      return []
    }

    return data || []
  } catch(e){
    console.error('fetchVideos exception:', e)
    return []
  }
}

/* ---------------------------------------
   🔥 サムネイル or タイトルをクリックした時
   → Supabaseでviews+1
   → その後、同一タブ遷移
---------------------------------------- */
async function onThumbClick(id, url){
  if (!url) return

  // ① Supabaseのviewsを1増加
  try {
    const { error } = await supabase.rpc('increment_views', { p_id: id })
    if (error) console.error('increment_views RPC error:', error)
  } catch(e){
    console.error('increment_views exception:', e)
  }

  // ② ローカルキャッシュにも反映（数値更新）
  const idx = cachedVideos.findIndex(v => v.id === id)
  if (idx !== -1){
    cachedVideos[idx].views = (cachedVideos[idx].views ?? 0) + 1
  }
  render()

  // ③ 同一タブで遷移
  window.location.href = url
}

/* ---------------------------------------
   🖼️ レンダリング
---------------------------------------- */
function render(){
  const listEl = document.getElementById('video-list')
  listEl.innerHTML = ''

  const start = (currentPage - 1) * PAGE_SIZE
  const pageItems = cachedVideos.slice(start, start + PAGE_SIZE)

  if (pageItems.length === 0) {
    listEl.innerHTML = `
      <div style="color:#bbb; text-align:center; padding:1rem;">
        表示できる動画がありません。
      </div>`
    return
  }

  for (const v of pageItems) {
    const thumb = v.thumbnail_url && v.thumbnail_url.trim() !== ''
      ? v.thumbnail_url
      : 'https://via.placeholder.com/480x270?text=No+Image'

    const card = document.createElement('div')
    card.className = 'video'

    /* --- サムネイル --- */
    const img = document.createElement('img')
    img.src = thumb
    img.alt = escapeHTML(v.title || 'thumbnail')
    img.style.cursor = 'pointer'
    img.addEventListener('click', () => onThumbClick(v.id, v.link_url))

    /* --- メタ情報 --- */
    const meta = document.createElement('div')
    meta.style.flex = '1 1 auto'

    const title = document.createElement('div')
    title.className = 'video-title'
    title.textContent = v.title || '無題'
    title.style.cursor = 'pointer'
    title.addEventListener('click', () => onThumbClick(v.id, v.link_url))

    const views = document.createElement('div')
    views.className = 'video-meta'
    views.textContent = `${v.views ?? 0} 回再生`

    meta.appendChild(title)
    meta.appendChild(views)
    card.appendChild(img)
    card.appendChild(meta)

    listEl.appendChild(card)
  }

  // ページ番号更新
  document.getElementById('page-number').textContent = currentPage
  document.getElementById('prev-btn').disabled = currentPage === 1
  document.getElementById('next-btn').disabled = currentPage * PAGE_SIZE >= cachedVideos.length
}

/* ---------------------------------------
   🔄 初期ロード + キャッシュ読み込み
---------------------------------------- */
async function loadAndRender(){
  const cacheKey = `videos_${currentTab}`
  const cached = localStorage.getItem(cacheKey)

  if (cached) {
    console.log('📦 キャッシュ読み込み')
    cachedVideos = JSON.parse(cached)
  } else {
    console.log('🌐 Supabaseから取得')
    cachedVideos = await fetchVideos()
    localStorage.setItem(cacheKey, JSON.stringify(cachedVideos))

    // キャッシュは5分で削除
    setTimeout(() => localStorage.removeItem(cacheKey), 5 * 60 * 1000)
  }

  currentPage = 1
  render()
}

/* ---------------------------------------
   📌 イベント登録
---------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {

  // タブ切替
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

  // ページ移動
  document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--
      render()
    }
  })

  document.getElementById('next-btn').addEventListener('click', () => {
    if (currentPage * PAGE_SIZE < cachedVideos.length) {
      currentPage++
      render()
    }
  })

  // popup広告（JuicyAds）
  showPopupAd(3000)

  // 初期描画
  loadAndRender()
})
