// src/admin.js
import { createClient } from '@supabase/supabase-js'

// Supabase環境変数の読み込み
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD  // ← ここが安全ポイント

// Supabaseクライアント作成
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

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
// 動画アップロード処理
// --------------------
document.getElementById('upload-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const title = document.getElementById('title').value
  const link_url = document.getElementById('link_url').value
  const file = document.getElementById('thumbnail').files[0]

  if (!file) return alert('画像を選択してください')

  try {
    // Storageにアップロード
    const fileName = `${Date.now()}-${file.name}`
    const { error: uploadError } = await supabase.storage
      .from('thumbnails')
      .upload(fileName, file)

    if (uploadError) throw uploadError

    // 公開URLを取得
    const { data: { publicUrl } } = supabase
      .storage
      .from('thumbnails')
      .getPublicUrl(fileName)

    // videosテーブルに登録
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

// --------------------
// 登録済み動画一覧表示
// --------------------
async function loadVideos() {
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })

  const list = document.getElementById('video-list')
  list.innerHTML = ''

  if (error || !data.length) {
    list.textContent = '登録された動画はありません。'
    return
  }

  data.forEach(v => {
    const div = document.createElement('div')
    div.innerHTML = `
      <img src="${v.thumbnail_url}" alt="thumb" style="max-width:120px;border-radius:6px;"><br>
      <strong>${v.title}</strong><br>
      <a href="${v.link_url}" target="_blank">${v.link_url}</a><br>
      <button data-id="${v.id}" class="delete-btn">削除</button>
      <hr>
    `
    list.appendChild(div)
  })

  // 削除処理
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (confirm('本当に削除しますか？')) {
        const
