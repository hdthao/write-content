import React, { useState } from 'react'

export const SUPPORTED_LANGUAGES = [
  { code: 'Spanish', name: 'Tiếng Tây Ban Nha' },
  { code: 'English', name: 'Tiếng Anh' },
  { code: 'Vietnamese', name: 'Tiếng Việt' },
  { code: 'Chinese', name: 'Tiếng Trung' },
  { code: 'Japanese', name: 'Tiếng Nhật' },
  { code: 'Korean', name: 'Tiếng Hàn' },
  { code: 'French', name: 'Tiếng Pháp' },
  { code: 'German', name: 'Tiếng Đức' },
  { code: 'Russian', name: 'Tiếng Nga' },
  { code: 'Italian', name: 'Tiếng Ý' },
  { code: 'Portuguese', name: 'Tiếng Bồ Đào Nha' }
]

export function TranslationList({
  translations,
  setTranslations,
  selectedTranslationId,
  setSelectedTranslationId,
  status,
  setErrorMsg,
  showTemporarySuccess
}) {
  const [pasteText, setPasteText] = useState('')
  const [selectedLang, setSelectedLang] = useState('Spanish')

  const handleFileUpload = async (e) => {
    const inputFiles = Array.from(e.target.files || [])
    setErrorMsg('')

    if (inputFiles.length === 0) return

    const newItems = []
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
          setErrorMsg(`Không tìm thấy nội dung nào trong file: ${file.name}`)
          continue
        }

        lines.forEach((line, idx) => {
          const snippet = line.length > 30 ? line.slice(0, 30) + '...' : line
          newItems.push({
            id: `trans-${Date.now()}-${Math.random()}`,
            name: `${file.name} - Dòng ${idx + 1}: ${snippet}`,
            contentText: line,
            targetLanguage: selectedLang,
            status: 'idle',
            output: '',
            errorMsg: '',
          })
        })
      } catch (err) {
        console.error(err)
        setErrorMsg(`Không đọc được file ${file.name}.`)
      }
    }

    if (newItems.length > 0) {
      setTranslations((prev) => [...prev, ...newItems])
      setSelectedTranslationId((currentId) => currentId || newItems[0].id)
      showTemporarySuccess(`Tải thành công ${newItems.length} mục dịch thuật!`)
    }
    e.target.value = ''
  }

  const handleAddPastedText = () => {
    setErrorMsg('')
    const trimmedInput = pasteText.trim()
    if (!trimmedInput) {
      setErrorMsg('Vui lòng nhập nội dung cần dịch.')
      return
    }

    const snippet = trimmedInput.length > 30 ? trimmedInput.slice(0, 30) + '...' : trimmedInput
    const newItems = [{
      id: `trans-${Date.now()}-${Math.random()}`,
      name: snippet,
      contentText: trimmedInput,
      targetLanguage: selectedLang,
      status: 'idle',
      output: '',
      errorMsg: '',
    }]

    setTranslations((prev) => [...prev, ...newItems])
    setSelectedTranslationId((currentId) => currentId || newItems[0].id)
    setPasteText('')
    showTemporarySuccess(`Đã thêm thành công 1 mục dịch thuật!`)
  }

  const handleRemoveItem = (itemId) => {
    setTranslations((prev) => {
      const filtered = prev.filter((t) => t.id !== itemId)
      if (selectedTranslationId === itemId) {
        setSelectedTranslationId(filtered[0]?.id || null)
      }
      return filtered
    })
  }

  const handleClearAll = () => {
    setTranslations([])
    setSelectedTranslationId(null)
    setErrorMsg('')
  }

  return (
    <>
      <h2 className="card-title">2. Thiết lập Dịch thuật</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', marginBottom: '1rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Chọn ngôn ngữ dịch đích</span>
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              disabled={status === 'loading'}
              style={{ padding: '0.55rem', fontSize: '0.85rem' }}
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </label>

          <label className="field" style={{ margin: 0 }}>
            <span className="field-label">Tải tệp văn bản dịch (.txt)</span>
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              disabled={status === 'loading'}
              style={{ padding: '0.45rem', fontSize: '0.8rem' }}
            />
          </label>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          <span className="field-label" style={{ margin: 0 }}>Dán trực tiếp nội dung cần dịch</span>
          <textarea
            placeholder="Nhập hoặc dán nội dung văn bản ở đây..."
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            style={{ minHeight: '5rem', fontSize: '0.85rem' }}
            disabled={status === 'loading'}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.2rem' }}>
            <button
              type="button"
              className="copy-btn"
              style={{ margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', background: 'var(--moss)', color: '#fff' }}
              onClick={handleAddPastedText}
              disabled={status === 'loading' || !pasteText.trim()}
            >
              Thêm nội dung
            </button>
          </div>
        </div>
      </div>

      {translations.length > 0 && (
        <div className="file-list-container" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
          <div className="file-list-header">
            <span className="field-label">Hàng đợi dịch thuật ({translations.length})</span>
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
            {translations.map((t) => {
              const isSelected = t.id === selectedTranslationId
              const langObj = SUPPORTED_LANGUAGES.find((l) => l.code === t.targetLanguage) || SUPPORTED_LANGUAGES[0]
              return (
                <div
                  key={t.id}
                  className={`file-item ${isSelected ? 'active' : ''} ${t.status}`}
                  onClick={() => setSelectedTranslationId(t.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="file-item-info">
                    <span className="file-item-name" title={t.contentText}>
                      {t.name}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginTop: '0.15rem' }}>
                      <span className={`file-status-badge ${t.status}`}>
                        {t.status === 'idle' && '⏳ Chờ dịch'}
                        {t.status === 'loading' && '⚙️ Đang dịch...'}
                        {t.status === 'done' && '✅ Hoàn thành'}
                        {t.status === 'error' && '❌ Lỗi'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--amber)', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 'bold' }}>
                        ➔ Dịch sang: {langObj.name}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <button
                      type="button"
                      className="file-remove-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleRemoveItem(t.id)
                      }}
                      title="Xóa mục dịch"
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

export function TranslationEditor({ selectedTranslation, setTranslations, status }) {
  if (!selectedTranslation) {
    return (
      <div className="no-file-selected" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0 1.5rem 0' }}>
        Hãy nhập nội dung dịch hoặc tải lên tệp tin, sau đó chọn một mục trong hàng đợi để biên tập.
      </div>
    )
  }

  const handleTextChange = (newText) => {
    setTranslations((prev) =>
      prev.map((t) => (t.id === selectedTranslation.id ? { ...t, contentText: newText } : t))
    )
  }

  const handleLangChange = (newLang) => {
    setTranslations((prev) =>
      prev.map((t) => (t.id === selectedTranslation.id ? { ...t, targetLanguage: newLang } : t))
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="field-label" style={{ margin: 0 }}>Nội dung gốc biên tập</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'flex-end' }}>
          <span className="field-label" style={{ margin: 0, fontSize: '0.7rem' }}>Ngôn ngữ:</span>
          <select
            value={selectedTranslation.targetLanguage}
            onChange={(e) => handleLangChange(e.target.value)}
            disabled={status === 'loading'}
            style={{ width: 'auto', padding: '0.2rem 0.5rem', fontSize: '0.75rem', borderRadius: '4px' }}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <textarea
        style={{ flex: 1, minHeight: '60px', resize: 'none' }}
        placeholder="Nhập nội dung cần chỉnh sửa ở đây..."
        value={selectedTranslation.contentText}
        onChange={(e) => handleTextChange(e.target.value)}
        disabled={status === 'loading'}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.3rem', marginBottom: '0.5rem' }}>
        <p className="helper-text" style={{ margin: 0 }}>
          Ký tự: {selectedTranslation.contentText.trim().length.toLocaleString('vi-VN')} | Từ: {selectedTranslation.contentText.split(/\s+/).filter(Boolean).length}
        </p>
      </div>
    </div>
  )
}
