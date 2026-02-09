import type { AnalysisResult, SectionOptions, StyleOptions, ProjectInfo, UploadedFile, AdditionalClasses } from '@/types'
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
  build: (id: number, includeCode: boolean, extraClasses?: string) => string
}

export function buildStyleGuide(
  files: UploadedFile[],
  analysisResult: AnalysisResult,
  sectionOptions: SectionOptions,
  styleOptions: StyleOptions,
  projectInfo: ProjectInfo,
  additionalClasses?: AdditionalClasses
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

  // 추가 클래스 파싱 함수 - 키워드를 포함하는 클래스 검색
  const parseAdditionalClasses = (input: string): string[] => {
    if (!input) return []
    const keywords = input.split(',').map(c => c.trim().replace(/^\./, '').toLowerCase()).filter(c => c.length > 0)
    const allClasses = Array.from(analysisResult.classes)
    const matchedClasses: string[] = []
    
    keywords.forEach(keyword => {
      // 키워드를 포함하는 모든 클래스 찾기
      const matches = allClasses.filter(cls => cls.toLowerCase().includes(keyword))
      matches.forEach(match => {
        if (!matchedClasses.includes(match)) {
          matchedClasses.push(match)
        }
      })
    })
    
    return matchedClasses
  }

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
      check: () => sectionOptions.typography && (analysisResult.components.typography.length > 0 || (additionalClasses?.typography || '').length > 0),
      id: 'typography',
      title: '타이포그래피',
      build: (id, code, extra) => buildTypographySection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
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
        (analysisResult.components.badges.length > 0 || analysisResult.extractedMarkup.badges.length > 0 || (additionalClasses?.badge || '').length > 0),
      id: 'badges',
      title: '배지',
      build: (id, code, extra) => buildBadgeSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 5. 리스트
    {
      check: () => sectionOptions.lists && (analysisResult.components.lists.length > 0 || (additionalClasses?.lists || '').length > 0),
      id: 'lists',
      title: '리스트',
      build: (id, code, extra) => buildListSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 6. 탭
    {
      check: () => sectionOptions.tabs && (analysisResult.components.tabs.length > 0 || (additionalClasses?.tabs || '').length > 0),
      id: 'tabs',
      title: '탭',
      build: (id, code, extra) => buildTabSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 7. 테이블
    {
      check: () => sectionOptions.tables && (analysisResult.tables.length > 0 || (additionalClasses?.tables || '').length > 0),
      id: 'tables',
      title: '테이블',
      build: (id, code, extra) => buildTableSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 8. 버튼
    {
      check: () => sectionOptions.buttons && (analysisResult.components.buttons.length > 0 || (additionalClasses?.buttons || '').length > 0),
      id: 'buttons',
      title: '버튼',
      build: (id, code, extra) => buildButtonSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 9. 폼 요소
    {
      check: () => sectionOptions.forms && (analysisResult.components.forms.length > 0 || (additionalClasses?.forms || '').length > 0),
      id: 'forms',
      title: '폼 요소',
      build: (id, code, extra) => buildFormSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 10. 박스/카드
    {
      check: () => sectionOptions.boxes && (analysisResult.components.boxes.length > 0 || (additionalClasses?.boxes || '').length > 0),
      id: 'boxes',
      title: '박스/카드',
      build: (id, code, extra) => buildBoxSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 11. 모달
    {
      check: () => sectionOptions.modal && (analysisResult.modals.length > 0 || (additionalClasses?.modal || '').length > 0),
      id: 'modal',
      title: '모달',
      build: (id, code, extra) => buildModalSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 12. 페이지네이션
    {
      check: () => sectionOptions.pagination && (analysisResult.components.pagination.length > 0 || (additionalClasses?.pagination || '').length > 0),
      id: 'pagination',
      title: '페이지네이션',
      build: (id, code, extra) => buildPaginationSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 13. 아코디언
    {
      check: () =>
        sectionOptions.accordion &&
        (analysisResult.components.accordions.length > 0 ||
          analysisResult.extractedMarkup.accordions.length > 0 || (additionalClasses?.accordion || '').length > 0),
      id: 'accordions',
      title: '아코디언',
      build: (id, code, extra) => buildAccordionSection(id, code, analysisResult, parseAdditionalClasses(extra || '')),
    },
    // 14. 파비콘과 OG (맨 마지막, HTML에 파비콘 또는 OG 메타태그가 있을 때만 표시)
    {
      check: () => sectionOptions.favicon && (analysisResult.hasFavicon || analysisResult.hasOG),
      id: 'favicon',
      title: '파비콘과 OG',
      build: (id) => buildFaviconSection(id, analysisResult),
    },
  ]

  // 섹션별 추가 클래스 매핑
  const sectionExtraClasses: { [key: string]: string } = {
    typography: additionalClasses?.typography || '',
    badges: additionalClasses?.badge || '',
    lists: additionalClasses?.lists || '',
    tables: additionalClasses?.tables || '',
    buttons: additionalClasses?.buttons || '',
    forms: additionalClasses?.forms || '',
    boxes: additionalClasses?.boxes || '',
    modal: additionalClasses?.modal || '',
    pagination: additionalClasses?.pagination || '',
    accordions: additionalClasses?.accordion || '',
  }

  builders.forEach((builder) => {
    if (builder.check()) {
      sectionId++
      tocItems.push({ id: builder.id, title: builder.title })
      sections.push(builder.build(sectionId, includeCodeBlock, sectionExtraClasses[builder.id]))
    }
  })

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

// 클래스 목록을 개수순으로 정렬하여 표시하는 helper 함수
function buildSortedClassList(classes: string[], extractedItems: { classes: string; count?: number }[]): string {
  if (classes.length === 0) return ''
  
  // 클래스별 개수 맵 생성
  const countMap = new Map<string, number>()
  extractedItems.forEach(item => {
    if (item.count) {
      countMap.set(item.classes, item.count)
    }
  })
  
  // 클래스를 개수 순으로 정렬
  const sortedClasses = [...classes].sort((a, b) => {
    const countA = countMap.get(a) || extractedItems.find(e => e.classes === a || e.classes.includes(a))?.count || 0
    const countB = countMap.get(b) || extractedItems.find(e => e.classes === b || e.classes.includes(b))?.count || 0
    return countB - countA
  })
  
  // 클래스명에 개수 표시
  const classListWithCount = sortedClasses.map(c => {
    const count = countMap.get(c) || extractedItems.find(e => e.classes === c || e.classes.includes(c))?.count || 0
    const displayName = c.startsWith('#') ? c : `.${c}`
    return count > 0 ? `${displayName}(${count})` : displayName
  }).join(', ')
  
  return `<p class="sg-section-class">${classListWithCount}</p>`
}

// 섹션 빌더들
function buildButtonSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const buttonClasses = [...new Set([...result.components.buttons, ...extraClasses])].slice(0, 20)
  const extracted = result.extractedMarkup.buttons.slice(0, 10)
  
  // 추가 클래스에 대한 프리뷰 버튼 생성
  const extraButtons = extraClasses.map(cls => `<button class="${cls}">버튼 (.${cls})</button>`).join('\n')
  
  const previewHtml =
    extracted.length > 0
      ? extracted.map((btn) => btn.html).join('\n') + (extraButtons ? '\n' + extraButtons : '')
      : buttonClasses.slice(0, 5).map((cls) => `<button class="${cls}">버튼</button>`).join('\n')
  const codeHtml =
    extracted.length > 0
      ? extracted.map((btn) => btn.html).join('\n\n') + (extraButtons ? '\n\n<!-- 추가 클래스 -->\n' + extraButtons : '')
      : buttonClasses.map((cls) => `<button class="${cls}">버튼</button>`).join('\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(buttonClasses, result.extractedMarkup.buttons)
  return `<section class="sg-section" id="buttons"><h2 class="sg-title">${id}. 버튼</h2>${classListHtml}<div class="sg-preview sg-button-grid">${previewHtml}</div>${codeBlock}</section>`
}

function buildFormSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const formClasses = [...new Set([...result.components.forms, ...extraClasses])].slice(0, 20)
  const allForms = result.extractedMarkup.forms
  const seenClasses = new Set<string>()
  const extracted = allForms.filter((f) => {
    if (seenClasses.has(f.classes)) return false
    seenClasses.add(f.classes)
    return true
  }).slice(0, 5)
  const extraFormsHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><div class="${cls}">폼 요소 (.${cls})</div></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((f) => `<div class="sg-extracted-item">${f.html}</div>`).join('') + extraFormsHtml
      : extraFormsHtml
  const codeHtml = extracted.map((f) => f.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(formClasses, allForms)
  return `<section class="sg-section" id="forms"><h2 class="sg-title">${id}. 폼 요소</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildTypographySection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const typoClasses = [...new Set([...result.components.typography, ...extraClasses])].slice(0, 15)
  
  // 추출된 타이포그래피 정보에서 태그 정보 가져오기
  const getTagForClass = (cls: string): string => {
    const info = result.typographyInfo.find(t => t.className === cls)
    if (info) {
      return info.tagName
    }
    // 폴백: 클래스명으로 추측
    if (cls === 'title-1' || cls.includes('title-1')) return 'h1'
    if (cls === 'title-2' || cls.includes('title-2')) return 'h2'
    if (cls === 'title-3' || cls.includes('title-3')) return 'h3'
    if (cls.includes('title') || cls.includes('heading')) return 'div'
    return 'span'
  }
  
  // 클래스/ID별로 실제 사용된 태그로 생성
  const headingExamples = typoClasses.map((cls) => {
    const tag = getTagForClass(cls)
    const isId = cls.startsWith('#')
    const attrName = isId ? 'id' : 'class'
    const attrValue = isId ? cls.substring(1) : cls  // # 제거
    const displayName = isId ? cls : `.${cls}`
    
    if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
      return `<${tag} ${attrName}="${attrValue}">제목 (${displayName})</${tag}>`
    } else if (tag === 'span' || tag === 'em' || tag === 'strong') {
      return `<p><${tag} ${attrName}="${attrValue}">텍스트 (${displayName})</${tag}></p>`
    } else {
      return `<${tag} ${attrName}="${attrValue}">제목 (${displayName})</${tag}>`
    }
  }).join('')
  
  const codeBlock = buildCodeBlock(headingExamples, includeCode)
  
  // 클래스명과 개수 함께 표시
  const classListWithCount = typoClasses.map(c => {
    const info = result.typographyInfo.find(t => t.className === c)
    const count = info?.count || 0
    const displayName = c.startsWith('#') ? c : `.${c}`
    return count > 0 ? `${displayName}(${count})` : displayName
  }).join(', ')
  
  const classListHtml = typoClasses.length > 0 ? `<p class="sg-section-class">${classListWithCount}</p>` : ''
  return `<section class="sg-section" id="typography"><h2 class="sg-title">${id}. 타이포그래피</h2>${classListHtml}<div class="sg-preview">${headingExamples}</div>${codeBlock}</section>`
}

function buildBoxSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const boxClasses = [...new Set([...result.components.boxes, ...extraClasses])].slice(0, 15)
  const allBoxes = result.extractedMarkup.boxes
  const seenClasses = new Set<string>()
  const extracted = allBoxes.filter((b) => {
    if (seenClasses.has(b.classes)) return false
    seenClasses.add(b.classes)
    return true
  }).slice(0, 3)
  const extraBoxesHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><div class="${cls}">박스/카드 (.${cls})</div></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((b) => `<div class="sg-extracted-item">${b.html}</div>`).join('') + extraBoxesHtml
      : extraBoxesHtml
  const codeHtml = extracted.map((b) => b.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(boxClasses, allBoxes)
  return `<section class="sg-section" id="boxes"><h2 class="sg-title">${id}. 박스/카드</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildListSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const listClasses = [...new Set([...result.components.lists, ...extraClasses])].slice(0, 15)
  const allLists = result.extractedMarkup.lists
  // 같은 클래스를 가진 항목은 하나만 출력 (중복 제거)
  const seenClasses = new Set<string>()
  const extracted = allLists.filter((l) => {
    if (seenClasses.has(l.classes)) return false
    seenClasses.add(l.classes)
    return true
  }).slice(0, 4)
  const extraListsHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><ul class="${cls}"><li>리스트 항목 (.${cls})</li></ul></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((l) => `<div class="sg-extracted-item">${l.html}</div>`).join('') + extraListsHtml
      : extraListsHtml
  const codeHtml = extracted.map((l) => l.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(listClasses, allLists)
  return `<section class="sg-section" id="lists"><h2 class="sg-title">${id}. 리스트</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}


function buildTableSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const tableClasses = [...new Set([...result.tables.filter((c) => c), ...extraClasses])].slice(0, 10)
  const allTables = result.extractedMarkup.tables
  const seenClasses = new Set<string>()
  const extracted = allTables.filter((t) => {
    if (seenClasses.has(t.classes)) return false
    seenClasses.add(t.classes)
    return true
  }).slice(0, 3)
  const extraTablesHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><table class="${cls}"><thead><tr><th>테이블 (.${cls})</th></tr></thead><tbody><tr><td>내용</td></tr></tbody></table></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((t) => `<div class="sg-extracted-item">${t.html}</div>`).join('') + extraTablesHtml
      : extraTablesHtml
  const codeHtml = extracted.map((t) => t.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(tableClasses, allTables)
  return `<section class="sg-section" id="tables"><h2 class="sg-title">${id}. 테이블</h2>${classListHtml}<div class="sg-preview sg-table-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildModalSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const modalClasses = [...new Set([...result.modals.filter((c) => c), ...extraClasses])].slice(0, 10)
  const allModals = result.extractedMarkup.modals
  const seenClasses = new Set<string>()
  const extracted = allModals.filter((m) => {
    if (seenClasses.has(m.classes)) return false
    seenClasses.add(m.classes)
    return true
  }).slice(0, 2)
  const extraModalsHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><div class="sg-modal-preview"><div class="${cls}">모달 (.${cls})</div></div></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((m) => `<div class="sg-extracted-item"><div class="sg-modal-preview">${m.html}</div></div>`).join('') + extraModalsHtml
      : extraModalsHtml
  const codeHtml = extracted.map((m) => m.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(modalClasses, allModals)
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

function buildTabSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const tabClasses = [...new Set([...result.components.tabs, ...extraClasses])].slice(0, 15)
  const allTabs = result.extractedMarkup.tabs
  const seenClasses = new Set<string>()
  const extracted = allTabs.filter((t) => {
    if (seenClasses.has(t.classes)) return false
    seenClasses.add(t.classes)
    return true
  }).slice(0, 3)
  const extraTabsHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><div class="${cls}" role="tablist">탭 (.${cls})</div></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((t) => `<div class="sg-extracted-item">${t.html}</div>`).join('') + extraTabsHtml
      : extraTabsHtml
  const codeHtml = extracted.map((t) => t.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(tabClasses, allTabs)
  return `<section class="sg-section" id="tabs"><h2 class="sg-title">${id}. 탭</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildPaginationSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const pageClasses = [...new Set([...result.components.pagination, ...extraClasses])].slice(0, 15)
  const allPaginations = result.extractedMarkup.paginations
  const seenClasses = new Set<string>()
  const extracted = allPaginations.filter((p) => {
    if (seenClasses.has(p.classes)) return false
    seenClasses.add(p.classes)
    return true
  }).slice(0, 2)
  const extraPaginationsHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><nav class="${cls}">페이지네이션 (.${cls})</nav></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((p) => `<div class="sg-extracted-item">${p.html}</div>`).join('') + extraPaginationsHtml
      : extraPaginationsHtml
  const codeHtml = extracted.map((p) => p.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(pageClasses, allPaginations)
  return `<section class="sg-section" id="pagination"><h2 class="sg-title">${id}. 페이지네이션</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildBadgeSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const badgeClasses = [...new Set([...result.components.badges, ...extraClasses])].slice(0, 20)
  const allBadges = result.extractedMarkup.badges
  const seenClasses = new Set<string>()
  const extracted = allBadges.filter((b) => {
    if (seenClasses.has(b.classes)) return false
    seenClasses.add(b.classes)
    return true
  }).slice(0, 15)
  const extraBadgesHtml = extraClasses.map(cls => `<span class="${cls}">배지 (.${cls})</span>`).join('')
  const previewHtml =
    extracted.length > 0 || extraClasses.length > 0
      ? `<div class="sg-badge-grid">${extracted.map((b) => b.html).join('')}${extraBadgesHtml}</div>`
      : ''
  const codeHtml = extracted.map((b) => b.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(badgeClasses, allBadges)
  return `<section class="sg-section" id="badges"><h2 class="sg-title">${id}. 배지</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildAccordionSection(id: number, includeCode: boolean, result: AnalysisResult, extraClasses: string[] = []): string {
  const accordionClasses = [...new Set([...result.components.accordions, ...extraClasses])].slice(0, 20)
  const allAccordions = result.extractedMarkup.accordions
  const seenClasses = new Set<string>()
  const extracted = allAccordions.filter((a) => {
    if (seenClasses.has(a.classes)) return false
    seenClasses.add(a.classes)
    return true
  }).slice(0, 3)
  const extraAccordionsHtml = extraClasses.map(cls => `<div class="sg-extracted-item"><div class="${cls}">아코디언 (.${cls})</div></div>`).join('')
  const previewHtml =
    extracted.length > 0
      ? extracted.map((a) => `<div class="sg-extracted-item">${a.html}</div>`).join('') + extraAccordionsHtml
      : extraAccordionsHtml
  const codeHtml = extracted.map((a) => a.html).join('\n\n')
  const codeBlock = buildCodeBlock(codeHtml, includeCode)
  const classListHtml = buildSortedClassList(accordionClasses, allAccordions)
  return `<section class="sg-section" id="accordions"><h2 class="sg-title">${id}. 아코디언</h2>${classListHtml}<div class="sg-preview">${previewHtml}</div>${codeBlock}</section>`
}

function buildFaviconSection(id: number, result: AnalysisResult): string {
  let html = `<section class="sg-section" id="favicon">
    <h2 class="sg-title">${id}. 파비콘과 OG</h2>
    <style>
      .sg-url-list { list-style: none; padding: 0; margin: 0; }
      .sg-url-list li { padding: 10px 15px; background: #F9FAFB; border-radius: 6px; margin-bottom: 8px; font-size: 14px; color: #374151; word-break: break-all; }
      .sg-url-list li:last-child { margin-bottom: 0; }
    </style>`

  // 파비콘 섹션 - 주소만 텍스트로 표시
  if (result.favicons.length > 0) {
    html += `
    <h3 class="sg-subtitle">파비콘 (Favicon)</h3>
    <div class="sg-preview">
      <ul class="sg-url-list">`
    
    result.favicons.forEach(favicon => {
      html += `
        <li>${escapeHtml(favicon.href)}</li>`
    })
    
    html += `
      </ul>
    </div>`
  }

  // OG 이미지 섹션 - 주소만 텍스트로 표시
  if (result.ogTags.length > 0) {
    const ogImage = result.ogTags.find(t => t.property === 'og:image')
    
    if (ogImage) {
      html += `
    <h3 class="sg-subtitle">Open Graph (OG) 이미지</h3>
    <div class="sg-preview">
      <ul class="sg-url-list">
        <li>${escapeHtml(ogImage.content)}</li>
      </ul>
    </div>`
    }
  }

  html += `
  </section>`
  
  return html
}

