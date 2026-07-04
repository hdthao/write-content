import React, { useState, useEffect, useRef } from 'react'

const DEFAULT_OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || ''

function formatModelLabel(model) {
  if (model?.name) return model.name
  if (model?.id) return model.id
  return 'Model'
}

function isTextModel(model) {
  return model?.architecture?.output_modalities?.includes('text')
}

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
  return `Viết một câu chuyện hư cấu sinh động dựa trên lời thoại này bằng tiếng Tây Ban Nha.

Lời thoại được trích từ file SRT:
"""
${captionText}
"""

Yêu cầu về văn phong, nhịp điệu và định dạng (CỰC KỲ QUAN TRỌNG):
1. Viết toàn bộ câu chuyện bằng tiếng Tây Ban Nha tự nhiên, diễn cảm.
2. Dựa sát vào ý chính, cảm xúc và diễn biến trong lời thoại gốc để phát triển thành một câu chuyện hoàn chỉnh, hấp dẫn, mạch lạc.
3. KHÔNG dịch hoặc chép lại file SRT theo từng dòng. KHÔNG giữ định dạng phụ đề, timestamp, hay số thứ tự.
4. Tiêu đề câu chuyện (Title Formatting):
   - BẮT BUỘC đặt tiêu đề ở dòng đầu tiên, tiêu đề phải dài từ 10 đến 20 từ và được VIẾT HOA TOÀN BỘ (ALL CAPS).
   - Dòng tiếp theo (dòng thứ hai) BẮT BUỘC phải ghi "PART 1" (xuống dòng từ tiêu đề).
   - Sau dòng "PART 1" là một dòng trống trước khi bắt đầu câu chuyện.
   Ví dụ:
   LAS MUJERES NO SE SIENTAN A LA MESA EN EL CUMPLEAÑOS DE ERNESTO Y LA CARPETA AZUL DE LA VERDAD
   PART 1
5. Cấu trúc câu và nhịp điệu (Sentence Length, Rhythm & Pacing):
   - Câu văn cần được ngắt nhịp rõ ràng, phân biệt rạch ròi giữa câu dài và câu ngắn đan xen để tạo tiết tấu văn học.
   - Hạn chế tối đa các câu quá dài lê thê. Ưu tiên ngắt câu thành các câu ngắn cô đọng, dứt khoát để tạo nhịp điệu lôi cuốn, căng thẳng hoặc ngắt nghỉ hợp lý.
6. Định dạng lời thoại (Dialogue Formatting):
   - Lời thoại trực tiếp của nhân vật BẮT BUỘC phải xuống dòng và bắt đầu bằng một dấu gạch ngang dài (em dash —).
   - KHÔNG dùng các loại dấu ngoặc kép (như "", «») cho lời thoại trực tiếp.
   - Thêm phần tả hành động/cảm xúc đan xen vào lời thoại nếu cần bằng cách dùng dấu gạch ngang tiếp theo.
   Ví dụ:
   —Las mujeres no se sientan a la mesa.
   La frase cayó sobre el comedor como una bofetada invisible.
   —Come afuera. Eres una extraña —dijo, señalando con la barbilla hacia el patio—. Así que deberías comer afuera.
7. Tuyệt đối chỉ trả về nội dung câu chuyện bằng tiếng Tây Ban Nha, không thêm bất kỳ ghi chú, lời giải thích hay lời mở đầu/kết thúc nào.`
}

