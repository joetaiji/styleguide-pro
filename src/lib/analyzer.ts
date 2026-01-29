import type { UploadedFile, AnalysisResult, ExtractedMarkup, CSSVariable } from '@/types'
import { replaceImagePaths } from './imageStore'

function cleanMarkup(html: string): string {
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  html = html.replace(
    /\s(onclick|onload|onerror|onmouseover|onmouseout|onfocus|onblur)="[^"]*"/gi,
    ''
  )
  html = replaceImagePaths(html)
  html = html.replace(/\s+/g, ' ')
  html = html.replace(/>\s+</g, '>\n<')
  return html.trim()
}

export function analyzeFiles(files: UploadedFile[]): AnalysisResult {
  const result: AnalysisResult = {
    htmlFiles: files.filter((f) => f.type === 'html').length,
    cssFiles: files.filter((f) => f.type === 'css').length,
    jsFiles: files.filter((f) => f.type === 'js').length,
    imageFiles: files.filter((f) => f.type === 'image').length,
    classes: new Set(),
    ids: new Set(),
    tags: new Set(),
    colors: new Set(),
    cssVariables: [],
    buttons: [],
    inputs: [],
    tables: [],
    modals: [],
    icons: new Set(),
    components: {
      buttons: [],
      forms: [],
      tables: [],
      boxes: [],
      lists: [],
      modals: [],
      tabs: [],
      pagination: [],
      typography: [],
      badges: [],
      accordions: [],
    },
    extractedMarkup: {
      buttons: [],
      forms: [],
      tables: [],
      boxes: [],
      helperBoxes: [],
      lists: [],
      stepLists: [],
      breadcrumbs: [],
      menus: [],
      leftMenus: [],
      tabs: [],
      paginations: [],
      modals: [],
      badges: [],
      accordions: [],
    },
  }

  // HTML 분석
  files
    .filter((f) => f.type === 'html')
    .forEach((file) => {
      const parser = new DOMParser()
      const doc = parser.parseFromString(file.content, 'text/html')

      // 클래스, ID, 태그 추출 (SVG 요소도 처리)
      doc.querySelectorAll('[class]').forEach((el) => {
        const classValue = el.getAttribute('class') || ''
        classValue.split(' ').forEach((cls) => {
          if (cls.trim()) result.classes.add(cls.trim())
        })
      })
      doc.querySelectorAll('[id]').forEach((el) => result.ids.add(el.id))
      doc.querySelectorAll('*').forEach((el) => result.tags.add(el.tagName.toLowerCase()))

      // 컴포넌트 추출
      extractComponents(doc, result)
    })

  // CSS 분석
  files
    .filter((f) => f.type === 'css')
    .forEach((file) => {
      // 일반 색상 추출
      const colorRegex = /#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|rgba\([^)]+\)|hsl\([^)]+\)/g
      const colors = file.content.match(colorRegex) || []
      colors.forEach((c) => result.colors.add(c))

      // CSS 변수 추출 (--로 시작하는 변수)
      const cssVarRegex = /--([\w-]+)\s*:\s*([^;]+);/g
      let match
      while ((match = cssVarRegex.exec(file.content)) !== null) {
        const name = match[1].trim()
        const value = match[2].trim()
        
        // 중복 체크
        if (!result.cssVariables.find((v) => v.name === name)) {
          // 카테고리 분류
          let category: CSSVariable['category'] = 'other'
          if (
            value.startsWith('#') ||
            value.startsWith('rgb') ||
            value.startsWith('hsl') ||
            name.includes('color') ||
            name.includes('primary') ||
            name.includes('secondary') ||
            name.includes('gray') ||
            name.includes('point') ||
            name.includes('danger') ||
            name.includes('warning') ||
            name.includes('success') ||
            name.includes('info') ||
            name.includes('bg') ||
            name.includes('border') ||
            name.includes('black') ||
            name.includes('white')
          ) {
            category = 'color'
          } else if (
            value.includes('rem') ||
            value.includes('px') ||
            value.includes('em') ||
            name.includes('size') ||
            name.includes('height') ||
            name.includes('width') ||
            name.includes('space') ||
            name.includes('inner')
          ) {
            category = 'size'
          } else if (
            name.includes('font') ||
            name.includes('letter')
          ) {
            category = 'font'
          }

          result.cssVariables.push({ name, value, category })
        }
      }
    })

  // 컴포넌트 분류
  categorizeComponents(result)

  return result
}

