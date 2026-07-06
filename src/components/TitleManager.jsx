import React, { useState } from 'react'

export function TitleList({
  titles,
  setTitles,
  selectedTitleId,
  setSelectedTitleId,
  status,
  setErrorMsg,
  showTemporarySuccess
}) {
  const [pasteTitlesText, setPasteTitlesText] = useState('')

  const handleTitleFileUpload = async (e) => {
    const inputFiles = Array.from(e.target.files || [])
    setErrorMsg('')

    if (inputFiles.length === 0) return

    const newTitles = []
    for (const file of inputFiles) {
      if (!file.name.toLowerCase().endsWith('.txt')) {
        setErrorMsg(`File "${file.name}" không phải định dạng .txt.`)
        continue
      }

      try {
        const text = await file.text()
        const lines = text
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)

        if (lines.length === 0) {
          setErrorMsg(`Không tìm thấy tiêu đề nào trong file: ${file.name}`)
          continue
        }

        lines.forEach((line) => {
          newTitles.push({
            id: `title-${Date.now()}-${Math.random()}`,
            name: line,
            titleText: line,
            status: 'idle',
            output: '',
            imagePrompt: '',
            errorMsg: '',
          })
        })
      } catch (err) {
        console.error(err)
        setErrorMsg(`Không đọc được file ${file.name}.`)
      }
    }

    if (newTitles.length > 0) {
      setTitles((prev) => [...prev, ...newTitles])
      setSelectedTitleId((currentId) => currentId || newTitles[0].id)
      showTemporarySuccess(`Tải thành công ${newTitles.length} tiêu đề!`)
    }
    e.target.value = ''
  }

  const handleAddPastedTitles = () => {
    setErrorMsg('')
    const lines = pasteTitlesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    if (lines.length === 0) {
      setErrorMsg('Vui lòng nhập ít nhất một tiêu đề.')
      return
    }

    const newTitles = lines.map((line) => ({
      id: `title-${Date.now()}-${Math.random()}`,
      name: line,
      titleText: line,
      status: 'idle',
      output: '',
      imagePrompt: '',
      errorMsg: '',
    }))

    setTitles((prev) => [...prev, ...newTitles])
    setSelectedTitleId((currentId) => currentId || newTitles[0].id)
    setPasteTitlesText('')
    showTemporarySuccess(`Đã thêm thành công ${newTitles.length} tiêu đề!`)
  }

  const handleRemoveTitle = (titleId) => {
    setTitles((prev) => {
      const filtered = prev.filter((t) => t.id !== titleId)
      if (selectedTitleId === titleId) {
        setSelectedTitleId(filtered[0]?.id || null)
      }
      return filtered
    })
  }

  const handleClearAll = () => {
    setTitles([])
    setSelectedTitleId(null)
    setErrorMsg('')
  }

  return (
    <>
      <h2 className="card-title">2. Danh sách Tiêu đề</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1rem' }}>
        <label className="field" style={{ margin: 0 }}>
          <span className="field-label">Tải lên tệp tiêu đề (.txt - Mỗi tiêu đề một dòng)</span>
          <input
            type="file"
            accept=".txt"
            onChange={handleTitleFileUpload}
            disabled={status === 'loading'}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span className="field-label" style={{ margin: 0 }}>Hoặc dán danh sách tiêu đề trực tiếp (Mỗi tiêu đề một dòng)</span>
          <textarea
            placeholder="Ví dụ:&#10;Tiêu đề drama 1&#10;Tiêu đề drama 2"
            value={pasteTitlesText}
            onChange={(e) => setPasteTitlesText(e.target.value)}
            style={{ minHeight: '5rem', fontSize: '0.85rem' }}
            disabled={status === 'loading'}
          />
          <button
            type="button"
            className="copy-btn"
            style={{ margin: '0.2rem 0 0 auto', padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--moss)', color: '#fff' }}
            onClick={handleAddPastedTitles}
            disabled={status === 'loading' || !pasteTitlesText.trim()}
          >
            Thêm danh sách
          </button>
        </div>
      </div>

      {titles.length > 0 && (
        <div className="file-list-container" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="file-list-header">
            <span className="field-label">Hàng đợi tiêu đề ({titles.length})</span>
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
            {titles.map((t) => {
              const isSelected = t.id === selectedTitleId
              return (
                <div
                  key={t.id}
                  className={`file-item ${isSelected ? 'active' : ''} ${t.status}`}
                  onClick={() => setSelectedTitleId(t.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="file-item-info">
                    <span className="file-item-name" title={t.name}>
                      {t.name}
                    </span>
                    <span className={`file-status-badge ${t.status}`}>
                      {t.status === 'idle' && '⏳ Chờ xử lý'}
                      {t.status === 'loading' && '⚙️ Đang viết bằng Chrome Cookies (Chạy ngầm)...'}
                      {t.status === 'done' && '✅ Hoàn thành'}
                      {t.status === 'error' && '❌ Lỗi'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="file-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveTitle(t.id)
                      }}
                      title="Xóa tiêu đề"
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

export function TitleEditor({ selectedTitle, setTitles, status }) {
  if (!selectedTitle) {
    return (
      <div className="no-file-selected" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0 1.5rem 0' }}>
        Hãy nhập danh sách hoặc tải lên tệp tiêu đề, sau đó chọn một tiêu đề để biên tập.
      </div>
    )
  }

  const handleChange = (newText) => {
    setTitles((prev) =>
      prev.map((t) => (t.id === selectedTitle.id ? { ...t, titleText: newText } : t))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <label className="field" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0, overflow: 'hidden' }}>
        <span className="field-label">Tiêu đề gốc</span>
        <textarea
          style={{ flex: 1, minHeight: '60px', resize: 'none' }}
          placeholder="Nhập tiêu đề ở đây..."
          value={selectedTitle.titleText}
          onChange={(e) => handleChange(e.target.value)}
          disabled={status === 'loading'}
        />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', marginBottom: '0.5rem' }}>
        <p className="helper-text" style={{ margin: 0 }}>
          Số ký tự tiêu đề: {selectedTitle.titleText.trim().length.toLocaleString('vi-VN')}
        </p>
      </div>
    </div>
  )
}
