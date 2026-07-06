import React from 'react'

export function parseSrtCaptions(srtText) {
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

export function SrtList({
  files,
  setFiles,
  selectedFileId,
  setSelectedFileId,
  status,
  setErrorMsg,
  showTemporarySuccess
}) {
  const handleSrtUpload = async (e) => {
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
      setFiles((prev) => [...prev, ...newFiles])
      setSelectedFileId((currentId) => currentId || newFiles[0].id)
      showTemporarySuccess(`Tải thành công ${newFiles.length} file phụ đề!`)
    }

    e.target.value = ''
  }

  const handleRemoveFile = (fileId) => {
    setFiles((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId)
      if (selectedFileId === fileId) {
        setSelectedFileId(filtered[0]?.id || null)
      }
      return filtered
    })
  }

  const handleClearAll = () => {
    setFiles([])
    setSelectedFileId(null)
    setErrorMsg('')
  }

  return (
    <>
      <h2 className="card-title">2. Danh sách File SRT</h2>
      <label className="field">
        <span className="field-label">Upload file phụ đề .srt (Chọn nhiều tệp)</span>
        <input
          type="file"
          accept=".srt"
          multiple
          onChange={handleSrtUpload}
          disabled={status === 'loading'}
        />
      </label>

      {files.length > 0 && (
        <div className="file-list-container" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="file-list-header">
            <span className="field-label">Hàng đợi ({files.length})</span>
            <button
              type="button"
              className="clear-all-btn"
              onClick={handleClearAll}
              disabled={status === 'loading'}
            >
              Xóa tất cả
            </button>
          </div>
          <div className="file-items" style={{ flex: 1, overflowY: 'scroll' }}>
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
    </>
  )
}

export function SrtEditor({ selectedFile, setFiles, status }) {
  if (!selectedFile) {
    return (
      <div className="no-file-selected" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0 1.5rem 0' }}>
        Hãy upload file SRT hoặc chọn một file từ danh sách để xem lời thoại.
      </div>
    )
  }

  const handleChange = (newText) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === selectedFile.id ? { ...f, captionText: newText } : f))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <label className="field" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0, overflow: 'hidden' }}>
        <span className="field-label">Lời thoại đã trích xuất ({selectedFile.name})</span>
        <textarea
          style={{ flex: 1, minHeight: '60px', resize: 'none' }}
          placeholder="Lời thoại trích từ file phụ đề sẽ hiện ở đây."
          value={selectedFile.captionText}
          onChange={(e) => handleChange(e.target.value)}
          disabled={status === 'loading'}
        />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', marginBottom: '0.5rem' }}>
        <p className="helper-text" style={{ margin: 0 }}>
          Số ký tự lời thoại: {selectedFile.captionText.trim().length.toLocaleString('vi-VN')}
        </p>
      </div>
    </div>
  )
}