function extractComponents(doc: Document, result: AnalysisResult): void {
  const markup = result.extractedMarkup

  // 버튼
  doc.querySelectorAll('button, .btn, [class*="btn-"]').forEach((el) => {
    const html = el.outerHTML
    const element = el as HTMLElement
    if (!markup.buttons.find((b) => b.classes === element.className) && element.className) {
      markup.buttons.push({
        classes: element.className,
        html,
        text: el.textContent?.trim().substring(0, 30) || '',
      })
    }
    result.buttons.push({
      classes: element.className,
      text: el.textContent?.trim().substring(0, 30) || '',
    })
  })

  // 폼
  doc.querySelectorAll('.form-group, .form-row, .form-item, .write-form').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (!markup.forms.find((f) => f.classes === element.className) && html.length < 2000) {
      markup.forms.push({ classes: element.className, html })
    }
  })

  doc.querySelectorAll('input, select, textarea').forEach((el) => {
    const element = el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    result.inputs.push({
      type: element.type || el.tagName.toLowerCase(),
      classes: element.className,
    })
  })

  // 테이블
  const extractedTableElements = new Set<Element>()
  doc.querySelectorAll('table').forEach((el) => {
    const element = el as HTMLElement
    result.tables.push(element.className)

    if (markup.tables.length < 5) {
      let targetEl: Element = el
      const parent = el.parentElement
      if (
        parent &&
        (parent.classList.contains('table') ||
          parent.classList.contains('table-wrap') ||
          parent.classList.contains('table-responsive') ||
          (parent.tagName === 'DIV' && parent.className?.includes('table')))
      ) {
        targetEl = parent
      }

      if (!extractedTableElements.has(targetEl)) {
        extractedTableElements.add(targetEl)
        const html = cleanMarkup(targetEl.outerHTML)
        if (html.length < 5000) {
          markup.tables.push({
            classes: (targetEl as HTMLElement).className || 'table',
            html,
          })
        }
      }
    }
  })

  // 박스
  doc.querySelectorAll('.box, .box-wrap, .flex-box').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.boxes.length < 5 && html.length < 2000) {
      markup.boxes.push({ classes: element.className, html })
    }
  })

  // 도움말 박스
  doc.querySelectorAll('.helper-box').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.helperBoxes.length < 3 && html.length < 2000) {
      markup.helperBoxes.push({ classes: element.className, html })
    }
  })

  // 리스트
  doc.querySelectorAll('.list-dot, .list-order, .list-dash, .list-sdot').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.lists.length < 5 && html.length < 1500) {
      markup.lists.push({ classes: element.className, html })
    }
  })

  // 스텝 리스트
  doc.querySelectorAll('.step-list, .list-procedure').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.stepLists.length < 2 && html.length < 3000) {
      markup.stepLists.push({ classes: element.className, html })
    }
  })

  // 브레드크럼
  doc.querySelectorAll('.breadcrumb-wrap, .breadcrumb').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.breadcrumbs.length < 2) {
      markup.breadcrumbs.push({ classes: element.className, html })
    }
  })

  // 메뉴
  doc.querySelectorAll('.topmenu, .head-gnb').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.menus.length < 2 && html.length < 5000) {
      markup.menus.push({ classes: element.className, html })
    }
  })

  // 좌측 메뉴
  doc.querySelectorAll('.left-menu, #snb').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.leftMenus.length < 2 && html.length < 5000) {
      markup.leftMenus.push({ classes: element.className, html })
    }
  })

  // 탭
  doc.querySelectorAll('.tabs, .tab-conts-wrap').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.tabs.length < 3 && html.length < 2000) {
      markup.tabs.push({ classes: element.className, html })
    }
  })

  // 페이지네이션 - 감싸는 부모 태그까지 추출
  doc.querySelectorAll('.page-navi, .page-links, .paging, .pagination, [class*="paging"]').forEach((el) => {
    const element = el as HTMLElement
    
    // 부모 태그가 페이지네이션 관련 래퍼인지 확인하고, 래퍼까지 포함
    let targetEl: Element = el
    const parent = el.parentElement
    if (parent && (
      parent.classList.contains('page-navi') ||
      parent.classList.contains('paging') ||
      parent.classList.contains('pagination') ||
      parent.className?.includes('paging') ||
      (parent.tagName === 'DIV' && parent.children.length <= 5) ||
      (parent.tagName === 'NAV')
    )) {
      targetEl = parent
    }
    
    const html = cleanMarkup(targetEl.outerHTML)
    // 이미 추출한 요소의 부모/자식이 아닌 경우에만 추가
    const isDuplicate = markup.paginations.some(p => 
      p.html.includes(html) || html.includes(p.html)
    )
    
    if (markup.paginations.length < 2 && !isDuplicate && html.length < 3000) {
      markup.paginations.push({ classes: (targetEl as HTMLElement).className || 'pagination', html })
    }
  })

  // 모달
  doc.querySelectorAll('.modal, .popup, [class*="layer"]').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.modals.length < 3 && html.length < 5000) {
      markup.modals.push({ classes: element.className, html })
    }
    result.modals.push(element.className)
  })

  // 배지
  doc
    .querySelectorAll('.badge, [class*="badge"], .label, .tag, [class*="state-"], [class*="status-"]')
    .forEach((el) => {
      const element = el as HTMLElement
      const html = cleanMarkup(el.outerHTML)
      if (
        !markup.badges.find((b) => b.classes === element.className) &&
        markup.badges.length < 15 &&
        html.length < 500
      ) {
        markup.badges.push({
          classes: element.className,
          html,
          text: el.textContent?.trim().substring(0, 30) || '',
        })
      }
    })

  // 아코디언
  doc
    .querySelectorAll('.accordion, [class*="accordion"], .collapse, .toggle-wrap, .aco-wrap')
    .forEach((el) => {
      const element = el as HTMLElement
      const html = cleanMarkup(el.outerHTML)
      if (markup.accordions.length < 3 && html.length < 5000) {
        markup.accordions.push({ classes: element.className, html })
      }
    })

  // 아이콘 (SVG 요소도 처리)
  doc.querySelectorAll('[class*="ico-"], [class*="icon-"], .svg-icon').forEach((el) => {
    const classValue = el.getAttribute('class') || ''
    classValue.split(' ').forEach((cls) => {
      if (cls.includes('ico-') || cls.includes('icon-')) {
        result.icons.add(cls)
      }
    })
  })
}

function categorizeComponents(result: AnalysisResult): void {
  const classes = Array.from(result.classes)
  result.components = {
    buttons: classes.filter((c) => c.includes('btn') || c.includes('button')),
    forms: classes.filter((c) => c.includes('form') || c.includes('input') || c.includes('select')),
    tables: classes.filter((c) => c.includes('table') || c.includes('tbl')),
    boxes: classes.filter((c) => c.includes('box') || c.includes('card')),
    lists: classes.filter((c) => c.includes('list')),
    modals: classes.filter((c) => c.includes('modal') || c.includes('popup')),
    tabs: classes.filter((c) => c.includes('tab') && !c.includes('table')),
    pagination: classes.filter((c) => c.includes('page') || c.includes('paging')),
    typography: classes.filter(
      (c) => c.includes('title') || c.includes('tit') || c.includes('heading')
    ),
    badges: classes.filter(
      (c) =>
        c.includes('badge') ||
        c.includes('label') ||
        c.includes('tag') ||
        c.includes('state') ||
        c.includes('status')
    ),
    accordions: classes.filter(
      (c) => c.includes('accordion') || c.includes('collapse') || c.includes('toggle') || c.includes('aco')
    ),
  }
}