export default function App() {
  const [apiKey, setApiKey] = useState(DEFAULT_OPENROUTER_API_KEY)
  const [models, setModels] = useState([])
  const [model, setModel] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const [files, setFiles] = useState([]) // Array of: { id, name, captionText, status, output, errorMsg }
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | done
  const [errorMsg, setErrorMsg] = useState('')
  const outputRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    async function loadModels() {
      try {
        const response = await fetch('https://openrouter.ai/api/v1/models')
        if (!response.ok) {
          throw new Error(`Lỗi HTTP ${response.status}`)
        }

        const json = await response.json()
        const availableModels = Array.isArray(json?.data) ? json.data.filter(isTextModel) : []

        if (cancelled) return

        setModels(availableModels)

        setModel((currentModel) => {
          if (currentModel && availableModels.some((item) => item.id === currentModel)) {
            return currentModel
          }

          const geminiLite = availableModels.find((m) => m.id.includes('gemini-2.5-flash-lite'))
          if (geminiLite) {
            return geminiLite.id
          }

          const sortedModels = [...availableModels].sort((left, right) => (right.created || 0) - (left.created || 0))
          return sortedModels[0]?.id || ''
        })
      } catch (err) {
        if (cancelled) return
        console.error(err)
        setErrorMsg('Không tải được danh sách model từ OpenRouter.')
      }
    }

    loadModels()

    return () => {
      cancelled = true
    }
  }, [])

  const filteredModels = models.filter((m) => {
    const query = modelSearch.toLowerCase().trim()
    if (!query) return true
    const label = formatModelLabel(m).toLowerCase()
    const id = m.id.toLowerCase()
    return label.includes(query) || id.includes(query)
  })

  // Synchronize the selected model with filtered results if the selected model is filtered out
  useEffect(() => {
    if (filteredModels.length > 0) {
      const isStillAvailable = filteredModels.some((m) => m.id === model)
      if (!isStillAvailable) {
        setModel(filteredModels[0].id)
      }
    }
  }, [filteredModels, model])

  async function handleSrtUpload(e) {
    const inputFiles = Array.from(e.target.files || [])
    setErrorMsg('')

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
      setFiles((prev) => {
        const updated = [...prev, ...newFiles]
        return updated
      })
      setSelectedFileId((currentId) => currentId || newFiles[0].id)
    }

    // Reset input to allow re-uploading the same files if needed
    e.target.value = ''
  }

  async function generateCaptionRewriteForFile(fileId, captionText) {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey.trim()}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'Content Writer AI',
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: buildPrompt(captionText) }],
          stream: true,
        }),
      })

      if (!response.ok || !response.body) {
        let detail = ''
        try {
          const errJson = await response.json()
          detail = errJson?.error?.message || JSON.stringify(errJson)
        } catch {
          detail = await response.text()
        }
        throw new Error(detail || `Lỗi HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let full = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const data = trimmed.slice(5).trim()
          if (data === '[DONE]') continue
          try {
            const json = JSON.parse(data)
            const delta = json?.choices?.[0]?.delta?.content
            if (delta) {
              full += delta
              setFiles((prev) =>
                prev.map((f) => (f.id === fileId ? { ...f, output: full } : f))
              )
            }
          } catch {
            // Bỏ qua dòng không parse được
          }
        }
      }

      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: 'done', output: full } : f))
      )
      return full
    } catch (err) {
      console.error(err)
      const errorStr = err.message || 'Đã có lỗi xảy ra khi gọi OpenRouter.'
      setFiles((prev) =>
        prev.map((f) => (f.id === fileId ? { ...f, status: 'error', errorMsg: errorStr } : f))
      )
      throw err
    }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setErrorMsg('')

    if (!apiKey.trim()) {
      setErrorMsg('Vui lòng nhập API key của OpenRouter trước.')
      return
    }
    if (files.length === 0) {
      setErrorMsg('Hãy upload ít nhất một file phụ đề .srt.')
      return
    }
    if (!model) {
      setErrorMsg('Chưa tải được model từ OpenRouter.')
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

    // Process them sequentially to display status changes clearly and avoid rate-limiting issues
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
    setStatus('idle')
  }

  function handleCopy(text) {
    if (!text.trim()) return
    navigator.clipboard.writeText(text.trim())
  }

  function handleCopyAll() {
    const allOutputs = files
      .filter((f) => f.output.trim())
      .map((f) => `=== ${f.name} ===\n\n${f.output.trim()}`)
      .join('\n\n\n')
    if (allOutputs) {
      navigator.clipboard.writeText(allOutputs)
    }
  }

  const selectedFile = files.find((f) => f.id === selectedFileId)

  return (
    <div className="page">
      <header className="masthead">
        <div className="masthead-inner">
          <span className="eyebrow">Caption · OpenRouter</span>
          <h1>Content Writer</h1>
          <p className="sub">Upload nhiều file SRT cùng lúc, đọc lời thoại và viết thành câu chuyện tiếng Tây Ban Nha.</p>
        </div>
      </header>

      <main className="desk">
        <section className="card index-card">
          <h2 className="card-title">1. Thiết lập</h2>

          <label className="field">
            <span className="field-label">OpenRouter API key</span>
            <input
              type="password"
              placeholder="sk-or-v1-..."
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              autoComplete="off"
            />
          </label>

          <div className="field">
            <span className="field-label">Tìm kiếm Model</span>
            <input
              type="text"
              placeholder="Nhập tên model để lọc..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              disabled={!models.length}
            />
          </div>

          <label className="field">
            <span className="field-label">Model ({filteredModels.length})</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} disabled={!filteredModels.length}>
              {!filteredModels.length ? (
                <option value="">{models.length ? 'Không tìm thấy model khớp' : 'Đang tải model từ OpenRouter...'}</option>
              ) : (
                filteredModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatModelLabel(m)}
                  </option>
                ))
              )}
            </select>
          </label>

          <h2 className="card-title">2. Danh sách File SRT</h2>
          <form onSubmit={handleGenerate}>
            <label className="field">
              <span className="field-label">Upload file phụ đề .srt (Chọn nhiều file)</span>
              <input type="file" accept=".srt" multiple onChange={handleSrtUpload} />
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
                      >
                        <div className="file-item-info">
                          <span className="file-item-name" title={f.name}>
                            {f.name}
                          </span>
                          <span className={`file-status-badge ${f.status}`}>
                            {f.status === 'idle' && 'Chờ xử lý'}
                            {f.status === 'loading' && 'Đang chạy...'}
                            {f.status === 'done' && 'Hoàn thành'}
                            {f.status === 'error' && 'Lỗi'}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="file-remove-btn"
                          disabled={status === 'loading'}
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemoveFile(f.id)
                          }}
                          title="Xóa file"
                        >
                          &times;
                        </button>
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
                    rows="8"
                    placeholder="Lời thoại trích từ file phụ đề sẽ hiện ở đây."
                    value={selectedFile.captionText}
                    onChange={(e) => handleCaptionChange(e.target.value)}
                  />
                </label>
                <p className="helper-text">
                  Số ký tự lời thoại: {selectedFile.captionText.trim().length.toLocaleString('vi-VN')}
                </p>
              </>
            ) : (
              <div className="no-file-selected">
                Hãy upload file SRT hoặc chọn một file từ danh sách để xem & chỉnh sửa lời thoại.
              </div>
            )}

            {errorMsg && <p className="error-text">{errorMsg}</p>}

            <button type="submit" className="generate-btn" disabled={status === 'loading' || files.length === 0}>
              {status === 'loading' ? 'Đang viết câu chuyện…' : 'Viết câu chuyện cho tất cả các file'}
            </button>
          </form>
        </section>

        <section className="card paper" ref={outputRef}>
          <div className="paper-head">
            <span className="paper-label">
              {selectedFile ? `Câu chuyện: ${selectedFile.name}` : 'Câu chuyện tiếng Tây Ban Nha'}
            </span>
            {selectedFile && selectedFile.output && (
              <span className="word-count">
                {selectedFile.output.trim().length.toLocaleString('vi-VN')} ký tự
              </span>
            )}
          </div>

          {!selectedFile ? (
            <p className="placeholder">Hãy tải file phụ đề lên để bắt đầu.</p>
          ) : selectedFile.status === 'idle' && !selectedFile.output ? (
            <p className="placeholder">Chờ viết câu chuyện cho file "{selectedFile.name}"...</p>
          ) : selectedFile.status === 'loading' && !selectedFile.output ? (
            <p className="placeholder">Đang chuẩn bị viết...</p>
          ) : selectedFile.output ? (
            <div className="output-text">
              {selectedFile.output.split(/\n+/).map((para, i) =>
                para.trim() ? <p key={`${para.slice(0, 16)}-${i}`}>{para}</p> : null
              )}
            </div>
          ) : selectedFile.errorMsg ? (
            <div className="error-text">Lỗi: {selectedFile.errorMsg}</div>
          ) : null}

          {selectedFile && selectedFile.output && selectedFile.status !== 'loading' && (
            <div className="action-buttons">
              <button type="button" className="copy-btn" onClick={() => handleCopy(selectedFile.output)}>
                Sao chép truyện hiện tại
              </button>
            </div>
          )}

          {files.some((f) => f.output.trim()) && status !== 'loading' && (
            <button type="button" className="copy-all-btn" onClick={handleCopyAll}>
              Sao chép tất cả truyện đã viết ({files.filter((f) => f.output.trim()).length})
            </button>
          )}
        </section>
      </main>

      <footer className="foot">
        API key chỉ được giữ trong bộ nhớ của trang và gửi thẳng tới openrouter.ai, không đi qua máy chủ nào khác.
      </footer>
    </div>
  )
}

