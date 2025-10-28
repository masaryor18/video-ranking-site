// src/admin.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentTab = 'popular'
let currentPage = 1
const PAGE_SIZE = 20
let cachedVideos = []

// --------------------
// ログイン処理
// --------------------
document.getElementById('login-btn').addEventListener('click', () => {
  const input = document.getElementById('admin-password').value
  const error = document.getElementById('login-error')

  if (input === ADMIN_PASSWORD) {
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  } else {
    error.style.display = 'block'
  }
})

// --------------------
// 新規登録処理
// --------------------
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value
  const link_url = document.getElementById('link_url').value
  const file = document.getElementById('thumbnail').files[0]

  if (!file) return alert('画像を選択してください')

  try {
    const fileName = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage.from('thumbnails').upload(fileName, file)
    if (uploadError) throw uploadError

    const { data: { publicUrl } } = supabase.storage.from('thumbnails').getPublicUrl(fileName)

    const { error: insertError } = await supabase.from('videos').insert({
      title,
      link_url,
      thumbnail_url: publicUrl,
      created_at: new Date().toISOString()
    })
    if (insertError) throw insertError

    alert('登録完了！')
    e.target.reset()
    loadVideos()
  } catch (err) {
    console.error(err)
    alert('アップロードに失敗しました')
  }
})

// --------------------
// 動画一覧取得・表示
// --------------------
async function loadVideos() {
  const orderBy = currentTab === 'popular' ? 'views' : 'created_at'
  const ascending = currentTab === 'latest'

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order(orderBy, { ascending })
  
  if (error) {
    console.error(error)
    alert('データ取得に失敗しました')
    return
  }

  cachedVideos = data
  renderPage()
}

// --------------------
// ページネーション表示
// --------------------
function renderPage() {
  const list = document.getElementById('video-list')
  list.innerHTML = ''

  const start = (currentPage - 1) * PAGE_SIZE
  const pageItems = cachedVideos.slice(start, start + PAGE_SIZE)

  if (!pageItems.length) {
    list.textContent = 'データがありません。'
    return
  }

  pageItems.forEach(v => {
    const div = document.createElement('div')
    div.className = 'video-item'
    div.innerHTML = `
      <img src="${v.thumbnail_url}" alt="thumb"><br>
      <strong>${v.title}</strong><br>
      <a href="${v.link_url}" target="_blank">${v.link_url}</a><br>
      <button data-id="${v.id}" class="delete-btn">削除</button>
    `
    list.appendChild(div)
  })

  document.getElementById('page-info').textContent = `${currentPage} / ${Math.ceil(cachedVideos.length / PAGE_SIZE)}`
  document.getElementById('prev-btn').disabled = currentPage === 1
  document.getElementById('next-btn').disabled = currentPage * PAGE_SIZE >= cachedVideos.length

  // 削除処理
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('本当に削除しますか？')) {
        const id = btn.dataset.id
        try {
          const { error } = await supabase.from('videos').delete().eq('id', id)
          if (error) throw error
          alert('削除しました')
          loadVideos()
        } catch (err) {
          console.error(err)
          alert('削除に失敗しました')
        }
      }
    })
  })
}

// --------------------
// イベント
// --------------------
document.getElementById('prev-btn').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--
    renderPage()
  }
})

document.getElementById('next-btn').addEventListener('click', () => {
  if (currentPage * PAGE_SIZE < cachedVideos.length) {
    currentPage++
    renderPage()
  }
})

document.getElementById('tab-popular').addEventListener('click', () => {
  if (currentTab !== 'popular') {
    currentTab = 'popular'
    currentPage = 1
    document.getElementById('tab-popular').classList.add('active')
    document.getElementById('tab-latest').classList.remove('active')
    loadVideos()
  }
})

document.getElementById('tab-latest').addEventListener('click', () => {
  if (currentTab !== 'latest') {
    currentTab = 'latest'
    currentPage = 1
    document.getElementById('tab-latest').classList.add('active')
    document.getElementById('tab-popular').classList.remove('active')
    loadVideos()
  }
})
