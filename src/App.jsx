import React, { useState, useEffect, useRef } from 'react'

function parseSrtCaptions(srtText) {
  return srtText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((block) =>
      block
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !/^\d+$/.test(line) && !line.includes('-->'))
        .map((line) => line.replace(/<[^>]+>/g, '').trim())
        .filter(Boolean)
        .join(' ')
    )
    .filter(Boolean)
    .join('\n')
}

function buildPrompt(captionText) {
  return `Đây là kịch bản của một video drama ngắn 10 giây. Hãy viết một câu chuyện kịch tính, lôi cuốn người đọc dựa trên kịch bản này bằng tiếng Tây Ban Nha theo các yêu cầu sau:

Kịch bản trích từ file SRT:
"""
${captionText}
"""

Yêu cầu về định dạng và cấu trúc câu truyện (CỰC KỲ QUAN TRỌNG - PHẢI TUÂN THỦ CHÍNH XÁC):
1. Viết toàn bộ câu chuyện bằng tiếng Tây Ban Nha tự nhiên, diễn cảm.
2. Tiêu đề câu chuyện (Title Formatting):
   - Dòng đầu tiên: Tiêu đề viết hoa toàn bộ (ALL CAPS) và KHÔNG chứa bất kỳ emoji nào.
   - Dòng thứ hai: Ghi rõ "PARTE 1".
   - Dòng thứ ba: Để trống.
3. Cấu trúc nhịp điệu dồn dập (Sentence Length & Pacing):
   - Chia câu chuyện thành các đoạn văn CỰC KỲ NGẮN.
   - Mỗi đoạn văn chỉ chứa **từ 1 đến tối đa 2 câu ngắn**.
   - BẮT BUỘC xuống dòng tạo dòng trống liên tục giữa các đoạn văn ngắn để người đọc dễ lướt.
4. Định dạng lời thoại (Dialogue Formatting):
   - Lời thoại trực tiếp bắt đầu bằng dấu gạch ngang dài (—) và đặt ở một dòng riêng biệt, ví dụ:
     —Pedir comida a domicilio es un desperdicio de dinero.
5. Tuyệt đối KHÔNG sử dụng các emoji rải rác trong tiêu đề và nội dung câu chuyện.
6. Bắt buộc kết thúc câu chuyện bằng dòng kêu gọi hành động sau (đây là nơi DUY NHẤT chứa emoji):
   Comenta “YES” si quieres ver la parte 2. 👇😢
7. Độ dài của câu chuyện (không tính tiêu đề và dòng kêu gọi hành động) phải nằm trong khoảng từ 300 đến 500 từ.
8. Tuyệt đối chỉ trả về nội dung câu chuyện, không thêm bất kỳ lời mở đầu, giải thích hay ghi chú nào ngoài lề. Không viết mã code hay dùng khối code.`
}

