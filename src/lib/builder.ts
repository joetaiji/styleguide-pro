import type { AnalysisResult, SectionOptions, StyleOptions, ProjectInfo, UploadedFile } from '@/types'
import { replaceImagePaths } from './imageStore'

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

let codeBlockId = 0
function buildCodeBlock(codeHtml: string, includeCode: boolean): string {
  if (!includeCode || !codeHtml) return ''
  const id = `code-block-${++codeBlockId}`
  return `<div class="sg-code-wrapper">
    <div class="sg-code-header">
      <button class="sg-code-toggle" id="${id}-toggle" style="display: none;" onclick="document.getElementById('${id}').style.display = 'block'; document.getElementById('${id}-btns').style.display = 'flex'; this.style.display = 'none';">코드열기</button>
      <div class="sg-code-btns" id="${id}-btns">
        <button class="sg-code-btn" onclick="navigator.clipboard.writeText(document.getElementById('${id}').querySelector('pre').textContent).then(() => { this.textContent = '복사됨!'; setTimeout(() => { this.textContent = '코드복사'; }, 1500); })">코드복사</button>
        <button class="sg-code-btn" onclick="document.getElementById('${id}').style.display = 'none'; document.getElementById('${id}-btns').style.display = 'none'; document.getElementById('${id}-toggle').style.display = 'inline-block';">코드닫기</button>
      </div>
    </div>
    <div class="sg-code" id="${id}">
      <pre>${escapeHtml(codeHtml)}</pre>
    </div>
  </div>`
}

interface SectionBuilder {
  check: () => boolean
  id: string
  title: string
  build: (id: number, includeCode: boolean) => string
}

