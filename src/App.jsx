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
7. Độ dài của câu chuyện (không tính tiêu đề và dòng kêu gọi hành động) phải nằm trong khoảng từ 500 đến 600 từ.
8. Tuyệt đối chỉ trả về nội dung câu chuyện, không thêm bất kỳ lời mở đầu, giải thích hay ghi chú nào ngoài lề. Không viết mã code hay dùng khối code.

ABSOLUTE OUTPUT RULES:
- Return only the final Spanish story.
- Do not output analysis, reasoning, comments, markdown, Python, JavaScript, variables, verification scripts, word counts, or formatting notes.
- The first non-empty line must be the ALL CAPS Spanish title. The second line must be exactly PARTE 1. The third line must be blank.`
}

function cleanGeneratedStoryOutput(outputText) {
  const unwrapCodeStringLine = (line) => {
    return line.trim()
      .replace(/^\s*(story_template|story_content|story|content)\s*=\s*(?:[rubf]+)?("""|'''|`{3})/i, '')
      .replace(/("""|'''|`{3})\s*$/, '')
      .trim()
  }

  const isDebugOrCodeLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return (
      /^```/.test(trimmed) ||
      /^SCRIPT\s+TO\s+VERIFY\s+LENGTH\s+AND\s+FORMAT$/i.test(trimmed) ||
      /^SCRIPT\b.*\bVERIFY\b.*\bFORMAT\b/i.test(trimmed) ||
      /code_reference|code_event_index/i.test(trimmed) ||
      /^python\?/i.test(trimmed) ||
      /^#/.test(trimmed) ||
      /^(The user wants|Length|Formatting|Line\s*\d+|Dialogue starts|NO emojis)\s*:/i.test(trimmed) ||
      /^(story_template|story_content|story|content)\s*=\s*(?:[rubf]+)?("""|'''|`{3})\s*$/i.test(trimmed) ||
      /^(words|title_lines|story_content)\s*=/.test(trimmed) ||
      /^for\s+\w+\s+in\s+\w+\s*:\s*$/.test(trimmed) ||
      /^print\s*\(/.test(trimmed) ||
      /^Word count\b/i.test(trimmed) ||
      /^Title word count\b/i.test(trimmed) ||
      /^Line:\s*['"`]/i.test(trimmed) ||
      /^("""|'''|`{3})$/.test(trimmed)
    )
  }

  // 1. Initial cleanup of return characters and raw lines
  let rawLines = outputText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => unwrapCodeStringLine(line))
    .filter((line) => {
      if (!line) return true; // keep blank lines for now
      if (isDebugOrCodeLine(line)) return false;
      return true;
    });

  const firstContentIndex = rawLines.findIndex(Boolean)
  if (
    firstContentIndex !== -1 &&
    /^(PARTE|PART)\s*1$/i.test(rawLines[firstContentIndex]) &&
    rawLines.slice(firstContentIndex + 1).some(Boolean)
  ) {
    rawLines.splice(firstContentIndex, 1)
  }

  // Find the first non-empty line (Title)
  let titleIndex = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i]) {
      titleIndex = i;
      break;
    }
  }

  if (titleIndex !== -1) {
    // Clean Title (Line 1): remove markdown headers (#), bold (**), title/título prefixes, and emojis
    let title = rawLines[titleIndex]
      .replace(/^[\s#*_\-]+/, '') // remove leading markdown characters like #, *, _, -
      .replace(/[\s*_\-]+$/, '') // remove trailing markdown characters
      .replace(/^(Título|Title|TÍTULO|TITLE)\s*:\s*/i, '') // remove "Title:" prefixes
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '') // remove emojis
      .toUpperCase()
      .trim();

    // Find the next non-empty line (should be PARTE 1)
    let parteIndex = -1;
    for (let i = titleIndex + 1; i < rawLines.length; i++) {
      if (rawLines[i]) {
        parteIndex = i;
        break;
      }
    }

    let restStoryLines = [];
    if (parteIndex !== -1) {
      const nextLineClean = rawLines[parteIndex]
        .replace(/^[\s#*_\-]+/, '')
        .replace(/[\s*_\-]+$/, '')
        .trim();

      const isParteLine = /^(PARTE|PART|SECCIÓN|SECTION|CAPÍTULO|CHAPTER)/i.test(nextLineClean) ||
                          /^\d+$/i.test(nextLineClean); // If it's just "1" or "PARTE 1" etc.

      if (isParteLine) {
        restStoryLines = rawLines.slice(parteIndex + 1);
      } else {
        restStoryLines = rawLines.slice(parteIndex);
      }
    } else {
      restStoryLines = rawLines.slice(titleIndex + 1);
    }

    // Clean up remaining story lines: filter out multiple consecutive empty lines
    let cleanedStory = [];
    for (let i = 0; i < restStoryLines.length; i++) {
      const line = restStoryLines[i];
      if (line === '') {
        if (cleanedStory.length > 0 && cleanedStory[cleanedStory.length - 1] !== '') {
          cleanedStory.push('');
        }
      } else {
        cleanedStory.push(line);
      }
    }

    // Reconstruct the output with strict formatting:
    // Line 1: Title
    // Line 2: PARTE 1
    // Line 3: (blank line)
    // Line 4: Story starts...
    const finalLines = [
      title,
      'PARTE 1',
      '',
      ...cleanedStory
    ];
    return finalLines.join('\n').trim();
  }

  // Fallback to original logic if we couldn't find a title
  return outputText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (isDebugOrCodeLine(trimmed)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeGeneratedStoryOutput(outputText) {
  const removeEmoji = (text) =>
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
7. Độ dài của câu chuyện (không tính tiêu đề và dòng kêu gọi hành động) phải nằm trong khoảng từ 500 đến 600 từ.
8. Tuyệt đối chỉ trả về nội dung câu chuyện, không thêm bất kỳ lời mở đầu, giải thích hay ghi chú nào ngoài lề. Không viết mã code hay dùng khối code.

ABSOLUTE OUTPUT RULES:
- Return only the final Spanish story.
- Do not output analysis, reasoning, comments, markdown, Python, JavaScript, variables, verification scripts, word counts, or formatting notes.
- The first non-empty line must be the ALL CAPS Spanish title. The second line must be exactly PARTE 1. The third line must be blank.`
}

function cleanGeneratedStoryOutput(outputText) {
  const unwrapCodeStringLine = (line) => {
    return line.trim()
      .replace(/^\s*(story_template|story_content|story|content)\s*=\s*(?:[rubf]+)?("""|'''|`{3})/i, '')
      .replace(/("""|'''|`{3})\s*$/, '')
      .trim()
  }

  const isDebugOrCodeLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return (
      /^```/.test(trimmed) ||
      /^SCRIPT\s+TO\s+VERIFY\s+LENGTH\s+AND\s+FORMAT$/i.test(trimmed) ||
      /^SCRIPT\b.*\bVERIFY\b.*\bFORMAT\b/i.test(trimmed) ||
      /code_reference|code_event_index/i.test(trimmed) ||
      /^python\?/i.test(trimmed) ||
      /^#/.test(trimmed) ||
      /^(The user wants|Length|Formatting|Line\s*\d+|Dialogue starts|NO emojis)\s*:/i.test(trimmed) ||
      /^(story_template|story_content|story|content)\s*=\s*(?:[rubf]+)?("""|'''|`{3})\s*$/i.test(trimmed) ||
      /^(words|title_lines|story_content)\s*=/.test(trimmed) ||
      /^for\s+\w+\s+in\s+\w+\s*:\s*$/.test(trimmed) ||
      /^print\s*\(/.test(trimmed) ||
      /^Word count\b/i.test(trimmed) ||
      /^Title word count\b/i.test(trimmed) ||
      /^Line:\s*['"`]/i.test(trimmed) ||
      /^("""|'''|`{3})$/.test(trimmed)
    )
  }

  // 1. Initial cleanup of return characters and raw lines
  let rawLines = outputText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .map(line => unwrapCodeStringLine(line))
    .filter((line) => {
      if (!line) return true; // keep blank lines for now
      if (isDebugOrCodeLine(line)) return false;
      return true;
    });

  const firstContentIndex = rawLines.findIndex(Boolean)
  if (
    firstContentIndex !== -1 &&
    /^(PARTE|PART)\s*1$/i.test(rawLines[firstContentIndex]) &&
    rawLines.slice(firstContentIndex + 1).some(Boolean)
  ) {
    rawLines.splice(firstContentIndex, 1)
  }

  // Find the first non-empty line (Title)
  let titleIndex = -1;
  for (let i = 0; i < rawLines.length; i++) {
    if (rawLines[i]) {
      titleIndex = i;
      break;
    }
  }

  if (titleIndex !== -1) {
    // Clean Title (Line 1): remove markdown headers (#), bold (**), title/título prefixes, and emojis
    let title = rawLines[titleIndex]
      .replace(/^[\s#*_\-]+/, '') // remove leading markdown characters like #, *, _, -
      .replace(/[\s*_\-]+$/, '') // remove trailing markdown characters
      .replace(/^(Título|Title|TÍTULO|TITLE)\s*:\s*/i, '') // remove "Title:" prefixes
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E6}-\u{1F1FF}]/gu, '') // remove emojis
      .toUpperCase()
      .trim();

    // Find the next non-empty line (should be PARTE 1)
    let parteIndex = -1;
    for (let i = titleIndex + 1; i < rawLines.length; i++) {
      if (rawLines[i]) {
        parteIndex = i;
        break;
      }
    }

    let restStoryLines = [];
    if (parteIndex !== -1) {
      const nextLineClean = rawLines[parteIndex]
        .replace(/^[\s#*_\-]+/, '')
        .replace(/[\s*_\-]+$/, '')
        .trim();

      const isParteLine = /^(PARTE|PART|SECCIÓN|SECTION|CAPÍTULO|CHAPTER)/i.test(nextLineClean) ||
                          /^\d+$/i.test(nextLineClean); // If it's just "1" or "PARTE 1" etc.

      if (isParteLine) {
        restStoryLines = rawLines.slice(parteIndex + 1);
      } else {
        restStoryLines = rawLines.slice(parteIndex);
      }
    } else {
      restStoryLines = rawLines.slice(titleIndex + 1);
    }

    // Clean up remaining story lines: filter out multiple consecutive empty lines
    let cleanedStory = [];
    for (let i = 0; i < restStoryLines.length; i++) {
      const line = restStoryLines[i];
      if (line === '') {
        if (cleanedStory.length > 0 && cleanedStory[cleanedStory.length - 1] !== '') {
          cleanedStory.push('');
        }
      } else {
        cleanedStory.push(line);
      }
    }

    // Reconstruct the output with strict formatting:
    // Line 1: Title
    // Line 2: PARTE 1
    // Line 3: (blank line)
    // Line 4: Story starts...
    const finalLines = [
      title,
      'PARTE 1',
      '',
      ...cleanedStory
    ];
    return finalLines.join('\n').trim();
  }

  // Fallback to original logic if we couldn't find a title
  return outputText
    .replace(/^\uFEFF/, '')
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim()
      if (!trimmed) return true
      if (isDebugOrCodeLine(trimmed)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeGeneratedStoryOutput(outputText) {
  const removeEmoji = (text) =>
    text.replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, '')

  const unwrapCodeStringLine = (line) =>
    line
      .trim()
      .replace(/^\s*(?:const|let|var)?\s*(title|titulo|título|story_title|story_template|story_content|story|content|output)\s*=\s*(?:[rubf]+)?("""|'''|`{3}|["'`])/i, '')
      .replace(/("""|'''|`{3}|["'`])\s*[;,]?\s*$/, '')
      .trim()

  const cleanLine = (line) =>
    unwrapCodeStringLine(line)
      .replace(/^[#>*\s]+/, '')
      .replace(/^\d+\.\s+/, '')
      .replace(/^(title|titulo|título|story title)\s*=\s*/i, '')
      .replace(/^(title|titulo|título|story title)\s*:\s*/i, '')
      .replace(/^["'`]+/, '')
      .replace(/["'`,]+$/, '')
      .trim()

  const isParteLine = (line) => /^(PARTE|PART|SECCION|SECCIÓN|SECTION|CAPITULO|CAPÍTULO|CHAPTER)\s*[-:]?\s*1\b/i.test(line.trim())

  const isJunkLine = (line) => {
    const trimmed = line.trim()
    if (!trimmed) return false
    return (
      /^```/.test(trimmed) ||
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

  const title = removeEmoji(lines.slice(fallbackTitleIndex, titleEndIndex + 1).join(' '))
    .replace(/^[\s#*_\-]+/, '')
    .replace(/[\s*_\-]+$/, '')
    .toUpperCase()
    .trim()

  const bodyLines = []
  let previousWasBlank = false
  for (let i = titleEndIndex + 1; i < lines.length; i++) {
    let line = lines[i].trim()
    if (isJunkLine(line)) continue
    if (isParteLine(line)) continue
    if (removeEmoji(line).trim().toUpperCase() === title) continue

    const isCta = /^Comenta\b/i.test(line)
    if (!isCta) line = removeEmoji(line).trim()
    if (!line) {
      if (bodyLines.length && !previousWasBlank) {
        bodyLines.push('')
        previousWasBlank = true
      }
      continue
    }

    bodyLines.push(line)
    previousWasBlank = false
  }

  return [title, 'PARTE 1', '', ...bodyLines]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function App() {
  const [files, setFiles] = useState([]) // Array of: { id, name, captionText, status: 'idle' | 'loading' | 'done' | 'error', output: '', errorMsg: '' }
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [status, setStatus] = useState('idle') // idle | loading | done
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const [copiedPromptId, setCopiedPromptId] = useState(null)
  const [copiedStoryId, setCopiedStoryId] = useState(null)
  const [copiedAll, setCopiedAll] = useState(false)
  const [toasts, setToasts] = useState([])

  const addToast = (message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 4000)
  }

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
      if (err.name === 'AbortError') {
        setFiles((prev) =>
          prev.map((f) => (f.id === fileId ? { ...f, status: 'idle', errorMsg: 'Da dung.' } : f))
        )
        throw err
      }

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

  function handleCopy(text, fileId) {
    if (!text.trim()) return
    navigator.clipboard.writeText(text.trim())
    if (fileId) {
      setCopiedStoryId(fileId)
      setTimeout(() => {
        setCopiedStoryId(null)
      }, 2000)
    }
    showTemporarySuccess('Đã sao chép nội dung câu chuyện!')
  }

  function handleCopyAll() {
    const allOutputs = files
      .filter((f) => f.output.trim())
      .map((f) => `=== ${f.name} ===\n\n${f.output.trim()}`)
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

  function showTemporarySuccess(msg) {
    addToast(msg, 'success')
  }

  function handleCopyPrompt(file) {
    if (!file) return
    const prompt = buildPrompt(file.captionText)
    navigator.clipboard.writeText(prompt)
    setCopiedPromptId(file.id)
    showTemporarySuccess(`Đã copy Prompt của "${file.name}"!`)
    setTimeout(() => {
      setCopiedPromptId(null)
    }, 2000)
  }


  async function generateCaptionRewriteForFile(fileId, captionText, signal) {
    try {
      const response = await fetch('https://write-content.onrender.com/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        signal,
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
      const text = normalizeGeneratedStoryOutput(json.output || '')

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
    stopRequestedRef.current = false
    abortControllerRef.current = new AbortController()

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
      if (stopRequestedRef.current) break

      setFiles((prev) =>
        prev.map((f) => (f.id === fileToProcess.id ? { ...f, status: 'loading' } : f))
      )

      try {
        await generateCaptionRewriteForFile(fileToProcess.id, fileToProcess.captionText, abortControllerRef.current.signal)
      } catch (err) {
        if (err.name === 'AbortError' || stopRequestedRef.current) break
        console.error(err)
      }
    }

    abortControllerRef.current = null
    if (stopRequestedRef.current) {
      setStatus('idle')
      showTemporarySuccess('Da dung response.')
      return
    }

    setStatus('done')
    showTemporarySuccess('Hoàn thành quá trình viết truyện tự động bằng Chrome Cookies!')
  }

  async function handleStopGenerate() {
    stopRequestedRef.current = true
    abortControllerRef.current?.abort()

    setFiles((prev) =>
      prev.map((f) => (f.status === 'loading' ? { ...f, status: 'idle', errorMsg: 'Da dung.' } : f))
    )
    setStatus('idle')

    try {
      await fetch('https://write-content.onrender.com/api/cancel', {
        method: 'POST',
      })
    } catch (err) {
      console.error(err)
    }

    showTemporarySuccess('Da gui lenh dung response.')
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
                <h2 className="card-title">1. Hướng dẫn thiết lập</h2>

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

                <h2 className="card-title">2. Danh sách File SRT</h2>
                <label className="field">
                  <span className="field-label">Upload file phụ đề .srt (Chọn nhiều file)</span>
                  <input type="file" accept=".srt" multiple onChange={handleSrtUpload} disabled={status === 'loading'} />
                </label>

                {files.length > 0 && (
                  <div className="file-list-container" style={{ margin: 0, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                    <div className="file-list-header">
                      <span className="field-label">Hàng đợi ({files.length})</span>
                      <button type="button" className="clear-all-btn" onClick={handleClearAll} disabled={status === 'loading'}>
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
                                className={`copy-btn ${copiedPromptId === f.id ? 'copied' : ''}`}
                                style={{
                                  padding: '4px 10px',
                                  fontSize: '0.75rem',
                                  whiteSpace: 'nowrap',
                                  margin: 0,
                                  borderRadius: '4px',
                                  backgroundColor: copiedPromptId === f.id ? 'var(--moss)' : 'var(--moss-light)',
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
                                {copiedPromptId === f.id ? '✓ Đã copy' : '📋 Copy Prompt'}
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
              </div>

              <div className="index-grid-right">
                <h2 className="card-title">3. Biên tập & Trích xuất</h2>
                {selectedFile ? (
                  <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                    <label className="field" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, margin: 0, overflow: 'hidden' }}>
                      <span className="field-label">Lời thoại đã trích xuất ({selectedFile.name})</span>
                      <textarea
                        style={{ flex: 1, minHeight: '60px', resize: 'none' }}
                        placeholder="Lời thoại trích từ file phụ đề sẽ hiện ở đây."
                        value={selectedFile.captionText}
                        onChange={(e) => handleCaptionChange(e.target.value)}
                        disabled={status === 'loading'}
                      />
                    </label>
                    <p className="helper-text" style={{ marginTop: '0.3rem', marginBottom: '0.5rem' }}>
                      Số ký tự lời thoại: {selectedFile.captionText.trim().length.toLocaleString('vi-VN')}
                    </p>
                  </div>
                ) : (
                  <div className="no-file-selected" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 0 1.5rem 0' }}>
                    Hãy upload file SRT hoặc chọn một file từ danh sách để xem lời thoại.
                  </div>
                )}

                {errorMsg && <p className="error-text" style={{ marginTop: '0.5rem' }}>{errorMsg}</p>}
                {successMsg && <p className="success-text" style={{ marginTop: '0.5rem', color: 'green', fontWeight: 'bold' }}>{successMsg}</p>}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <button type="submit" className="generate-btn" style={{ margin: 0, flex: 1 }} disabled={status === 'loading' || files.length === 0}>
                    {status === 'loading' ? '⏳ Đang viết truyện bằng Chrome Cookies (Chạy ngầm)...' : '🚀 Viết tự động bằng Chrome Cookies cho tất cả các file'}
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
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden', marginTop: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                    <button
                      type="button"
                      className={`copy-btn ${copiedStoryId === selectedFile.id ? 'copied' : ''}`}
                      style={{ padding: '0.6rem 1.2rem', margin: 0, borderRadius: '6px' }}
                      onClick={() => handleCopy(selectedFile.output, selectedFile.id)}
                    >
                      {copiedStoryId === selectedFile.id ? '✓ Đã sao chép' : '📋 Sao chép câu chuyện'}
                    </button>
                  </div>
                  <div className="output-text" style={{ background: '#fcfcfc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #eee', flex: 1, overflowY: 'auto' }}>
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
              <button
                type="button"
                className={`copy-all-btn ${copiedAll ? 'copied' : ''}`}
                style={{ width: '100%', padding: '1rem' }}
                onClick={handleCopyAll}
                disabled={status === 'loading'}
              >
                {copiedAll ? '✓ Đã sao chép tất cả' : `Sao chép tất cả truyện đã viết (${files.filter((f) => f.output.trim()).length} bài)`}
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