export default function App() {
  const [files, setFiles] = useState([]) // Array of: { id, name, captionText, status: 'idle' | 'loading' | 'done' | 'error', output: '', errorMsg: '' }
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | done
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [geminiPsid, setGeminiPsid] = useState(localStorage.getItem('gemini_psid') || '')
  const [geminiPsidts, setGeminiPsidts] = useState(localStorage.getItem('gemini_psidts') || '')
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    localStorage.setItem('gemini_psid', geminiPsid)
  }, [geminiPsid])

  useEffect(() => {
    localStorage.setItem('gemini_psidts', geminiPsidts)
  }, [geminiPsidts])

  const outputRef = useRef(null)

  const selectedFile = files.find((f) => f.id === selectedFileId)



  async function handleSrtUpload(e) {
    const inputFiles = Array.from(e.target.files || [])
    setErrorMsg('')
    setSuccessMsg('')

    if (inputFiles.length === 0) return

    const newFiles = []
    for (const file of inputFiles) {
      if (!file.name.toLowerCase().endsWith('.srt')) {
        setErrorMsg(`File "${file.name}" không phải định dạng .srt.`)
        continue
      }

      try {
        const text = await file.text()
        const parsedCaption = parseSrtCaptions(text)

        if (!parsedCaption.trim()) {
          setErrorMsg(`Không đọc được nội dung phụ đề trong file: ${file.name}`)
          continue
        }

        newFiles.push({
          id: `${file.name}-${Date.now()}-${Math.random()}`,
          name: file.name,
          captionText: parsedCaption,
          status: 'idle',
          output: '',
          errorMsg: '',
        })
      } catch (err) {
        console.error(err)
        setErrorMsg(`Không đọc được file ${file.name}. Vui lòng thử file khác.`)
      }
    }

    if (newFiles.length > 0) {
      setFiles((prev) => [...prev, ...newFiles])
      setSelectedFileId((currentId) => currentId || newFiles[0].id)
      showTemporarySuccess(`Tải thành công ${newFiles.length} file phụ đề!`)
    }

    // Reset input to allow re-uploading the same files if needed
    e.target.value = ''
  }

  function handleCaptionChange(newText) {
    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFileId ? { ...f, captionText: newText } : f))
    )
  }

  function handleRemoveFile(fileId) {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId)
      if (selectedFileId === fileId) {
        setSelectedFileId(filtered[0]?.id || null)
      }
      return filtered
    })
  }

  function handleClearAll() {
    setFiles([])
    setSelectedFileId(null)
    setErrorMsg('')
    setSuccessMsg('')
    setStatus('idle')
  }

  function handleCopy(text) {
    if (!text.trim()) return
    navigator.clipboard.writeText(text.trim())
    showTemporarySuccess('Đã sao chép nội dung câu chuyện!')
  }

  function handleCopyAll() {
    const allOutputs = files
      .filter((f) => f.output.trim())
      .map((f) => `=== ${f.name} ===\n\n${f.output.trim()}`)
      .join('\n\n\n')
    if (allOutputs) {
      navigator.clipboard.writeText(allOutputs)
      showTemporarySuccess('Đã sao chép tất cả các câu chuyện đã hoàn thành!')
    }
  }

  function showTemporarySuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => {
      setSuccessMsg('')
    }, 5000)
  }

  function handleCopyPrompt(file) {
    if (!file) return
    const prompt = buildPrompt(file.captionText)
    navigator.clipboard.writeText(prompt)
    showTemporarySuccess(`Đã copy Prompt của "${file.name}". Hãy dán vào Gemini web để tạo truyện!`)
  }


  async function generateCaptionRewriteForFile(fileId, captionText) {
    try {
      const response = await fetch('https://write-content.onrender.com/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: buildPrompt(captionText),
          cookies: {
            psid: geminiPsid,
            psidts: geminiPsidts
          }
        }),
      })

      if (!response.ok) {
        let detail = ''
        try {
          const errJson = await response.json()
          detail = errJson?.error || JSON.stringify(errJson)
        } catch {
          detail = await response.text()
        }
        throw new Error(detail || `Lỗi HTTP ${response.status}`)
      }

      const json = await response.json()
      const text = json.output || ''

      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: 'done', output: text, errorMsg: '' } : f))
      )
      return text
    } catch (err) {
      console.error(err)
      const errorStr = err.message || 'Đã có lỗi xảy ra khi gọi backend.'
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: 'error', errorMsg: errorStr } : f))
      )
      throw err
    }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    if (files.length === 0) {
      setErrorMsg('Hãy upload ít nhất một file phụ đề .srt.')
      return
    }

    setStatus('loading')

    // Reset statuses and outputs of existing items
    const filesToProcess = files.map((f) => ({
      ...f,
      status: 'idle',
      errorMsg: '',
      output: '',
    }))
    setFiles(filesToProcess)

    // Process them sequentially
    for (const fileToProcess of filesToProcess) {
      setFiles((prev) =>
        prev.map((f) => (f.id === fileToProcess.id ? { ...f, status: 'loading' } : f))
      )

      try {
        await generateCaptionRewriteForFile(fileToProcess.id, fileToProcess.captionText)
      } catch (err) {
        console.error(err)
      }
    }

    setStatus('done')
    showTemporarySuccess('Hoàn thành quá trình viết truyện tự động bằng Chrome Cookies!')
  }

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-inner">
          <span className="eyebrow">SRT · Chrome Cookies Web Workflow</span>
          <h1>Content Writer</h1>
          <p className="sub">Tự động viết truyện tiếng Tây Ban Nha chạy ngầm thông qua Cookies Chrome của bạn.</p>
        </div>
      </header>

      <main className="desk">
        <section className="card index-card">
          <h2 className="card-title">1. Hướng dẫn thiết lập</h2>

          <div className="token-limits-box" style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <div className="token-limit-row" style={{ alignItems: 'flex-start' }}>
              <span className="token-limit-label" style={{ minWidth: '24px' }}>❶</span>
              <span className="token-limit-val">Đăng nhập tài khoản Google tại trang <a href="https://gemini.google.com" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', fontWeight: 'bold' }}>Gemini Web</a> trên trình duyệt Google Chrome.</span>
            </div>
            <div className="token-limit-row" style={{ alignItems: 'flex-start' }}>
              <span className="token-limit-label" style={{ minWidth: '24px' }}>❷</span>
              <span className="token-limit-val">Đảm bảo máy tính đã cài đặt <code>uv</code> để chạy tự động MCP server.</span>
            </div>
            <div className="token-limit-row" style={{ alignItems: 'flex-start' }}>
              <span className="token-limit-label" style={{ minWidth: '24px' }}>❸</span>
              <span className="token-limit-val">Khởi chạy backend: <code>node server.js</code> ở thư mục dự án.</span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem', border: '1px dashed #ccc', borderRadius: '8px', padding: '1rem', background: '#fafafa' }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none' }}
              onClick={() => setShowSettings(!showSettings)}
            >
              <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>⚙️ Cấu hình Cookies (Tùy chọn nhập nhanh)</h3>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>{showSettings ? '▲ Thu gọn' : '▼ Mở rộng'}</span>
            </div>

            {showSettings && (
              <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#666' }}>
                  Nhập Cookies của bạn tại đây để gửi trực tiếp cho server mà không cần cấu hình lại biến trên Render. Cookies được lưu an toàn ở trình duyệt của bạn (localStorage).
                </p>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label" style={{ fontSize: '0.8rem' }}>Cookie GEMINI_PSID (__Secure-1PSID):</span>
                  <input 
                    type="password" 
                    placeholder="Dán giá trị __Secure-1PSID..."
                    value={geminiPsid}
                    onChange={(e) => setGeminiPsid(e.target.value)}
                    style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                  />
                </label>
                <label className="field" style={{ margin: 0 }}>
                  <span className="field-label" style={{ fontSize: '0.8rem' }}>Cookie GEMINI_PSIDTS (__Secure-1PSIDTS):</span>
                  <input 
                    type="password" 
                    placeholder="Dán giá trị __Secure-1PSIDTS..."
                    value={geminiPsidts}
                    onChange={(e) => setGeminiPsidts(e.target.value)}
                    style={{ padding: '0.5rem', fontSize: '0.85rem' }}
                  />
                </label>
                {(geminiPsid || geminiPsidts) && (
                  <button 
                    type="button" 
                    className="clear-all-btn"
                    style={{ width: 'fit-content', padding: '0.3rem 0.8rem', fontSize: '0.75rem', marginTop: '0.2rem' }}
                    onClick={() => {
                      setGeminiPsid('');
                      setGeminiPsidts('');
                    }}
                  >
                    Xóa cấu hình cookies đã lưu
                  </button>
                )}
              </div>
            )}
          </div>

          <h2 className="card-title">2. Danh sách File SRT</h2>
          <form onSubmit={handleGenerate}>
            <label className="field">
              <span className="field-label">Upload file phụ đề .srt (Chọn nhiều file)</span>
              <input type="file" accept=".srt" multiple onChange={handleSrtUpload} disabled={status === 'loading'} />
            </label>

            {files.length > 0 && (
              <div className="file-list-container">
                <div className="file-list-header">
                  <span className="field-label">Hàng đợi ({files.length})</span>
                  <button type="button" className="clear-all-btn" onClick={handleClearAll} disabled={status === 'loading'}>
                    Xóa tất cả
                  </button>
                </div>
                <div className="file-items">
                  {files.map((f) => {
                    const isSelected = f.id === selectedFileId
                    return (
                      <div
                        key={f.id}
                        className={`file-item ${isSelected ? 'active' : ''} ${f.status}`}
                        onClick={() => setSelectedFileId(f.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <div className="file-item-info">
                          <span className="file-item-name" title={f.name}>
                            {f.name}
                          </span>
                          <span className={`file-status-badge ${f.status}`}>
                            {f.status === 'idle' && '⏳ Chờ xử lý'}
                            {f.status === 'loading' && '⚙️ Đang viết bằng Chrome Cookies (Chạy ngầm)...'}
                            {f.status === 'done' && '✅ Hoàn thành'}
                            {f.status === 'error' && '❌ Lỗi'}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <button
                            type="button"
                            className="copy-btn"
                            style={{
                              padding: '4px 10px',
                              fontSize: '0.75rem',
                              whiteSpace: 'nowrap',
                              margin: 0,
                              borderRadius: '4px',
                              backgroundColor: 'var(--accent)',
                              color: '#fff',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              handleCopyPrompt(f)
                            }}
                            title="Sao chép Prompt gửi sang Gemini (Thủ công)"
                            disabled={status === 'loading'}
                          >
                            📋 Copy Prompt
                          </button>
                          <button
                            type="button"
                            className="file-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleRemoveFile(f.id)
                            }}
                            title="Xóa file"
                            style={{ margin: 0 }}
                            disabled={status === 'loading'}
                          >
                            &times;
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedFile ? (
              <>
                <label className="field">
                  <span className="field-label">Lời thoại đã trích xuất ({selectedFile.name})</span>
                  <textarea
                    rows="6"
                    placeholder="Lời thoại trích từ file phụ đề sẽ hiện ở đây."
                    value={selectedFile.captionText}
                    onChange={(e) => handleCaptionChange(e.target.value)}
                    disabled={status === 'loading'}
                  />
                </label>
                <p className="helper-text">
                  Số ký tự lời thoại: {selectedFile.captionText.trim().length.toLocaleString('vi-VN')}
                </p>
              </>
            ) : (
              <div className="no-file-selected" style={{ marginTop: '1rem' }}>
                Hãy upload file SRT hoặc chọn một file từ danh sách để xem lời thoại.
              </div>
            )}

            {errorMsg && <p className="error-text" style={{ marginTop: '1rem' }}>{errorMsg}</p>}
            {successMsg && <p className="success-text" style={{ marginTop: '1rem', color: 'green', fontWeight: 'bold' }}>{successMsg}</p>}

            <button type="submit" className="generate-btn" style={{ marginTop: '1.5rem' }} disabled={status === 'loading' || files.length === 0}>
              {status === 'loading' ? '⏳ Đang viết truyện bằng Chrome Cookies (Chạy ngầm)...' : '🚀 Viết tự động bằng Chrome Cookies cho tất cả các file'}
            </button>
          </form>
        </section>

        <section className="card paper" ref={outputRef}>
          {selectedFile ? (
            <>
              <div className="paper-head">
                <span className="paper-label" style={{ fontWeight: 'bold' }}>
                  Nhập & Xem trước: {selectedFile.name}
                </span>
                {selectedFile.output && (
                  <span className="word-count">
                    {selectedFile.output.trim().length.toLocaleString('vi-VN')} ký tự
                  </span>
                )}
              </div>

              {selectedFile.status === 'error' && selectedFile.errorMsg && (
                <div className="error-text" style={{ padding: '1rem', backgroundColor: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '6px', marginBottom: '1rem' }}>
                  <strong>Lỗi tự động hóa:</strong> {selectedFile.errorMsg}
                </div>
              )}

              {selectedFile.status === 'loading' && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                  <p className="placeholder" style={{ fontSize: '1.1rem' }}>
                    ⏳ Đang viết truyện tự động bằng Chrome Cookies...
                  </p>
                </div>
              )}

              {selectedFile.status === 'idle' && !selectedFile.output && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                  <p className="placeholder" style={{ fontSize: '1.1rem' }}>
                    ⏳ Chờ viết truyện tự động...
                  </p>
                </div>
              )}

              {selectedFile.output && (
                <div style={{ marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      className="copy-btn"
                      style={{ padding: '0.6rem 1.2rem', margin: 0, borderRadius: '6px' }}
                      onClick={() => handleCopy(selectedFile.output)}
                    >
                      📋 Sao chép câu chuyện
                    </button>
                  </div>
                  <div className="output-text" style={{ background: '#fcfcfc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee', maxHeight: '480px', overflowY: 'auto' }}>
                    {selectedFile.output.split(/\n+/).map((para, i) =>
                      para.trim() ? <p key={`${para.slice(0, 16)}-${i}`} style={{ marginBottom: '1rem' }}>{para}</p> : null
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
              <p className="placeholder" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                Hãy tải lên và chọn một file phụ đề để bắt đầu.
              </p>
            </div>
          )}

          {files.some((f) => f.output.trim()) && (
            <div style={{ marginTop: '2.5rem', borderTop: '2px solid #ddd', paddingTop: '1.5rem', textAlign: 'center' }}>
              <button type="button" className="copy-all-btn" style={{ width: '100%', padding: '1rem' }} onClick={handleCopyAll} disabled={status === 'loading'}>
                Sao chép tất cả truyện đã viết ({files.filter((f) => f.output.trim()).length} bài)
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="foot">
        Hệ thống tích hợp tự động hóa qua Chrome Cookies thông qua gemini-webapi-mcp backend. Bảo mật dữ liệu phiên đăng nhập của riêng bạn.
      </footer>
    </div>
  )
}