export function buildStyleGuide(
  files: UploadedFile[],
  analysisResult: AnalysisResult,
  sectionOptions: SectionOptions,
  styleOptions: StyleOptions,
  projectInfo: ProjectInfo
): string {
  const { name: projectName, version: projectVersion } = projectInfo
  const { toc: includeTOC, codeblock: includeCodeBlock, fontFamily } = styleOptions

  // 폰트 및 아이콘 CDN 링크 생성
  const fontCDN = fontFamily === 'pretendard'
    ? `<!-- Pretendard GOV 폰트 -->
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/nicegov/font@1.0.3/pretendard.css">`
    : `<!-- Noto Sans KR 폰트 -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@100..900&display=swap" rel="stylesheet">`

  const iconCDN = `<!-- Remixicon 아이콘 폰트 -->
    <link href="https://cdn.jsdelivr.net/npm/remixicon@4.2.0/fonts/remixicon.css" rel="stylesheet">`

  const fontFamilyCSS = fontFamily === 'pretendard'
    ? `font-family: 'Pretendard GOV', 'Pretendard', -apple-system, BlinkMacSystemFont, sans-serif;`
    : `font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;`

  // 업로드된 모든 CSS 파일 내용을 인라인으로 포함 (이미지 경로 Base64 변환 포함)
  const cssFiles = files.filter((f) => f.type === 'css')
  const cssContents = cssFiles
    .map((f) => `/* ========== ${f.name} ========== */\n${replaceImagePaths(f.content)}`)
    .join('\n\n')
  
  // 항상 프로젝트 CSS를 head에 포함
  const projectStyles = `
    <style id="project-styles">
      /* ============================================ */
      /* 프로젝트 CSS 파일들 (${cssFiles.length}개) */
      /* ============================================ */
      ${cssContents}
    </style>`

  const sections: string[] = []
  const tocItems: { id: string; title: string }[] = []
  let sectionId = 0

  const builders: SectionBuilder[] = [
    // 1. 컬러
    {
      check: () => sectionOptions.colors && (analysisResult.colors.size > 0 || analysisResult.cssVariables.length > 0),
      id: 'colors',
      title: '컬러 팔레트',
      build: (id) => buildColorSection(id, analysisResult),
    },
    // 2. 타이포그래피
    {
      check: () => sectionOptions.typography && analysisResult.components.typography.length > 0,
      id: 'typography',
      title: '타이포그래피',
      build: (id, code) => buildTypographySection(id, code, analysisResult),
    },
    // 3. 아이콘
    {
      check: () => sectionOptions.icons && analysisResult.icons.size > 0,
      id: 'icons',
      title: '아이콘',
      build: (id) => buildIconSection(id, analysisResult),
    },
    // 4. 배지
    {
      check: () =>
        sectionOptions.badge &&
        (analysisResult.components.badges.length > 0 || analysisResult.extractedMarkup.badges.length > 0),
      id: 'badges',
      title: '배지',
      build: (id, code) => buildBadgeSection(id, code, analysisResult),
    },
    // 5. 리스트
    {
      check: () => sectionOptions.lists && analysisResult.components.lists.length > 0,
      id: 'lists',
      title: '리스트',
      build: (id, code) => buildListSection(id, code, analysisResult),
    },
    // 6. 탭
    {
      check: () => analysisResult.components.tabs.length > 0,
      id: 'tabs',
      title: '탭',
      build: (id, code) => buildTabSection(id, code, analysisResult),
    },
    // 7. 테이블
    {
      check: () => sectionOptions.tables && analysisResult.tables.length > 0,
      id: 'tables',
      title: '테이블',
      build: (id, code) => buildTableSection(id, code, analysisResult),
    },
    // 8. 버튼
    {
      check: () => sectionOptions.buttons && analysisResult.components.buttons.length > 0,
      id: 'buttons',
      title: '버튼',
      build: (id, code) => buildButtonSection(id, code, analysisResult),
    },
    // 9. 폼
    {
      check: () => sectionOptions.forms && analysisResult.components.forms.length > 0,
      id: 'forms',
      title: '폼 요소',
      build: (id, code) => buildFormSection(id, code, analysisResult),
    },
    // 10. 파비콘과 OG
    {
      check: () => sectionOptions.favicon,
      id: 'favicon',
      title: '파비콘과 OG',
      build: (id) => buildFaviconSection(id),
    },
    // 기타 섹션들
    {
      check: () => sectionOptions.boxes && analysisResult.components.boxes.length > 0,
      id: 'boxes',
      title: '박스/카드',
      build: (id, code) => buildBoxSection(id, code, analysisResult),
    },
    {
      check: () => sectionOptions.modal && analysisResult.modals.length > 0,
      id: 'modal',
      title: '모달',
      build: (id, code) => buildModalSection(id, code, analysisResult),
    },
    {
      check: () => sectionOptions.pagination && analysisResult.components.pagination.length > 0,
      id: 'pagination',
      title: '페이지네이션',
      build: (id, code) => buildPaginationSection(id, code, analysisResult),
    },
    {
      check: () =>
        sectionOptions.accordion &&
        (analysisResult.components.accordions.length > 0 ||
          analysisResult.extractedMarkup.accordions.length > 0),
      id: 'accordions',
      title: '아코디언',
      build: (id, code) => buildAccordionSection(id, code, analysisResult),
    },
  ]

  builders.forEach((builder) => {
    if (builder.check()) {
      sectionId++
      tocItems.push({ id: builder.id, title: builder.title })
      sections.push(builder.build(sectionId, includeCodeBlock))
    }
  })

  sectionId++
  tocItems.push({ id: 'classes', title: 'CSS 클래스 목록' })
  sections.push(buildClassListSection(sectionId, analysisResult))

  const toc = includeTOC
    ? `
    <nav class="sg-toc">
        <h3><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin-right:6px;"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>목차</h3>
        <ul>${tocItems.map((item, i) => `<li><a href="#${item.id}" onclick="event.preventDefault(); document.getElementById('${item.id}').scrollIntoView({behavior:'smooth'}); return false;">${i + 1}. ${item.title}</a></li>`).join('')}</ul>
    </nav>`
    : ''

  return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <base target="_self">
    <title>${projectName}</title>
    
${fontCDN}
${iconCDN}

${projectStyles}
    <style id="styleguide-styles">
        :root { --krds-primary: #246BEB; --krds-primary-dark: #1A4FAD; }
        .sg-section { margin-bottom: 60px; padding: 2.4rem; background: #fff; border: 1px solid #E5E8EB; border-radius: 12px; }
        .sg-title { font-size: 24px; font-weight: 700; color: #111827; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 3px solid var(--krds-primary); }
        .sg-subtitle { font-size: 18px; font-weight: 600; color: #374151; margin: 25px 0 15px; }
        .sg-desc { font-size: 14px; color: #6B7280; margin-bottom: 15px; }
        .sg-preview { margin-bottom: 15px; }
        .sg-code-wrapper { margin-top: 15px; }
        .sg-code-header { display: flex; justify-content: flex-end; gap: 8px; margin-bottom: 8px; }
        .sg-code-btns { display: flex; gap: 8px; }
        .sg-code-toggle { background: #3C3C3C; color: #D4D4D4; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; cursor: pointer; transition: background 0.2s; }
        .sg-code-toggle:hover { background: #505050; }
        .sg-code { background: #1E1E1E; border-radius: 8px; padding: 20px; overflow: auto; max-height: 360px; }
        .sg-code-btn { background: #3C3C3C; color: #D4D4D4; border: none; padding: 6px 12px; border-radius: 4px; font-size: 12px; cursor: pointer; transition: background 0.2s; }
        .sg-code-btn:hover { background: #505050; }
        .sg-code pre { color: #D4D4D4; font-family: 'JetBrains Mono', monospace; font-size: 13px; margin: 0; white-space: pre-wrap; }
        .sg-toc { position: fixed; left: 40px; top: 40px; width: 200px; background: #fff; border: 1px solid #E5E8EB; border-radius: 12px; padding: 20px; z-index: 100; max-height: calc(100vh - 80px); overflow-y: auto; }
        .sg-toc h3 { font-size: 16px; margin-bottom: 15px; color: #111827; }
        .sg-toc ul { list-style: none; padding: 0; margin: 0; }
        .sg-toc li { margin-bottom: 8px; }
        .sg-toc a { font-size: 15px; color: #6B7280; text-decoration: none; }
        .sg-toc a:hover { color: var(--krds-primary); }
        .sg-main { ${includeTOC ? 'margin-left: 240px;' : ''} padding: 40px; }
        .sg-header { text-align: center; padding: 48px; background: linear-gradient(135deg, var(--krds-primary) 0%, var(--krds-primary-dark) 100%); color: #fff; margin-bottom: 40px; border-radius: 12px; }
        .sg-class-list { display: flex; flex-wrap: wrap; gap: 8px; }
        .sg-class-item { background: #F5F7FA; padding: 6px 12px; border-radius: 6px; font-family: monospace; font-size: 12px; border: 1px solid #E5E8EB; }
        .sg-color-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 16px; }
        .sg-color-item { text-align: center; }
        .sg-color-swatch { height: 64px; border-radius: 8px; margin-bottom: 8px; border: 1px solid #E5E8EB; }
        .sg-color-value { font-family: monospace; font-size: 11px; color: #6B7280; }
        .sg-icon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 16px; text-align: center; }
        .sg-icon-item { padding: 16px; background: #FAFAFA; border-radius: 8px; border: 1px solid #E5E8EB; }
        .sg-icon-item i { font-size: 24px; display: block; margin-bottom: 8px; }
        .sg-icon-name { font-size: 11px; color: #6B7280; word-break: break-all; }
        .sg-extracted-item { margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid #E5E8EB; }
        .sg-section-class { font-size: 13px; font-weight: bold; color: #6B7280; margin: 0 0 20px 0; line-height: 1.6; }
        .sg-extracted-item:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
        .sg-button-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .sg-badge-grid { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .sg-table-preview { overflow-x: auto; }
        .sg-modal-preview { border: 1px solid #E5E8EB; border-radius: 8px; overflow: hidden; max-height: 400px; overflow-y: auto; }
        @media (max-width: 1024px) { .sg-toc { position: static; width: 100%; margin-bottom: 30px; max-height: none; } .sg-main { margin-left: 0; } }
        html { scroll-behavior: smooth; }
        body { background: #F5F7FA; margin: 0; padding: 0; ${fontFamilyCSS} }
    </style>
</head>
<body>
${toc}
<main class="sg-main">
    <header class="sg-header">
        <h1 style="font-size: 32px; margin-bottom: 12px; color: #fff;">${projectName}</h1>
        <p style="opacity: 0.9;">자동 생성된 UI 스타일 가이드</p>
        <p style="font-size: 12px; margin-top: 12px; opacity: 0.7;">Version ${projectVersion} | Generated: ${new Date().toLocaleDateString('ko-KR')}</p>
    </header>

${sections.join('\n\n')}

    <footer style="text-align: center; padding: 30px; color: #6B7280; border-top: 1px solid #E5E8EB; margin-top: 40px;">
        <p>Generated by Style Guide Generator</p>
    </footer>
</main>
</body>
</html>`
}

// 섹션 빌더들
function buildButtonSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const buttonClasses = [...new Set(result.components.buttons)].slice(0, 20)
  const extracted = result.extractedMarkup.buttons.slice(0, 10)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((btn) => btn.html).join('\n')
      : buttonClasses.slice(0, 5).map((cls) => `<button class="${cls}">버튼</button>`).join('\n')
  const codeHtml =
    extracted.length > 0
      ? extracted.map((btn) => btn.html).join('\n\n')
      : buttonClasses.map((cls) => `<button class="${cls}">버튼</button>`).join('\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buttonClasses.length > 0 ? `<p class="sg-section-class">${buttonClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="buttons"><h2 class="sg-title">${id}. 버튼</h2>${classListHtml}<div class="sg-preview sg-button-grid">${previewHtml}</div>${codeBlock}</section>`
}

function buildFormSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const formClasses = [...new Set(result.components.forms)].slice(0, 20)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.forms.filter((f) => {
    if (seenClasses.has(f.classes)) return false
    seenClasses.add(f.classes)
    return true
  }).slice(0, 5)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((f) => `<div class="sg-extracted-item">${f.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((f) => f.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = formClasses.length > 0 ? `<p class="sg-section-class">${formClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="forms"><h2 class="sg-title">${id}. 폼 요소</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildTypographySection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const typoClasses = [...new Set(result.components.typography)].slice(0, 15)
  
  // 클래스별로 적절한 태그 생성
  const headingExamples = typoClasses.map((cls) => {
    // title-1, title-2, title-3은 h1, h2, h3 태그 사용
    if (cls === 'title-1' || cls.includes('title-1')) {
      return `<h1 class="${cls}">제목 (.${cls})</h1>`
    } else if (cls === 'title-2' || cls.includes('title-2')) {
      return `<h2 class="${cls}">제목 (.${cls})</h2>`
    } else if (cls === 'title-3' || cls.includes('title-3')) {
      return `<h3 class="${cls}">제목 (.${cls})</h3>`
    } else {
      // 나머지 title은 div > strong 태그
      return `<div class="${cls}"><strong>제목 (.${cls})</strong></div>`
    }
  }).join('')
  
  const codeBlock = buildCodeBlock(headingExamples, includeCode)
  const classListHtml = typoClasses.length > 0 ? `<p class="sg-section-class">${typoClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="typography"><h2 class="sg-title">${id}. 타이포그래피</h2>${classListHtml}<div class="sg-preview">${headingExamples}</div>${codeBlock}</section>`
}

function buildBoxSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const boxClasses = [...new Set(result.components.boxes)].slice(0, 15)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.boxes.filter((b) => {
    if (seenClasses.has(b.classes)) return false
    seenClasses.add(b.classes)
    return true
  }).slice(0, 3)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((b) => `<div class="sg-extracted-item">${b.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((b) => b.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = boxClasses.length > 0 ? `<p class="sg-section-class">${boxClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="boxes"><h2 class="sg-title">${id}. 박스/카드</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildListSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const listClasses = [...new Set(result.components.lists)].slice(0, 15)
  // 같은 클래스를 가진 항목은 하나만 출력 (중복 제거)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.lists.filter((l) => {
    if (seenClasses.has(l.classes)) return false
    seenClasses.add(l.classes)
    return true
  }).slice(0, 4)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((l) => `<div class="sg-extracted-item">${l.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((l) => l.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = listClasses.length > 0 ? `<p class="sg-section-class">${listClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="lists"><h2 class="sg-title">${id}. 리스트</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}


function buildTableSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const tableClasses = [...new Set(result.tables)].filter((c) => c).slice(0, 10)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.tables.filter((t) => {
    if (seenClasses.has(t.classes)) return false
    seenClasses.add(t.classes)
    return true
  }).slice(0, 3)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((t) => `<div class="sg-extracted-item">${t.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((t) => t.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = tableClasses.length > 0 ? `<p class="sg-section-class">${tableClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="tables"><h2 class="sg-title">${id}. 테이블</h2>${classListHtml}<div class="sg-preview sg-table-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildModalSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const modalClasses = [...new Set(result.modals)].filter((c) => c).slice(0, 10)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.modals.filter((m) => {
    if (seenClasses.has(m.classes)) return false
    seenClasses.add(m.classes)
    return true
  }).slice(0, 2)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((m) => `<div class="sg-extracted-item"><div class="sg-modal-preview">${m.html}</div></div>`).join('')
      : ''
  const codeHtml = extracted.map((m) => m.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = modalClasses.length > 0 ? `<p class="sg-section-class">${modalClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="modal"><h2 class="sg-title">${id}. 모달</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildIconSection(id: number, result: AnalysisResult): string {
  const icons = [...result.icons].slice(0, 30)
  return `<section class="sg-section" id="icons"><h2 class="sg-title">${id}. 아이콘</h2><div class="sg-icon-grid">${icons.map((icon) => `<div class="sg-icon-item"><i class="svg-icon ${icon}"></i><span class="sg-icon-name">${icon}</span></div>`).join('')}</div></section>`
}

function buildColorSection(id: number, result: AnalysisResult): string {
  // CSS 변수 중 색상 관련만 필터링
  const colorVariables = result.cssVariables.filter((v) => v.category === 'color')
  
  // etc로 묶을 그룹들
  const etcGroups = ['danger', 'warning', 'success', 'information', 'border', 'facebook', 'twitter', 'blog', 'kakaotalk', 'instagram', 'youtube']
  // 제외할 그룹들
  const excludeGroups = ['black', 'white']
  
  // 색상 변수를 그룹별로 분류
  const groupedColors: { [key: string]: typeof colorVariables } = {}
  colorVariables.forEach((v) => {
    // 변수명에서 그룹 추출 (예: primary-5 -> primary, gray-10 -> gray)
    const match = v.name.match(/^([a-zA-Z-]+?)(?:-?\d+)?$/)
    let group = match ? match[1].replace(/-$/, '') : 'other'
    
    // 제외할 그룹은 건너뛰기
    if (excludeGroups.includes(group)) return
    
    // etc 그룹으로 묶기
    if (etcGroups.includes(group)) {
      group = 'etc'
    }
    
    if (!groupedColors[group]) groupedColors[group] = []
    groupedColors[group].push(v)
  })

  // 그룹 순서 정의 (secondary를 primary 다음으로)
  const groupOrder = ['primary', 'secondary', 'point', 'gray', 'bg', 'etc']
  const sortedGroups = Object.keys(groupedColors).sort((a, b) => {
    const aIdx = groupOrder.indexOf(a)
    const bIdx = groupOrder.indexOf(b)
    if (aIdx === -1 && bIdx === -1) return a.localeCompare(b)
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })

  // 그룹 표시 이름
  const groupNames: { [key: string]: string } = {
    'primary': 'Primary',
    'secondary': 'Secondary',
    'point': 'Point',
    'gray': 'Gray',
    'bg': 'Background',
    'etc': 'Etc',
  }

  // 그룹별 색상 팔레트 HTML 생성
  const groupsHtml = sortedGroups.map((group) => {
    const vars = groupedColors[group]
    // 숫자 기준 정렬 (primary-5, primary-10, ...)
    vars.sort((a, b) => {
      const numA = parseInt(a.name.match(/\d+$/)?.[0] || '0')
      const numB = parseInt(b.name.match(/\d+$/)?.[0] || '0')
      return numA - numB
    })

    const colorsHtml = vars.map((v) => {
      // 값이 다른 변수를 참조하는 경우 실제 값 찾기
      let displayValue = v.value
      let bgValue = v.value
      if (v.value.startsWith('var(')) {
        // var(--primary-50) 형태에서 실제 값 추출
        const refMatch = v.value.match(/var\(--([^,)]+)/)
        if (refMatch) {
          const refVar = result.cssVariables.find((rv) => rv.name === refMatch[1])
          if (refVar) bgValue = refVar.value
        }
      }
      return `<div class="sg-color-item">
        <div class="sg-color-swatch" style="background: ${bgValue};"></div>
        <span class="sg-color-value">var(--${v.name}, ${displayValue})</span>
      </div>`
    }).join('')

    const displayName = groupNames[group] || group.charAt(0).toUpperCase() + group.slice(1)
    return `<div class="sg-color-group">
      <h4 class="sg-color-group-title">${displayName}</h4>
      <div class="sg-color-grid">${colorsHtml}</div>
    </div>`
  }).join('')

  // 기존 색상도 별도로 표시 (변수로 정의되지 않은 색상들)
  const rawColors = [...result.colors].slice(0, 20)
  const rawColorsHtml = rawColors.length > 0 && colorVariables.length === 0
    ? `<div class="sg-color-group">
        <h4 class="sg-color-group-title">색상 코드</h4>
        <div class="sg-color-grid">${rawColors.map((c) => `<div class="sg-color-item"><div class="sg-color-swatch" style="background:${c};"></div><span class="sg-color-value">${c}</span></div>`).join('')}</div>
      </div>`
    : ''

  return `<section class="sg-section" id="colors">
    <h2 class="sg-title">${id}. 컬러 팔레트</h2>
    <p class="sg-desc">CSS 변수로 정의된 ${colorVariables.length}개 색상</p>
    ${groupsHtml}
    ${rawColorsHtml}
    <style>
      .sg-color-group { margin-bottom: 25px; }
      .sg-color-group-title { font-size: 16px; font-weight: 600; color: #374151; margin-bottom: 12px; padding-left: 10px; border-left: 3px solid var(--krds-primary); }
      .sg-color-value { font-size: 11px; word-break: break-all; line-height: 1.4; }
    </style>
  </section>`
}

function buildTabSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const tabClasses = [...new Set(result.components.tabs)].slice(0, 15)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.tabs.filter((t) => {
    if (seenClasses.has(t.classes)) return false
    seenClasses.add(t.classes)
    return true
  }).slice(0, 3)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((t) => `<div class="sg-extracted-item">${t.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((t) => t.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = tabClasses.length > 0 ? `<p class="sg-section-class">${tabClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="tabs"><h2 class="sg-title">${id}. 탭</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildPaginationSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const pageClasses = [...new Set(result.components.pagination)].slice(0, 15)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.paginations.filter((p) => {
    if (seenClasses.has(p.classes)) return false
    seenClasses.add(p.classes)
    return true
  }).slice(0, 2)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((p) => `<div class="sg-extracted-item">${p.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((p) => p.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = pageClasses.length > 0 ? `<p class="sg-section-class">${pageClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="pagination"><h2 class="sg-title">${id}. 페이지네이션</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildBadgeSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const badgeClasses = [...new Set(result.components.badges)].slice(0, 20)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.badges.filter((b) => {
    if (seenClasses.has(b.classes)) return false
    seenClasses.add(b.classes)
    return true
  }).slice(0, 15)
  const previewHtml =
    extracted.length > 0
      ? `<div class="sg-badge-grid">${extracted.map((b) => b.html).join('')}</div>`
      : ''
  const codeHtml = extracted.map((b) => b.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = badgeClasses.length > 0 ? `<p class="sg-section-class">${badgeClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="badges"><h2 class="sg-title">${id}. 배지</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildAccordionSection(id: number, includeCode: boolean, result: AnalysisResult): string {
  const accordionClasses = [...new Set(result.components.accordions)].slice(0, 20)
  const seenClasses = new Set<string>()
  const extracted = result.extractedMarkup.accordions.filter((a) => {
    if (seenClasses.has(a.classes)) return false
    seenClasses.add(a.classes)
    return true
  }).slice(0, 3)
  const previewHtml =
    extracted.length > 0
      ? extracted.map((a) => `<div class="sg-extracted-item">${a.html}</div>`).join('')
      : ''
  const codeHtml = extracted.map((a) => a.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = accordionClasses.length > 0 ? `<p class="sg-section-class">${accordionClasses.map(c => `.${c}`).join(', ')}</p>` : ''
  return `<section class="sg-section" id="accordions"><h2 class="sg-title">${id}. 아코디언</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildFaviconSection(id: number): string {
  return `<section class="sg-section" id="favicon">
    <h2 class="sg-title">${id}. 파비콘과 OG</h2>
    <p class="sg-desc">웹사이트의 파비콘과 Open Graph 메타태그 가이드</p>
    
    <h3 class="sg-subtitle">파비콘 (Favicon)</h3>
    <div class="sg-preview">
      <p class="sg-desc">브라우저 탭, 북마크, 홈 화면에 표시되는 아이콘입니다.</p>
      <table class="sg-meta-table">
        <thead>
          <tr><th>파일명</th><th>크기</th><th>용도</th></tr>
        </thead>
        <tbody>
          <tr><td>favicon.ico</td><td>16x16, 32x32</td><td>브라우저 탭 기본 아이콘</td></tr>
          <tr><td>favicon-16x16.png</td><td>16x16</td><td>브라우저 탭</td></tr>
          <tr><td>favicon-32x32.png</td><td>32x32</td><td>브라우저 탭 (고해상도)</td></tr>
          <tr><td>apple-touch-icon.png</td><td>180x180</td><td>iOS 홈 화면</td></tr>
          <tr><td>android-chrome-192x192.png</td><td>192x192</td><td>Android 홈 화면</td></tr>
          <tr><td>android-chrome-512x512.png</td><td>512x512</td><td>Android 스플래시</td></tr>
        </tbody>
      </table>
    </div>
    
    <h3 class="sg-subtitle">HTML 코드</h3>
    <div class="sg-code"><pre>&lt;link rel="icon" type="image/x-icon" href="/favicon.ico"&gt;
&lt;link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png"&gt;
&lt;link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png"&gt;
&lt;link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png"&gt;</pre></div>

    <h3 class="sg-subtitle">Open Graph (OG) 메타태그</h3>
    <div class="sg-preview">
      <p class="sg-desc">SNS 공유 시 표시되는 미리보기 정보입니다.</p>
      <table class="sg-meta-table">
        <thead>
          <tr><th>속성</th><th>설명</th><th>권장 사항</th></tr>
        </thead>
        <tbody>
          <tr><td>og:title</td><td>페이지 제목</td><td>60자 이내</td></tr>
          <tr><td>og:description</td><td>페이지 설명</td><td>150자 이내</td></tr>
          <tr><td>og:image</td><td>미리보기 이미지</td><td>1200x630px 권장</td></tr>
          <tr><td>og:url</td><td>페이지 URL</td><td>정규화된 URL</td></tr>
          <tr><td>og:type</td><td>콘텐츠 유형</td><td>website, article 등</td></tr>
          <tr><td>og:site_name</td><td>사이트명</td><td>브랜드명</td></tr>
        </tbody>
      </table>
    </div>
    
    <h3 class="sg-subtitle">OG 메타태그 코드</h3>
    <div class="sg-code"><pre>&lt;meta property="og:type" content="website"&gt;
&lt;meta property="og:title" content="페이지 제목"&gt;
&lt;meta property="og:description" content="페이지 설명"&gt;
&lt;meta property="og:image" content="https://example.com/og-image.jpg"&gt;
&lt;meta property="og:url" content="https://example.com"&gt;
&lt;meta property="og:site_name" content="사이트명"&gt;

&lt;!-- Twitter Card --&gt;
&lt;meta name="twitter:card" content="summary_large_image"&gt;
&lt;meta name="twitter:title" content="페이지 제목"&gt;
&lt;meta name="twitter:description" content="페이지 설명"&gt;
&lt;meta name="twitter:image" content="https://example.com/og-image.jpg"&gt;</pre></div>

    <style>
      .sg-meta-table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 14px; }
      .sg-meta-table th, .sg-meta-table td { padding: 12px 15px; text-align: left; border: 1px solid #E5E8EB; }
      .sg-meta-table th { background: #F9FAFB; font-weight: 600; color: #374151; }
      .sg-meta-table tr:hover td { background: #F9FAFB; }
    </style>
  </section>`
}

function buildClassListSection(id: number, result: AnalysisResult): string {
  const allClasses = [...result.classes].sort().slice(0, 100)
  return `<section class="sg-section" id="classes"><h2 class="sg-title">${id}. CSS 클래스 목록</h2><p class="sg-desc">총 ${result.classes.size}개 클래스 중 상위 100개</p><div class="sg-preview"><div class="sg-class-list">${allClasses.map((cls) => `<span class="sg-class-item">.${cls}</span>`).join('')}</div></div></section>`
}
