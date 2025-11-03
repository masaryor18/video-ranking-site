// src/admin.js
import { createClient } from '@supabase/supabase-js'

// ===============================
// Supabase 環境変数
// ===============================
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY が未設定です。.env を確認してください。')
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ===============================
// 状態
// ===============================
let currentPage = 1
const perPage = 20
let sortMode = 'popular'

// ===============================
// ログイン処理
// ===============================
document.getElementById('login-btn')?.addEventListener('click', () => {
  const input = document.getElementById('admin-password').value
  const error = document.getElementById('login-error')

  if (input === ADMIN_PASSWORD) {
    error.style.display = 'none'
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  } else {
    error.textContent = 'パスワードが違います'
    error.style.display = 'block'
  }
})

// ===============================
// 並び替え
// ===============================
document.getElementById('sort-popular')?.addEventListener('click', () => {
  sortMode = 'popular'
  document.getElementById('sort-popular').classList.add('active')
  document.getElementById('sort-latest').classList.remove('active')
  currentPage = 1
  loadVideos()
})

document.getElementById('sort-latest')?.addEventListener('click', () => {
  sortMode = 'latest'
  document.getElementById('sort-latest').classList.add('active')
  document.getElementById('sort-popular').classList.remove('active')
  currentPage = 1
  loadVideos()
})

// ===============================
// ページネーション
// ===============================
document.getElementById('prev-page')?.addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--
    loadVideos()
  }
})

document.getElementById('next-page')?.addEventListener('click', () => {
  currentPage++
  loadVideos()
})

// ===============================
// コンテンツ登録
// ===============================
document.getElementById('upload-form-inner')?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value.trim()
  const link_url = document.getElementById('link_url').value.trim()
  const file = document.getElementById('thumbnail').files[0]

  if (!file) {
    alert('画像を選択してください')
    return
  }

  try {
    const fileExt = file.name.split('.').pop()
    const fileName = `${Date.now()}.${fileExt}`
    const filePath = `uploads/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(filePath, file, {
        contentType: file.type || 'image/jpeg',
        upsert: false
      })

    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage
      .from('thumbnails')
      .getPublicUrl(filePath)

    const publicUrl = pub?.publicUrl || ''

    const { error: insertError } = await supabase.from('videos').insert({
      title,
      link_url,
      thumbnail_url: publicUrl,
      created_at: new Date().toISOString()
    })
    if (insertError) throw insertError

    alert('登録が完了しました！')
    e.target.reset()
    loadVideos()
  } catch (err) {
    console.error('❌ アップロードエラー:', err)
    alert('アップロードに失敗しました')
  }
})

// ===============================
// 動画一覧表示
// ===============================
async function loadVideos() {
  const list = document.getElementById('video-list')
  if (!list) return

  list.innerHTML = '<p style="color:gray;">読み込み中...</p>'

  let query = supabase.from('videos').select('*')

  if (sortMode === 'latest') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('views', { ascending: false }).order('created_at', { ascending: false })
  }

  const from = (currentPage - 1) * perPage
  const to = from + perPage - 1
  const { data, error } = await query.range(from, to)

  if (error) {
    console.error('❌ 取得エラー:', error)
    list.innerHTML = '<p style="color:red;">読み込みに失敗しました</p>'
    return
  }

  if (!data || data.length === 0) {
    list.innerHTML = '<p style="color:gray;">登録された動画はありません。</p>'
    document.getElementById('page-num').textContent = String(currentPage)
    return
  }

  list.innerHTML = ''
  data.forEach(v => {
    const div = document.createElement('div')
    div.className = 'video-item'
    div.innerHTML = `
      <img src="${v.thumbnail_url}" alt="thumb">
      <div>
        <strong>${escapeHTML(v.title || '')}</strong><br>
        <a href="${escapeAttr(v.link_url || '')}" target="_blank">${escapeHTML(v.link_url || '')}</a><br>
        <span style="color:#ccc;">再生回数：${Number(v.views ?? 0)}</span><br>
        <button data-id="${v.id}" class="delete-btn">削除</button>
      </div>
    `
    list.appendChild(div)
  })

  document.getElementById('page-num').textContent = String(currentPage)

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('本当に削除しますか？')) return
      const id = btn.dataset.id?.trim()
      console.log('🗑️ 削除対象:', id)

      const { error: delErr } = await supabase.from('videos').delete().eq('id', id)
      if (delErr) {
        console.error('❌ 削除エラー:', delErr)
        alert('削除に失敗しました')
      } else {
        alert('削除しました')
        loadVideos()
      }
    })
  })
}

// ===============================
// エスケープ関数
// ===============================
function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])
  )
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;')
}
