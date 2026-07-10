import React, { useState, useEffect, useRef } from 'react'
import * as XLSX from 'xlsx'
import { SrtList, SrtEditor } from './components/SrtManager'
import { TitleList, TitleEditor } from './components/TitleManager'

function buildPrompt(captionText) {
  return `Đây là kịch bản của một video drama ngắn 10 giây. Hãy viết một câu chuyện kịch tính, lôi cuốn người đọc dựa trên kịch bản này bằng tiếng Tây Ban Nha theo các yêu cầu sau:

Kịch bản trích từ file SRT:
"""
${captionText}
"""

Yêu cầu về định dạng và cấu trúc câu truyện (CỰC KỲ QUAN TRỌNG - PHẢI TUÂN THỦ CHÍNH XÁC):
1. Viết toàn bộ câu chuyện bằng tiếng Tây Ban Nha tự nhiên, diễn cảm.
2. Tiêu đề câu chuyện (Title Formatting) - BẮT BUỘC TUÂN THỦ ĐÚNG 3 DÒNG ĐẦU TIÊN:
   - Dòng đầu tiên: Tiêu đề viết hoa toàn bộ (ALL CAPS), dài từ 10 đến 15 từ, và TUYỆT ĐỐI KHÔNG chứa bất kỳ emoji nào.
   - Dòng thứ hai: Ghi rõ "PARTE 1" (không thêm ký tự hay từ nào khác).
   - Dòng thứ ba: Để trống hoàn toàn.
3. Cấu trúc nhịp điệu dồn dập (Sentence Length & Pacing):
   - Bắt đầu câu chuyện (ngay sau dòng trống của tiêu đề) bằng một câu hook (lời thoại kịch tính hoặc tuyên bố bất ngờ) cực kỳ hấp dẫn, gây tò mò ngay lập tức cho người đọc.
   - Từng câu trong câu chuyện phải ngắn, gọn gàng, súc tích.
   - Chia câu chuyện thành các đoạn văn ngắn.
   - Mỗi đoạn văn chỉ chứa **từ 1 đến tối đa 2 câu ngắn**.
   - BẮT BUỘC xuống dòng tạo dòng trống liên tục giữa các đoạn văn ngắn để người đọc dễ lướt.
4. Định dạng lời thoại (Dialogue Formatting):
   - Lời thoại trực tiếp bắt đầu bằng dấu gạch ngang dài (—) và đặt ở một dòng riêng biệt.
5. Tuyệt đối KHÔNG sử dụng các emoji rải rác trong tiêu đề và nội dung câu chuyện.
6. Bắt buộc kết thúc câu chuyện bằng dòng kêu gọi hành động sau (đây là nơi DUY NHẤT chứa emoji):
   Comenta “YES” si quieres ver la parte 2. 👇😢 
   #peliculas #viralvideos #spain #cdrama #edit #espana #kdramascenes
7. Độ dài của câu chuyện (không tính tiêu đề và dòng kêu gọi hành động) phải nằm trong khoảng từ 500 đến 600 từ.
8. Tuyệt đối chỉ trả về nội dung câu chuyện, không thêm bất kỳ lời mở đầu, giải thích hay ghi chú nào ngoài lề. Không viết mã code hay dùng khối code.

ABSOLUTE OUTPUT RULES:
- Return only the final Spanish story.
- Do not output analysis, reasoning, comments, markdown, Python, JavaScript, variables, verification scripts, word counts, or formatting notes.
- The first non-empty line must be the ALL CAPS Spanish title. The second line must be exactly PARTE 1. The third line must be blank.`
}

function buildTitlePrompt(titleText) {
  return `Bạn là một người kể chuyện chuyên nghiệp và tiểu thuyết gia tài ba, có khả năng tạo ra những câu chuyện hấp dẫn, giàu cảm xúc và khó lòng đặt xuống.

Dựa vào tiêu đề sau:
TIÊU ĐỀ GỐC: ${titleText}

LƯU Ý QUAN TRỌNG VỀ DÒNG ĐẦU TIÊN (HOOK):
- Dòng đầu tiên của kết quả phải là phần mở đầu (hook) của câu chuyện viết bằng tiếng Tây Ban Nha, được dịch và viết lại một cách cực kỳ cuốn hút, kịch tính dựa trên nội dung của TIÊU ĐỀ GỐC.
- Cấu trúc của câu hook phải bắt đầu bằng một xung đột hoặc tình huống cao trào (phản bội, xúc phạm, khinh thường, hoặc hành vi xấu xa) và BẮT BUỘC phải kết thúc bằng một cú ngoặt bất ngờ (plot twist) hoặc một bí mật/kế hoạch trả thù chuẩn bị diễn ra để gây tò mò cực độ cho người xem (ví dụ: "...hắn không hề hay biết rằng...", "...không bao giờ ngờ rằng...", "...và người đàn ông bắt đầu run rẩy").
- Bạn TUYỆT ĐỐI KHÔNG viết lại tiêu đề của câu chuyện (không viết các tiêu đề ngắn kiểu tên truyện ở dòng đầu tiên). Hãy bắt đầu trực tiếp bằng câu hook này ở dòng đầu tiên.
- Dòng đầu tiên này chỉ viết hoa chữ cái đầu hoặc theo đúng quy tắc ngữ pháp, tuyệt đối KHÔNG viết hoa toàn bộ (ALL CAPS) và không chứa emoji.

Hãy viết TOÀN BỘ câu chuyện từ đầu đến cuối, hoàn toàn bằng tiếng Tây Ban Nha theo các yêu cầu sau:

Yêu cầu bắt buộc:

- Toàn bộ phần nội dung câu chuyện phải có tối thiểu 3000 từ, không tính tiêu đề. Để tránh bị thiếu độ dài, hãy viết khoảng 3000-3200 từ. Không dùng tiêu chuẩn ký tự; chỉ tính theo số từ. Đây là điều kiện hoàn thành quan trọng nhất: nếu chưa đạt ít nhất 3000 từ thì tuyệt đối chưa được kết thúc câu chuyện.

- Câu chuyện phải cực kỳ lôi cuốn, giàu cảm xúc và hấp dẫn ngay từ câu đầu tiên để người đọc không thể ngừng đọc.

- Xây dựng sự căng thẳng một cách tự nhiên và mang đến một cái kết bất ngờ, gây sốc và khó đoán mà KHÔNG AI có thể dự đoán được — tạo nên một cái kết bất ngờ và có hậu.

- Viết theo phong cách tiểu thuyết sống động với những mô tả phong phú, cảm xúc sâu sắc và lời thoại tự nhiên

- Các đoạn hội thoại PHẢI LUÔN được xuống dòng mới và bắt đầu bằng dấu gạch ngang (—). Mỗi dòng hội thoại nằm trên một đoạn/dòng riêng biệt.
Ví dụ:
— Tôi không biết anh sẽ đến, cô ấy nói mà không nhìn anh.
— Tôi phải làm vậy, anh trả lời.
Hãy viết toàn bộ câu chuyện ngay bây giờ, không tóm tắt hay cảnh báo, trực tiếp nội dung tường thuật.`
}

