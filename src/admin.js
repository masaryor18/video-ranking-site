// src/admin.js
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

let currentPage = 1
const perPage = 20
let sortMode = 'popular'


/* ===============================
   ログイン処理（メール固定）
================================ */
document.getElementById('login-btn')?.addEventListener('click', async () => {
  const FIXED_ADMIN_EMAIL = "masaya.ryoutarou.r18@gmail.com"  // ← Supabase Authで登録した管理者メール
  const password = document.getElementById('admin-password').value
  const errorEl = document.getElementById('login-error')

  const { data, error } = await supabase.auth.signInWithPassword({
    email: FIXED_ADMIN_EMAIL,
    password
  })

  if (error) {
    console.error(error)
    errorEl.textContent = 'パスワードが違います'
    errorEl.style.display = 'block'
    return
  }

  document.getElementById('login-section').style.display = 'none'
  document.getElementById('admin-section').style.display = 'block'
  loadVideos()
})


/* ===============================
   ログアウト処理
================================ */
document.getElementById('logout-btn')?.addEventListener('click', async () => {
  await supabase.auth.signOut()
  location.reload()
})

/* ===============================
   ページネーションとソート
================================ */
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

/* ===============================
   コンテンツ登録処理（認証付き）
================================ */
document.getElementById('upload-form-inner')?.addEventListener('submit', async (e) => {
  e.preventDefault()

  const user = (await supabase.auth.getUser()).data.user
  if (!user) {
    alert('認証が必要です')
    return
  }

  const title = document.getElementById('title').value
  const link_url = document.getElementById('link_url').value
  const file = document.getElementById('thumbnail').files[0]

  if (!file) return alert('画像を選択してください')

  try {
    const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`

    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })

    if (uploadError) throw uploadError

    const { data: pub } = supabase.storage.from('thumbnails').getPublicUrl(fileName)
    const publicUrl = pub?.publicUrl ?? ''

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
    console.error(err)
    alert('アップロードに失敗しました')
  }
})

/* ===============================
   動画一覧取得・描画
================================ */
async function loadVideos() {
  const list = document.getElementById('video-list')
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
    console.error(error)
    list.innerHTML = '<p style="color:red;">読み込みに失敗しました</p>'
    return
  }

  if (!data || !data.length) {
    list.innerHTML = '<p style="color:gray;">動画がありません。</p>'
    return
  }

  list.innerHTML = ''
  data.forEach(v => {
    const div = document.createElement('div')
    div.classList.add('video-item')
    div.innerHTML = `
      <img src="${v.thumbnail_url}" alt="thumb">
      <div>
        <strong>${escapeHTML(v.title)}</strong><br>
        <a href="${escapeAttr(v.link_url)}" target="_blank">${escapeHTML(v.link_url)}</a><br>
        <span style="color:#999;">再生回数: ${v.views ?? 0}</span><br>
        <button class="delete-btn" data-id="${v.id}">削除</button>
      </div>
    `
    list.appendChild(div)
  })

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id
      if (!confirm('本当に削除しますか？')) return
      const { error: delErr } = await supabase.from('videos').delete().eq('id', id)
      if (delErr) {
        console.error(delErr)
        alert('削除に失敗しました')
      } else {
        alert('削除しました')
        loadVideos()
      }
    })
  })

  document.getElementById('page-num').textContent = currentPage
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]))
}
function escapeAttr(s) {
  return String(s).replace(/"/g, '&quot;')
}

/* ===============================
   起動時: ログイン済みならダッシュボードへ
================================ */
;(async () => {
  const { data } = await supabase.auth.getUser()
  if (data?.user) {
    document.getElementById('login-section').style.display = 'none'
    document.getElementById('admin-section').style.display = 'block'
    loadVideos()
  }
})()