function buildImagePromptPrompt(storyText) {
  return `Hãy tạo một prompt tiếng Anh để tạo ra 1 hình ảnh mô tả phần hấp dẫn nhất của câu chuyện sau.

Yêu cầu bắt buộc:
- Prompt tạo ảnh phải viết hoàn toàn bằng tiếng Anh.
- Write the image prompt in natural lowercase/sentence case. Do not write it in ALL CAPS.
- Chỉ trả về đúng prompt tạo ảnh, không giải thích, không markdown, không dùng danh sách.
- Hình ảnh phải mô tả khoảnh khắc hấp dẫn, kịch tính và giàu cảm xúc nhất của câu chuyện.
- Màu sắc nên tươi sáng, chân thực, sắc nét và thu hút ngay từ cái nhìn đầu tiên.
- Mô tả rõ bối cảnh xung quanh: địa điểm, thời điểm trong ngày, ánh sáng, không khí, đồ vật quan trọng, hậu cảnh và những chi tiết thị giác giúp người xem hiểu ngay chuyện gì đang xảy ra.
- Mô tả rõ nhân vật chính: tuổi ước lượng, giới tính nếu câu chuyện cho biết, trang phục, tư thế, vị trí trong khung hình và hành động chính đang diễn ra.
- Mô tả rõ biểu cảm của nhân vật chính: ánh mắt, cơ mặt, cảm xúc nổi bật, mức độ căng thẳng, sợ hãi, tức giận, đau lòng, chiến thắng hoặc bình tĩnh tùy theo câu chuyện.
- Mô tả rõ hành động và phản ứng của các nhân vật phụ: họ đang làm gì, nhìn về đâu, cơ thể phản ứng thế nào và cảm xúc thể hiện ra sao.
- Nhấn mạnh body language: bàn tay, vai, dáng đứng/ngồi, khoảng cách giữa các nhân vật, chuyển động của cơ thể và các vật thể đang rơi/vỡ/được trao/được giấu nếu có.
- Prompt ảnh phải có bố cục điện ảnh rõ ràng: foreground, middle ground, background, camera angle, lens feel, depth of field, dynamic lighting, sharp focus.
- Tránh mô tả chung chung. Hãy tạo một cảnh cụ thể như một khung hình phim, giàu chi tiết, có hành động rõ và cảm xúc mạnh.
- Trong hình ảnh, hãy thể hiện hành động của các nhân vật một cách sống động.
- Cảm xúc phải được thể hiện rõ ràng trên khuôn mặt và truyền tải qua cử động cơ thể.
- TẤT CẢ NHÂN VẬT trong hình đều phải là người Tây Ban Nha hoặc Mỹ La Tinh.
- Viết prompt theo phong cách ảnh cinematic realistic, high detail, sharp focus, vibrant colors.

Câu chuyện:
"""
${storyText}
"""`
}

function normalizeImagePromptOutput(outputText) {
  const cleaned = outputText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !/^(PARTE|PART|SECCION|SECCIÓN|SECTION|CAPITULO|CAPÍTULO|CHAPTER)\s*[-:]?\s*1\b/i.test(line))
    .join(' ')
    .trim()
    .replace(/^```(?:[a-zA-Z0-9_?&=]+)?\n([\s\S]*?)\n```$/i, '$1')
    .replace(/^(image prompt|prompt|final prompt)\s*:\s*/i, '')
    .replace(/^["'`]+/, '')
    .replace(/["'`]+$/, '')
    .trim()

  const letters = cleaned.replace(/[^A-Za-z]/g, '')
  if (!letters) return cleaned

  const upperLetters = letters.replace(/[a-z]/g, '').length
  if (upperLetters / letters.length <= 0.75) return cleaned

  const lower = cleaned.toLocaleLowerCase('en')
  return lower.charAt(0).toLocaleUpperCase('en') + lower.slice(1)
}

function normalizeGeneratedStoryOutput(outputText, itemType = 'srt') {
  const isTitleMode = itemType === 'titles'
  const removeEmoji = (text) =>
    text.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')

  const unwrapCodeStringLine = (line) =>
    line
      .trim()
      .replace(/^\s*(?:const|let|var)?\s*(title|titulo|título|story_title|story_template|story_content|story|content|output)\s*=\s*(?:[rubf]+)?("""|'''|`{3}|["'`])/i, '')
      .replace(/("""|'''|`{3}|["'`])\s*[;,]?\s*$/, '')
      .trim()

  const cleanLine = (line) => {
    let cleaned = unwrapCodeStringLine(line)
      .replace(/^[#>*\s]+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^(title|titulo|título|story title)\s*=\s*/i, '')
      .replace(/^(title|titulo|título|story title)\s*:\s*/i, '')
      .replace(/^["'`]+/, '')
      .replace(/["'`,]+$/, '')
      .trim()
    if (cleaned.startsWith('—') && /\s*[\u2014\u2013-]\s*$/.test(cleaned)) {
      cleaned = cleaned.replace(/\s*[\u2014\u2013-]\s*$/, '').trim()
      if (!/[.!?…]$/.test(cleaned)) {
        cleaned += '.'
      }
    }
    return cleaned
  }

  const isParteLine = (line) => /^(PARTE|PART|SECCION|SECCIÓN|SECTION|CAPITULO|CAPÍTULO|CHAPTER)\s*[-:]?\s*1\b/i.test(line.trim())

  const isJunkLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return (
      /^```/.test(trimmed) ||
      /^[-*_]{3,}$/.test(trimmed) ||
      /code_reference|code_event_index/i.test(trimmed) ||
      /^#/.test(trimmed) ||
      /^\/\//.test(trimmed) ||
      /^\/\*/.test(trimmed) ||
      /^\*\//.test(trimmed) ||
      /^python\??$/i.test(trimmed) ||
      /^SCRIPT\b/i.test(trimmed) ||
      /^(here is|here's|sure|claro|por supuesto|aquí tienes|aqui tienes|final story|historia final|cuento final|respuesta)\b/i.test(trimmed) ||
      /^[-*]\s*(line\s*\d+|length|formatting|dialogue starts|no emojis|cta)\s*:/i.test(trimmed) ||
      /^(analysis|reasoning|notes?|instructions?|formatting|length|word count|word count of title|title word count|line\s*\d+|dialogue starts|no emojis|cta)\s*:/i.test(trimmed) ||
      /^(the user wants|the task|based on|requirements?|format|hook sentence)\b/i.test(trimmed) ||
      /^perfect\b.*\bwords?\b/i.test(trimmed) ||
      /^[a-zA-Z_][a-zA-Z0-9_]*\s*=[^=]/.test(trimmed) ||
      /^(for|if|while|const|let|var|function|return|print|console\.log)\b/.test(trimmed) ||
      /^[{}\[\]();,]+$/.test(trimmed) ||
      /\b(paragraph|paragraphs|line|lines|dialogue|dialogues|separate|string|strings|build|word|words|count|length|verify|formatting|verification|script|code|snippet)\b/i.test(trimmed) ||
      /^(mam[aá]|est[aá]s|ustedes)\b.*\(.+\)$/i.test(trimmed) ||
      /^("""|'''|`{3})$/.test(trimmed)
    )
  }

  const wordCount = (line) => line.split(/\s+/).filter(Boolean).length
  const isLikelyTitle = (line) => {
    const cleaned = removeEmoji(line).trim()
    const words = wordCount(cleaned)
    if (words < 5 || words > 20) return false
    if (isParteLine(cleaned) || isJunkLine(cleaned)) return false
    if (/[.!?¿¡]$/.test(cleaned)) return false
    const letters = cleaned.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
    if (!letters) return false
    const upperLetters = letters.replace(/[a-záéíóúüñ]/g, '').length
    return upperLetters / letters.length > 0.65
  }

  const isTitleContinuation = (line) => {
    const cleaned = removeEmoji(line).trim()
    if (!cleaned || isParteLine(cleaned) || isJunkLine(cleaned)) return false
    if (/[.!?¿¡]$/.test(cleaned)) return false
    const letters = cleaned.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '')
    if (!letters) return false
    const upperLetters = letters.replace(/[a-záéíóúüñ]/g, '').length
    return upperLetters / letters.length > 0.65
  }

  const rawLines = outputText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(cleanLine)

  const lines = rawLines.filter((line) => !isJunkLine(line))
  const titleIndex = lines.findIndex(isLikelyTitle)
  const fallbackTitleIndex = titleIndex === -1 ? lines.findIndex((line) => line.trim() && !isParteLine(line)) : titleIndex

  if (fallbackTitleIndex === -1) {
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
  }

  let titleEndIndex = fallbackTitleIndex
  while (titleEndIndex + 1 < lines.length && isTitleContinuation(lines[titleEndIndex + 1])) {
    titleEndIndex += 1
  }

  const titleRaw = removeEmoji(lines.slice(fallbackTitleIndex, titleEndIndex + 1).join(' '))
    .replace(/^[\s#*_\-]+/, '')
    .replace(/[\s*_\-]+$/, '')
    .trim()

  const formatTitle = (value) => {
    const trimmed = value.replace(/\s+/g, ' ').trim()
    const letters = trimmed.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, '')
    if (!letters) return trimmed

    const upperLetters = letters.replace(/[a-zà-öø-ÿ]/g, '').length
    if (upperLetters / letters.length <= 0.75) return trimmed

    const lower = trimmed.toLocaleLowerCase('es')
    return lower.charAt(0).toLocaleUpperCase('es') + lower.slice(1)
  }

  const title = isTitleMode ? formatTitle(titleRaw) : titleRaw.toUpperCase()
  const normalizedTitleForCompare = removeEmoji(titleRaw).trim().toUpperCase()

  const ensureSentencePunctuation = (value) => /[.!?…]$/.test(value.trim()) ? value.trim() : `${value.trim()}.`

  const capitalizeSpanishSentence = (value) => {
    const trimmed = value.trim()
    const firstLetterIndex = trimmed.search(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/)
    if (firstLetterIndex === -1) return trimmed
    return `${trimmed.slice(0, firstLetterIndex)}${trimmed.charAt(firstLetterIndex).toLocaleUpperCase('es')}${trimmed.slice(firstLetterIndex + 1)}`
  }

  const splitLongSentence = (sentence) => {
    const trimmed = sentence.trim()
    if (!trimmed || trimmed.startsWith('—') || wordCount(trimmed) <= 24) return [trimmed]

    const clauses = trimmed
      .replace(/[.!?…]+$/, '')
      .split(/[,;:]\s+|\s+(?:pero|porque|aunque|mientras|cuando|así que|entonces|y entonces)\s+/i)
      .map((part) => part.trim())
      .filter(Boolean)

    const chunks = clauses.length > 1 ? clauses : []
    if (!chunks.length) {
      const words = trimmed.replace(/[.!?…]+$/, '').split(/\s+/).filter(Boolean)
      for (let i = 0; i < words.length; i += 16) {
        chunks.push(words.slice(i, i + 16).join(' '))
      }
    }

    const sentences = []
    let current = ''
    for (const chunk of chunks) {
      const candidate = current ? `${current} ${chunk}` : chunk
      if (current && wordCount(candidate) > 20) {
        sentences.push(current)
        current = chunk
      } else {
        current = candidate
      }
    }
    if (current) sentences.push(current)

    return sentences.map((part) => capitalizeSpanishSentence(ensureSentencePunctuation(part)))
  }

  const formatTitleModeParagraph = (paragraph) => {
    const sentences = paragraph
      .replace(/\s+/g, ' ')
      .match(/[^.!?…]+[.!?…]+(?:["”»])?|[^.!?…]+$/g) || [paragraph]

    return sentences.flatMap(splitLongSentence).filter(Boolean)
  }

  const pushFormattedLine = (line) => {
    const normalized = line
      .replace(/\u2014\.\s+/g, '\u2014\n')
      .replace(/([.!?])\s+(\u2014(?=\S))/g, '$1\n$2')
      .replace(/([^\n])\s+(\u2014(?=\S))/g, (match, before, dash, offset, value) => {
        const previous = value.slice(Math.max(0, offset - 80), offset)
        return /[.!?]\s*$/.test(previous) ? `${before}\n${dash}` : match
      })

    normalized.split('\n').forEach((part) => {
      const cleanedPart = part.trim()
      if (!cleanedPart) return
      if (cleanedPart.startsWith('—')) {
        bodyLines.push(cleanedPart)
        return
      }
      formatTitleModeParagraph(cleanedPart).forEach((shortLine) => {
        bodyLines.push(shortLine)
      })
    })
  }

  const bodyLines = []
  let previousWasBlank = false
  for (let i = titleEndIndex + 1; i < lines.length; i++) {
    let line = lines[i].trim()
    if (isJunkLine(line)) continue
    if (isParteLine(line)) continue
    if (removeEmoji(line).trim().toUpperCase() === normalizedTitleForCompare) continue

    const isCta = /^Comenta\b/i.test(line)
    if (line.includes('peliculas #viralvideos')) {
      continue
    }
    if (!isCta) {
      line = removeEmoji(line).trim()
    } else if (itemType === 'srt') {
      if (!line.includes('#peliculas') && !line.includes('peliculas #viralvideos')) {
        line = `${line}\n#peliculas #viralvideos #spain #cdrama #edit #espana #kdramascenes`
      }
    }
    if (!line) {
      if (bodyLines.length && !previousWasBlank) {
        bodyLines.push('')
        previousWasBlank = true
      }
      continue
    }

    if (isTitleMode) {
      pushFormattedLine(line)
    } else {
      bodyLines.push(line)
    }
    previousWasBlank = false
  }

  if (itemType === 'srt') {
    let hasCta = false
    for (let j = 0; j < bodyLines.length; j++) {
      if (bodyLines[j].includes('#peliculas') || bodyLines[j].includes('peliculas #viralvideos')) {
        hasCta = true
        break
      }
    }
    if (!hasCta && bodyLines.length > 0) {
      let lastLineIndex = -1
      for (let j = bodyLines.length - 1; j >= 0; j--) {
        if (bodyLines[j].trim()) {
          lastLineIndex = j
          break
        }
      }
      if (lastLineIndex !== -1) {
        bodyLines[lastLineIndex] = `${bodyLines[lastLineIndex]}\n#peliculas #viralvideos #spain #cdrama #edit #espana #kdramascenes`
      }
    }
  }

  return (isTitleMode ? [title, '', ...bodyLines] : [title, 'PARTE 1', '', ...bodyLines])
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function App() {
  const [activeTab, setActiveTab] = useState('srt') // 'srt' | 'titles'
  const [files, setFiles] = useState([]) // Array of: { id, name, captionText, status, errorMsg, output: '' }
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [titles, setTitles] = useState([]) // Array of: { id, name, titleText, status, errorMsg, output: '', imagePrompt: '' }
  const [selectedTitleId, setSelectedTitleId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | done
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [copiedStoryId, setCopiedStoryId] = useState(null)
  const [copiedImagePromptId, setCopiedImagePromptId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

  useEffect(() => {
    window.__addFakeCompletedTitle = (name, text) => {
      const fakeId = `fake-${Date.now()}`
      setTitles(prev => [...prev, {
        id: fakeId,
        name,
        titleText: name,
        status: 'done',
        output: text,
        imagePrompt: '',
        errorMsg: ''
      }])
      setSelectedTitleId(fakeId)
    }
  }, [])

  const [geminiPsid, setGeminiPsid] = useState(localStorage.getItem('gemini_psid') || '')
  const [geminiPsidts, setGeminiPsidts] = useState(localStorage.getItem('gemini_psidts') || '')
  const [showSettings, setShowSettings] = useState(false)

  const [serverStatus, setServerStatus] = useState(null)
  const [checkingStatus, setCheckingStatus] = useState(false)

  async function checkBackendStatus() {
    setCheckingStatus(true)
    try {
      const res = await fetch('https://write-content.onrender.com/api/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cookies: {
            psid: geminiPsid,
            psidts: geminiPsidts
          }
        })
      })
      if (res.ok) {
        const data = await res.json()
        setServerStatus(data)
        return data.initialized
      } else {
        let detail = ''
        try {
          const errJson = await res.json()
          detail = errJson?.error || JSON.stringify(errJson)
        } catch {
          detail = await res.text()
        }
        throw new Error(detail || `Lỗi HTTP ${res.status}`)
      }
    } catch (err) {
      console.error(err)
      setServerStatus({
        initialized: false,
        mcpServerAvailable: false,
        error: err.message || 'Không kết nối được server'
      })
      return false
    } finally {
      setCheckingStatus(false)
    }
  }

  useEffect(() => {
    checkBackendStatus()
  }, [])

  async function applyCookiesToServer() {
    setErrorMsg('')
    const ok = await checkBackendStatus()
    if (ok) {
      showTemporarySuccess('Đã áp dụng và kết nối thành công với Cookie mới!')
    } else {
      setErrorMsg('Áp dụng Cookie thất bại. Vui lòng kiểm tra lại giá trị.')
    }
  }

  useEffect(() => {
    localStorage.setItem('gemini_psid', geminiPsid)
  }, [geminiPsid])

  useEffect(() => {
    localStorage.setItem('gemini_psidts', geminiPsidts)
  }, [geminiPsidts])

  const outputRef = useRef(null)
  const abortControllerRef = useRef(null)
  const stopRequestedRef = useRef(false)

  const selectedItem = activeTab === 'srt'
    ? files.find((f) => f.id === selectedFileId)
    : titles.find((t) => t.id === selectedTitleId)

  // Handlers for SRT and Title loading/editing are handled inside the respective components.

  function handleCopy(text, resultId) {
    if (!text || !text.trim()) return
    navigator.clipboard.writeText(text.trim())
    if (resultId) {
      setCopiedStoryId(resultId)
      setTimeout(() => {
        setCopiedStoryId(null)
      }, 2000)
    }
    showTemporarySuccess('Đã sao chép nội dung câu chuyện!')
  }

  function handleCopyImagePrompt(text, resultId) {
    if (!text || !text.trim()) return
    navigator.clipboard.writeText(text.trim())
    setCopiedImagePromptId(resultId)
    setTimeout(() => {
      setCopiedImagePromptId(null)
    }, 2000)
    showTemporarySuccess('Đã sao chép prompt image!')
  }

  function handleCopyAll() {
    const list = activeTab === 'srt' ? files : titles
    const allOutputs = list
      .filter((item) => item.output && item.output.trim())
      .map((item) => `=== ${item.name} ===\n\n${item.output.trim()}`)
      .join('\n\n\n')

    if (allOutputs) {
      navigator.clipboard.writeText(allOutputs)
      setCopiedAll(true)
      showTemporarySuccess('Đã sao chép tất cả các câu chuyện đã hoàn thành!')
      setTimeout(() => {
        setCopiedAll(false)
      }, 2000)
    }
  }

  const titleCaptionEnding = `❤️ GRACIAS POR LEER ESTA PARTE DE LA HISTORIA 🙏📖
⚠️ LA SIGUIENTE PARTE ESTÁ EN LA SECCIÓN DE COMENTARIOS 👇
💬 Si no la ves, haz clic en "VER TODOS LOS COMENTARIOS" y ahí la encontrarás. 👇`

  function getStoryTitle(outputText, fallbackTitle) {
    return outputText
      .replace(/\r/g, '')
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean) || fallbackTitle
  }

  function splitTitleStory(outputText) {
    const fullText = outputText.replace(/\r/g, '').trim()
    const parte2Ending = `ME ENCANTARÍA LEER SUS COMENTARIOS ANTES DE CONTINUAR CON LA PARTE FINAL. SI QUIEREN LEER LA ÚLTIMA PARTE DE ESTA HISTORIA, POR FAVOR DENLE “ME GUSTA” A LA PUBLICACIÓN O DEJEN UN COMENTARIO. ❤️ ¡GRACIAS POR SU APOYO!`

    if (!fullText) {
      return {
        caption: titleCaptionEnding,
        parte2: parte2Ending
      }
    }

    const words = [...fullText.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)]
    let captionCutIndex = -1

    if (words.length <= 700) {
      captionCutIndex = fullText.length
    } else {
      const minEnd = words[499].index + words[499][0].length
      const maxEnd = words[699].index + words[699][0].length
      const searchWindow = fullText.slice(minEnd, maxEnd)
      const sentenceEndPattern = /[.!?…](?:["”»])?(?=\s|$)/g
      let cutIndex = -1
      let match

      while ((match = sentenceEndPattern.exec(searchWindow)) !== null) {
        cutIndex = minEnd + match.index + match[0].length
      }

      if (cutIndex === -1) {
        const paragraphBreakIndex = searchWindow.lastIndexOf('\n\n')
        if (paragraphBreakIndex !== -1) {
          cutIndex = minEnd + paragraphBreakIndex
        }
      }

      if (cutIndex === -1) {
        cutIndex = maxEnd
      }
      captionCutIndex = cutIndex
    }

    const captionExcerpt = fullText.slice(0, captionCutIndex).trim()
    const caption = `${captionExcerpt}\n\n${titleCaptionEnding}`.trim()

    // PARTE 2 starts from captionCutIndex
    const remainingText = fullText.slice(captionCutIndex).trim()
    let parte2 = ''

    if (!remainingText) {
      parte2 = parte2Ending
    } else {
      const remainingWords = [...remainingText.matchAll(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)]
      let parte2CutIndex = -1

      if (remainingWords.length <= 300) {
        parte2CutIndex = remainingText.length
      } else {
        const minEnd = remainingWords[199].index + remainingWords[199][0].length
        const maxEnd = remainingWords[299].index + remainingWords[299][0].length
        const searchWindow = remainingText.slice(minEnd, maxEnd)
        const sentenceEndPattern = /[.!?…](?:["”»])?(?=\s|$)/g
        let cutIndex = -1
        let match

        while ((match = sentenceEndPattern.exec(searchWindow)) !== null) {
          cutIndex = minEnd + match.index + match[0].length
        }

        if (cutIndex === -1) {
          const paragraphBreakIndex = searchWindow.lastIndexOf('\n\n')
          if (paragraphBreakIndex !== -1) {
            cutIndex = minEnd + paragraphBreakIndex
          }
        }

        if (cutIndex === -1) {
          cutIndex = maxEnd
        }
        parte2CutIndex = cutIndex
      }

      const parte2Excerpt = remainingText.slice(0, parte2CutIndex).trim()
      parte2 = `${parte2Excerpt}\n\n${parte2Ending}`.trim()
    }

    return { caption, parte2 }
  }

  function buildTitleCaption(outputText) {
    return splitTitleStory(outputText).caption
  }

  function safeCellText(text, onTruncate) {
    if (!text) return ''
    const str = String(text)
    if (str.length > 32767) {
      if (onTruncate) onTruncate()
      const suffix = '... [TRUNCATED BY EXCEL LIMIT]'
      return str.slice(0, 32767 - suffix.length) + suffix
    }
    return str
  }

  function handleExportXlsx() {
    const list = activeTab === 'srt' ? files : titles
    const completedItems = list.filter((item) => item.output && item.output.trim())

    if (completedItems.length === 0) {
      setErrorMsg('Không có nội dung câu chuyện nào đã hoàn thành để xuất file.')
      return
    }

    let truncatedCount = 0
    const onTruncate = () => {
      truncatedCount++
    }

    const data = activeTab === 'titles'
      ? completedItems.map((item) => {
          const { caption, parte2 } = splitTitleStory(item.output)
          return {
            TITLE: safeCellText(getStoryTitle(item.output, item.name), onTruncate),
            CAPTION: safeCellText(caption, onTruncate),
            'PARTE 2': safeCellText(parte2, onTruncate),
            'FULL STORY': safeCellText(item.output.trim(), onTruncate),
            'PROMT IMAGE': safeCellText(item.imagePrompt?.trim() || '', onTruncate),
          }
        })
      : completedItems.map((item) => ({
          title: safeCellText(item.name, onTruncate),
          caption: safeCellText(item.output.trim(), onTruncate),
        }))

    try {
      const worksheet = XLSX.utils.json_to_sheet(data)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, activeTab === 'srt' ? 'SRT Captions' : 'Title Captions')

      const fileName = activeTab === 'srt' ? 'srt_captions.xlsx' : 'title_captions.xlsx'
      XLSX.writeFile(workbook, fileName)

      if (truncatedCount > 0) {
        showTemporarySuccess(`Đã xuất file ${fileName}. Lưu ý: có ${truncatedCount} ô dữ liệu quá dài (>32,767 ký tự) đã được tự động cắt bớt để tương thích với Excel.`)
      } else {
        showTemporarySuccess(`Đã xuất thành công file ${fileName}!`)
      }
    } catch (err) {
      console.error(err)
      setErrorMsg(`Lỗi khi xuất file Excel: ${err.message}`)
    }
  }

  function showTemporarySuccess(msg) {
    addToast(msg, 'success')
  }

  async function generateImagePromptForStory(storyText, signal) {
    const response = await fetch('https://write-content.onrender.com/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        prompt: buildImagePromptPrompt(storyText),
        itemType: 'imagePrompt',
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
    return normalizeImagePromptOutput(json.output || '')
  }

  async function generateRewriteForItem(itemType, itemId, text, signal) {
    const setItemStatus = (id, stat, valText = '', err = '', imagePromptText = '') => {
      const updater = (prev) =>
        prev.map((item) =>
          item.id === id
            ? itemType === 'titles'
              ? { ...item, status: stat, output: valText, errorMsg: err, imagePrompt: imagePromptText }
              : { ...item, status: stat, output: valText, errorMsg: err }
            : item
        )
      if (itemType === 'srt') {
        setFiles(updater)
      } else {
        setTitles(updater)
      }
    }

    setItemStatus(itemId, 'loading')

    try {
      const prompt = itemType === 'srt' ? buildPrompt(text) : buildTitlePrompt(text)
      const response = await fetch('https://write-content.onrender.com/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
        body: JSON.stringify({
          prompt,
          itemType,
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
      const textResult = normalizeGeneratedStoryOutput(json.output || '', itemType)
      let imagePromptResult = ''
      if (itemType === 'titles') {
        try {
          imagePromptResult = await generateImagePromptForStory(textResult, signal)
        } catch (imagePromptErr) {
          if (imagePromptErr.name === 'AbortError') throw imagePromptErr
          console.error(imagePromptErr)
        }
      }
      setItemStatus(itemId, 'done', textResult, '', imagePromptResult)
      return textResult
    } catch (err) {
      if (err.name === 'AbortError') throw err
      console.error(err)
      const errorStr = err.message || 'Đã có lỗi xảy ra khi gọi backend.'
      setItemStatus(itemId, 'error', '', errorStr)
      throw err
    }
  }

  async function handleGenerate(e) {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const listToProcess = activeTab === 'srt' ? files : titles
    if (listToProcess.length === 0) {
      setErrorMsg(activeTab === 'srt' ? 'Hãy upload ít nhất một tệp phụ đề .srt.' : 'Hãy nhập hoặc tải lên ít nhất một tiêu đề.')
      return
    }

    // Skip processing if all items are already completed
    const unprocessedItems = listToProcess.filter((item) => item.status !== 'done')
    if (unprocessedItems.length === 0) {
      showTemporarySuccess('Tất cả các mục trong hàng đợi đã được viết hoàn thành!')
      return
    }

    setStatus('loading')
    stopRequestedRef.current = false
    abortControllerRef.current = new AbortController()

    // Initialize only unprocessed items
    const initializedItems = listToProcess.map((item) => {
      if (item.status === 'done' && item.output && item.output.trim()) {
        return item
      }
      return {
        ...item,
        status: 'idle',
        errorMsg: '',
        output: '',
        ...(activeTab === 'titles' ? { imagePrompt: '' } : {}),
      }
    })

    if (activeTab === 'srt') {
      setFiles(initializedItems)
    } else {
      setTitles(initializedItems)
    }

    // Process unprocessed sequentially
    for (const item of initializedItems) {
      if (stopRequestedRef.current) break
      if (item.status === 'done') continue

      try {
        const textInput = activeTab === 'srt' ? item.captionText : item.titleText
        await generateRewriteForItem(activeTab, item.id, textInput, abortControllerRef.current.signal)
      } catch (err) {
        if (err.name === 'AbortError' || stopRequestedRef.current) break
        console.error(err)
      }
    }

    abortControllerRef.current = null
    if (stopRequestedRef.current) {
      setStatus('idle')
      showTemporarySuccess('Đã dừng response.')
      return
    }

    setStatus('done')
    showTemporarySuccess('Hoàn thành quá trình viết truyện tự động bằng Chrome Cookies!')
  }

  async function handleGenerateSingleItem(item) {
    if (!item) return
    setErrorMsg('')
    setSuccessMsg('')

    setStatus('loading')
    stopRequestedRef.current = false
    abortControllerRef.current = new AbortController()

    try {
      const textInput = activeTab === 'srt' ? item.captionText : item.titleText
      await generateRewriteForItem(activeTab, item.id, textInput, abortControllerRef.current.signal)
      showTemporarySuccess(`Đã viết câu chuyện thành công cho "${item.name}"!`)
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error(err)
      }
    } finally {
      setStatus('idle')
      abortControllerRef.current = null
    }
  }

  async function handleStopGenerate() {
    stopRequestedRef.current = true
    abortControllerRef.current?.abort()

    const updater = (prev) =>
      prev.map((f) =>
        f.status === 'loading'
          ? { ...f, status: 'idle', errorMsg: 'Đã dừng.' }
          : f
      )

    if (activeTab === 'srt') {
      setFiles(updater)
    } else {
      setTitles(updater)
    }

    setStatus('idle')

    try {
      await fetch('https://write-content.onrender.com/api/cancel', {
        method: 'POST',
      })
    } catch (err) {
      console.error(err)
    }

    showTemporarySuccess('Đã gửi lệnh dừng response.')
  }

  return (
    <div className="page">
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.type}`}>
            <span className="toast-icon">✓</span>
            <span className="toast-message">{toast.message}</span>
          </div>
        ))}
      </div>
      <header className="masthead">
        <div className="masthead-inner">
          <span className="eyebrow">SRT · Chrome Cookies Web Workflow</span>
          <h1>Content Writer</h1>
          <p className="sub">Tự động viết truyện tiếng Tây Ban Nha chạy ngầm thông qua Cookies Chrome của bạn.</p>
        </div>
      </header>

      <main className="desk">
        <section className="card index-card">
          <form onSubmit={handleGenerate} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            <div className="index-grid" style={{ flex: 1, minHeight: 0 }}>
              <div className="index-grid-left">

                {/* Tab Switcher & Result count configuration */}
                <div style={{ marginTop: '1.25rem', marginBottom: '1rem' }}>
                  <div className="tab-container">
                    <button
                      type="button"
                      className={`tab-btn ${activeTab === 'srt' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('srt')
                      }}
                    >
                      🎞️ Tệp SRT (Phụ đề)
                    </button>
                    <button
                      type="button"
                      className={`tab-btn ${activeTab === 'titles' ? 'active' : ''}`}
                      onClick={() => {
                        setActiveTab('titles')
                      }}
                    >
                      📝 Tiêu đề (Nhiều dòng)
                    </button>
                  </div>
                </div>

                {activeTab === 'srt' ? (
                  <SrtList
                    files={files}
                    setFiles={setFiles}
                    selectedFileId={selectedFileId}
                    setSelectedFileId={setSelectedFileId}
                    status={status}
                    setErrorMsg={setErrorMsg}
                    showTemporarySuccess={showTemporarySuccess}
                  />
                ) : (
                  <TitleList
                    titles={titles}
                    setTitles={setTitles}
                    selectedTitleId={selectedTitleId}
                    setSelectedTitleId={setSelectedTitleId}
                    status={status}
                    setErrorMsg={setErrorMsg}
                    showTemporarySuccess={showTemporarySuccess}
                  />
                )}
              </div>

              <div className="index-grid-right">
                <h2 className="card-title">1. Hướng dẫn thiết lập & Cấu hình</h2>

                <div style={{ marginBottom: '0.5rem', border: '1px solid #e0e0e0', borderRadius: '6px', padding: '0.5rem 0.75rem', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                    <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 'bold' }}>📡 Trạng thái kết nối Gemini</h3>
                    <button
                      type="button"
                      onClick={checkBackendStatus}
                      disabled={checkingStatus}
                      style={{ margin: 0, padding: '0.2rem 0.5rem', fontSize: '0.7rem', borderRadius: '4px', cursor: 'pointer' }}
                    >
                      {checkingStatus ? '🔄 Đang kiểm tra...' : '🔄 Kiểm tra lại'}
                    </button>
                  </div>
                  {serverStatus ? (
                    <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span>Trạng thái kết nối:</span>
                        <span style={{
                          fontWeight: 'bold',
                          color: serverStatus.initialized ? 'green' : 'red',
                          backgroundColor: serverStatus.initialized ? '#e6ffe6' : '#ffe6e6',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '0.8rem'
                        }}>
                          {serverStatus.initialized ? '● Đang kết nối (Cookie hoạt động tốt)' : '○ Chưa kết nối (Cookie hết hạn / Lỗi)'}
                        </span>
                      </div>
                      {serverStatus.cookies && (
                        <div style={{ color: '#666', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', marginTop: '0.2rem' }}>
                          <div>PSID đang dùng: <code>{serverStatus.cookies.psid}</code></div>
                          <div>PSIDTS đang dùng: <code>{serverStatus.cookies.psidts}</code></div>
                        </div>
                      )}
                      {serverStatus.error && (
                        <div style={{ color: 'red', fontSize: '0.8rem', marginTop: '0.2rem' }}>
                          Lỗi: {serverStatus.error}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.85rem', color: '#888' }}>
                      ⏳ Đang kiểm tra trạng thái máy chủ...
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '0.5rem', border: '1px dashed #ccc', borderRadius: '6px', padding: '0.5rem 0.75rem', background: '#fafafa' }}>
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
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                        <button
                          type="button"
                          className="generate-btn"
                          style={{ margin: 0, padding: '0.4rem 0.8rem', fontSize: '0.8rem', flex: 1 }}
                          onClick={applyCookiesToServer}
                          disabled={checkingStatus || !geminiPsid.trim() || !geminiPsidts.trim()}
                        >
                          {checkingStatus ? '💾 Đang kết nối...' : '💾 Áp dụng & Lưu lên Server'}
                        </button>

                        {(geminiPsid || geminiPsidts) && (
                          <button
                            type="button"
                            className="clear-all-btn"
                            style={{ width: 'fit-content', padding: '0.4rem 0.8rem', fontSize: '0.8rem', margin: 0 }}
                            onClick={() => {
                              setGeminiPsid('');
                              setGeminiPsidts('');
                            }}
                          >
                            Xóa cấu hình
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <h2 className="card-title">3. Biên tập & Trích xuất</h2>
                {activeTab === 'srt' ? (
                  <SrtEditor
                    selectedFile={files.find((f) => f.id === selectedFileId)}
                    setFiles={setFiles}
                    status={status}
                  />
                ) : (
                  <TitleEditor
                    selectedTitle={titles.find((t) => t.id === selectedTitleId)}
                    setTitles={setTitles}
                    status={status}
                  />
                )}

                {errorMsg && <p className="error-text" style={{ marginTop: '0.5rem' }}>{errorMsg}</p>}
                {successMsg && <p className="success-text" style={{ marginTop: '0.5rem', color: 'green', fontWeight: 'bold' }}>{successMsg}</p>}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button type="submit" className="generate-btn" style={{ margin: 0, flex: 1 }} disabled={status === 'loading' || (activeTab === 'srt' ? files : titles).length === 0}>
                    {status === 'loading'
                      ? '⏳ Đang viết truyện bằng Chrome Cookies (Chạy ngầm)...'
                      : activeTab === 'srt'
                        ? '🚀 Viết tự động bằng Chrome Cookies cho tất cả các file SRT'
                        : '🚀 Viết tự động bằng Chrome Cookies cho tất cả các Tiêu đề'
                    }
                  </button>
                  {status === 'loading' && (
                    <button
                      type="button"
                      className="clear-all-btn"
                      style={{ margin: 0, padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}
                      onClick={handleStopGenerate}
                    >
                      Dừng
                    </button>
                  )}
                </div>
              </div>
            </div>
          </form>
        </section>

        <section className="card paper" ref={outputRef}>
          {selectedItem ? (
            <>
              <div className="paper-head" style={{ marginBottom: '0.75rem' }}>
                <span className="paper-label" style={{ fontWeight: 'bold' }}>
                  Xem trước: {selectedItem.name}
                </span>
              </div>

              {selectedItem.status === 'error' && selectedItem.errorMsg && (
                <div className="error-text" style={{ padding: '1rem', backgroundColor: '#fff0f0', border: '1px solid #ffcccc', borderRadius: '6px', marginBottom: '1rem' }}>
                  <strong>Lỗi tự động hóa:</strong> {selectedItem.errorMsg}
                </div>
              )}

              {selectedItem.status === 'loading' && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                  <p className="placeholder" style={{ fontSize: '1.1rem' }}>
                    ⏳ Đang viết truyện tự động bằng Chrome Cookies...
                  </p>
                </div>
              )}

              {selectedItem.status === 'done' && selectedItem.output && (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span className="word-count" style={{ color: (activeTab === 'titles' && selectedItem.output.trim().length > 32767) ? '#dc3545' : 'inherit', fontWeight: (activeTab === 'titles' && selectedItem.output.trim().length > 32767) ? 'bold' : 'normal' }}>
                      {selectedItem.output.trim().length.toLocaleString('vi-VN')} ký tự | {selectedItem.output.split(/\s+/).filter(Boolean).length} từ
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      <button
                        type="button"
                        className="generate-btn"
                        style={{
                          padding: '0.35rem 0.7rem',
                          margin: 0,
                          borderRadius: '4px',
                          backgroundColor: 'var(--moss)',
                          color: '#fff',
                          fontSize: '0.8rem',
                          height: '32px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          border: 'none'
                        }}
                        onClick={() => handleGenerateSingleItem(selectedItem)}
                        disabled={status === 'loading'}
                      >
                        🔄 Viết lại
                      </button>
                      <button
                        type="button"
                        className={`copy-btn ${copiedStoryId === selectedItem.id ? 'copied' : ''}`}
                        style={{
                          padding: '0.35rem 0.7rem',
                          margin: 0,
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          height: '32px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                          cursor: 'pointer'
                        }}
                        onClick={() => handleCopy(selectedItem.output, selectedItem.id)}
                      >
                        {copiedStoryId === selectedItem.id ? '✓ Đã sao chép' : '📋 Sao chép'}
                      </button>
                    </div>
                  </div>

                  <div className="output-text" style={{ background: '#fcfcfc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee', flex: 1, overflowY: 'auto' }}>
                    {selectedItem.output.split(/\n+/).map((para, i) =>
                      para.trim() ? <p key={`${para.slice(0, 16)}-${i}`} style={{ marginBottom: '1rem' }}>{para}</p> : null
                    )}
                  </div>
                  {activeTab === 'titles' && (
                  <div style={{ marginTop: '1rem', borderTop: '1px solid #ddd', paddingTop: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <span className="paper-label" style={{ fontWeight: 'bold' }}>
                        Prompt image
                      </span>
                      <button
                        type="button"
                        className={`copy-btn ${copiedImagePromptId === selectedItem.id ? 'copied' : ''}`}
                        style={{
                          padding: '0.35rem 0.7rem',
                          margin: 0,
                          borderRadius: '4px',
                          fontSize: '0.8rem',
                          height: '32px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '0.25rem',
                          whiteSpace: 'nowrap',
                          cursor: selectedItem.imagePrompt ? 'pointer' : 'not-allowed'
                        }}
                        onClick={() => handleCopyImagePrompt(selectedItem.imagePrompt, selectedItem.id)}
                        disabled={!selectedItem.imagePrompt}
                      >
                        {copiedImagePromptId === selectedItem.id ? '✓ Đã sao chép' : '📋 Sao chép prompt'}
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={selectedItem.imagePrompt || ''}
                      placeholder="Prompt image sẽ được tạo tự động sau khi câu chuyện hoàn thành."
                      style={{
                        width: '100%',
                        minHeight: '120px',
                        resize: 'vertical',
                        background: '#fcfcfc',
                        border: '1px solid #eee',
                        borderRadius: '8px',
                        padding: '0.9rem',
                        fontSize: '0.9rem',
                        lineHeight: 1.55
                      }}
                    />
                  </div>
                  )}
                </div>
              )}

              {selectedItem.status === 'idle' && !selectedItem.output && (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
                  <p className="placeholder" style={{ fontSize: '1.1rem' }}>
                    ⏳ Chờ viết truyện tự động...
                  </p>
                </div>
              )}
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#888' }}>
              <p className="placeholder" style={{ fontSize: '1.1rem', marginBottom: '1.5rem' }}>
                {activeTab === 'srt'
                  ? 'Hãy tải lên và chọn một file phụ đề để bắt đầu.'
                  : 'Hãy nhập hoặc tải lên và chọn một tiêu đề để bắt đầu.'
                }
              </p>
            </div>
          )}

          {((activeTab === 'srt' ? files : titles).some((item) => item.output && item.output.trim())) && (
            <div style={{ marginTop: '2.5rem', borderTop: '2px solid #ddd', paddingTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.8rem', textAlign: 'center' }}>
              <button
                type="button"
                className={`copy-all-btn ${copiedAll ? 'copied' : ''}`}
                style={{ width: '100%', padding: '1rem' }}
                onClick={handleCopyAll}
                disabled={status === 'loading'}
              >
                {copiedAll
                  ? '✓ Đã sao chép tất cả'
                  : `Sao chép tất cả truyện đã viết của ${activeTab === 'srt' ? 'các file SRT' : 'các Tiêu đề'} (${
                      (activeTab === 'srt' ? files : titles).filter((item) => item.output && item.output.trim()).length
                    } bài)`
                }
              </button>

              <button
                type="button"
                className="generate-btn"
                style={{ width: '100%', padding: '1rem', backgroundColor: '#217346', borderColor: '#1e663e', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                onClick={handleExportXlsx}
                disabled={status === 'loading'}
              >
                📊 Xuất tệp Excel (.xlsx) ({
                  (activeTab === 'srt' ? files : titles).filter((item) => item.output && item.output.trim()).length
                } bài)
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
