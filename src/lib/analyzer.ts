import type { UploadedFile, AnalysisResult, ExtractedMarkup, CSSVariable, FaviconInfo, OGTagInfo, TypographyInfo } from '@/types'
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
    hasFavicon: false,
    hasOG: false,
    favicons: [],
    ogTags: [],
    typographyInfo: [],
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

      // 파비콘 추출
      doc.querySelectorAll('link[rel*="icon"]').forEach((el) => {
        const link = el as HTMLLinkElement
        const href = link.getAttribute('href')
        if (href) {
          const faviconInfo: FaviconInfo = {
            rel: link.getAttribute('rel') || 'icon',
            href: href,
            sizes: link.getAttribute('sizes') || undefined,
            type: link.getAttribute('type') || undefined,
          }
          // 중복 방지
          if (!result.favicons.find(f => f.href === href)) {
            result.favicons.push(faviconInfo)
          }
        }
      })
      if (result.favicons.length > 0) result.hasFavicon = true

      // OG 메타태그 추출
      doc.querySelectorAll('meta[property^="og:"]').forEach((el) => {
        const meta = el as HTMLMetaElement
        const property = meta.getAttribute('property')
        const content = meta.getAttribute('content')
        if (property && content) {
          const ogInfo: OGTagInfo = { property, content }
          // 중복 방지
          if (!result.ogTags.find(t => t.property === property)) {
            result.ogTags.push(ogInfo)
          }
        }
      })
      if (result.ogTags.length > 0) result.hasOG = true

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

  // 버튼 - button 태그는 클래스가 없어도 무조건 추출
  doc.querySelectorAll('button, .btn, [class*="btn-"]').forEach((el) => {
    const html = el.outerHTML
    const element = el as HTMLElement
    const isButtonTag = el.tagName.toLowerCase() === 'button'
    const classKey = element.className || (isButtonTag ? 'button' : '')
    
    // button 태그는 클래스가 없어도 추출, 다른 요소는 클래스가 있어야 추출
    if (!markup.buttons.find((b) => b.classes === classKey) && (isButtonTag || element.className)) {
      markup.buttons.push({
        classes: classKey,
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
  
  // 테이블 래퍼 클래스 패턴
  const isTableWrapper = (el: Element | null): boolean => {
    if (!el || el.tagName !== 'DIV') return false
    const className = (el as HTMLElement).className || ''
    return (
      className.includes('table-wrap') ||
      className.includes('table_wrap') ||
      className.includes('table-responsive') ||
      className.includes('tbl-wrap') ||
      className.includes('tbl_wrap') ||
      el.classList.contains('table') ||
      el.classList.contains('tbl')
    )
  }
  
  doc.querySelectorAll('table').forEach((el) => {
    const element = el as HTMLElement
    result.tables.push(element.className)

    if (markup.tables.length < 5) {
      let targetEl: Element = el
      const parent = el.parentElement
      const grandparent = parent?.parentElement
      
      // 부모 또는 조부모가 테이블 래퍼인지 확인
      if (grandparent && isTableWrapper(grandparent)) {
        targetEl = grandparent
      } else if (parent && isTableWrapper(parent)) {
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
  doc.querySelectorAll('.page-navi, .page-links, .paging, .pagination, [class*="paging"], [class*="pager"], [class*="_pager"], [class*="-pager"]').forEach((el) => {
    const element = el as HTMLElement
    
    // 부모 태그가 페이지네이션 관련 래퍼인지 확인하고, 래퍼까지 포함
    let targetEl: Element = el
    const parent = el.parentElement
    const grandparent = parent?.parentElement
    
    // 페이지네이션 래퍼인지 확인
    const isPaginationWrapper = (elem: Element | null): boolean => {
      if (!elem) return false
      const className = (elem as HTMLElement).className || ''
      return (
        className.includes('paging') ||
        className.includes('pager') ||
        className.includes('pagination') ||
        className.includes('page-navi') ||
        elem.tagName === 'NAV'
      )
    }
    
    if (grandparent && isPaginationWrapper(grandparent)) {
      targetEl = grandparent
    } else if (parent && isPaginationWrapper(parent)) {
      targetEl = parent
    }
    
    const html = cleanMarkup(targetEl.outerHTML)
    // 이미 추출한 요소의 부모/자식이 아닌 경우에만 추가
    const isDuplicate = markup.paginations.some(p => 
      p.html.includes(html) || html.includes(p.html)
    )
    
    if (markup.paginations.length < 3 && !isDuplicate && html.length < 3000) {
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
    .querySelectorAll('.badge, [class*="badge"], .tag, [class*="state-"], [class*="status-"]')
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

  // 타이포그래피 - 클래스와 태그, ID 함께 추출
  const typographySelectors = [
    '[class*="title"]',
    '[class*="tit-"]',
    '[class*="heading"]',
    '[class*="headline"]',
    '[class*="subtitle"]',
    '[class*="desc"]',
    '[class*="text-"]',
    'h1[class]', 'h2[class]', 'h3[class]', 'h4[class]', 'h5[class]', 'h6[class]',
    // ID 기반 타이포그래피
    '[id*="title"]',
    '[id*="heading"]',
    'h1[id]', 'h2[id]', 'h3[id]', 'h4[id]', 'h5[id]', 'h6[id]',
  ]
  doc.querySelectorAll(typographySelectors.join(', ')).forEach((el) => {
    const element = el as HTMLElement
    const tagName = el.tagName.toLowerCase()
    const classValue = element.className
    const idValue = element.id
    
    // 클래스가 있는 경우
    if (classValue) {
      classValue.split(' ').forEach((cls) => {
        cls = cls.trim()
        if (cls && (cls.includes('title') || cls.includes('tit') || cls.includes('heading') || 
            cls.includes('headline') || cls.includes('subtitle') || cls.includes('desc') || 
            cls.includes('text-') || ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName))) {
          if (!result.typographyInfo.find(t => t.className === cls)) {
            result.typographyInfo.push({
              className: cls,
              tagName: tagName,
              text: el.textContent?.trim().substring(0, 50) || '',
            })
          }
        }
      })
    }
    
    // ID가 있고 클래스가 없는 경우 (ID 기반 타이포그래피)
    if (idValue && !classValue) {
      const idKey = `#${idValue}`
      if (idValue.includes('title') || idValue.includes('heading') || 
          ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
        if (!result.typographyInfo.find(t => t.className === idKey)) {
          result.typographyInfo.push({
            className: idKey,
            tagName: tagName,
            text: el.textContent?.trim().substring(0, 50) || '',
          })
          // components.typography에도 추가
          result.components.typography.push(idKey)
        }
      }
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

  // role 속성 기반 추출
  // role="list" -> 리스트
  doc.querySelectorAll('[role="list"]').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.lists.length < 5 && html.length < 1500) {
      const existingClasses = markup.lists.map(l => l.classes)
      if (!existingClasses.includes(element.className)) {
        markup.lists.push({ classes: element.className || 'role-list', html })
      }
    }
    if (element.className) {
      result.components.lists.push(element.className)
    }
  })

  // role="tablist" -> 탭
  doc.querySelectorAll('[role="tablist"]').forEach((el) => {
    const element = el as HTMLElement
    // 부모 컨테이너를 찾아서 탭 전체를 추출
    let targetEl: Element = el
    const parent = el.parentElement
    if (parent && parent.tagName !== 'BODY') {
      targetEl = parent
    }
    const html = cleanMarkup(targetEl.outerHTML)
    if (markup.tabs.length < 3 && html.length < 3000) {
      const existingClasses = markup.tabs.map(t => t.classes)
      const targetClassName = (targetEl as HTMLElement).className
      if (!existingClasses.includes(targetClassName)) {
        markup.tabs.push({ classes: targetClassName || 'role-tablist', html })
      }
    }
    if (element.className) {
      result.components.tabs.push(element.className)
    }
  })

  // role="dialog" -> 모달
  doc.querySelectorAll('[role="dialog"], [role="alertdialog"]').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.modals.length < 3 && html.length < 5000) {
      const existingClasses = markup.modals.map(m => m.classes)
      if (!existingClasses.includes(element.className)) {
        markup.modals.push({ classes: element.className || 'role-dialog', html })
      }
    }
    if (element.className) {
      result.modals.push(element.className)
      result.components.modals.push(element.className)
    }
  })

  // role="button" -> 버튼
  doc.querySelectorAll('[role="button"]').forEach((el) => {
    const element = el as HTMLElement
    const html = el.outerHTML
    if (!markup.buttons.find((b) => b.classes === element.className) && element.className) {
      markup.buttons.push({
        classes: element.className,
        html,
        text: el.textContent?.trim().substring(0, 30) || '',
      })
    }
    if (element.className) {
      result.components.buttons.push(element.className)
    }
  })

  // role="navigation" -> 내비게이션 (리스트로 분류)
  doc.querySelectorAll('[role="navigation"]').forEach((el) => {
    const element = el as HTMLElement
    if (element.className) {
      result.components.lists.push(element.className)
    }
  })

  // role="table" -> 테이블
  doc.querySelectorAll('[role="table"], [role="grid"]').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (markup.tables.length < 5 && html.length < 5000) {
      const existingClasses = markup.tables.map(t => t.classes)
      if (!existingClasses.includes(element.className)) {
        markup.tables.push({ classes: element.className || 'role-table', html })
      }
    }
    if (element.className) {
      result.tables.push(element.className)
      result.components.tables.push(element.className)
    }
  })

  // ID 기반 추출 (gnb, snb, nav, menu는 제외)

  // #tab 관련 ID
  doc.querySelectorAll('[id*="tab"]').forEach((el) => {
    const element = el as HTMLElement
    const idName = element.id
    if (idName && !idName.includes('table')) {
      const html = cleanMarkup(el.outerHTML)
      if (markup.tabs.length < 3 && html.length < 3000) {
        const existingClasses = markup.tabs.map(t => t.classes)
        if (!existingClasses.includes(idName)) {
          markup.tabs.push({ classes: `#${idName}`, html })
        }
      }
      result.components.tabs.push(`#${idName}`)
    }
  })

  // #modal, #popup, #layer 관련 ID
  doc.querySelectorAll('[id*="modal"], [id*="popup"], [id*="layer"], [id*="dialog"]').forEach((el) => {
    const element = el as HTMLElement
    const idName = element.id
    if (idName) {
      const html = cleanMarkup(el.outerHTML)
      if (markup.modals.length < 3 && html.length < 5000) {
        const existingClasses = markup.modals.map(m => m.classes)
        if (!existingClasses.includes(idName)) {
          markup.modals.push({ classes: `#${idName}`, html })
        }
      }
      result.modals.push(`#${idName}`)
      result.components.modals.push(`#${idName}`)
    }
  })

  // #accordion, #collapse 관련 ID
  doc.querySelectorAll('[id*="accordion"], [id*="collapse"], [id*="toggle"], [id*="faq"]').forEach((el) => {
    const element = el as HTMLElement
    const idName = element.id
    if (idName) {
      const html = cleanMarkup(el.outerHTML)
      if (markup.accordions.length < 3 && html.length < 5000) {
        const existingClasses = markup.accordions.map(a => a.classes)
        if (!existingClasses.includes(idName)) {
          markup.accordions.push({ classes: `#${idName}`, html })
        }
      }
      result.components.accordions.push(`#${idName}`)
    }
  })

  // #paging, #pagination 관련 ID
  doc.querySelectorAll('[id*="paging"], [id*="pagination"], [id*="page-nav"]').forEach((el) => {
    const element = el as HTMLElement
    const idName = element.id
    if (idName) {
      const html = cleanMarkup(el.outerHTML)
      if (markup.paginations.length < 2 && html.length < 3000) {
        const existingClasses = markup.paginations.map(p => p.classes)
        if (!existingClasses.includes(idName)) {
          markup.paginations.push({ classes: `#${idName}`, html })
        }
      }
      result.components.pagination.push(`#${idName}`)
    }
  })

  // #form 관련 ID
  doc.querySelectorAll('form[id], [id*="form"], [id*="search"]').forEach((el) => {
    const element = el as HTMLElement
    const idName = element.id
    if (idName) {
      const html = cleanMarkup(el.outerHTML)
      if (markup.forms.length < 5 && html.length < 3000) {
        const existingClasses = markup.forms.map(f => f.classes)
        if (!existingClasses.includes(idName)) {
          markup.forms.push({ classes: `#${idName}`, html })
        }
      }
      result.components.forms.push(`#${idName}`)
    }
  })
}

function categorizeComponents(result: AnalysisResult): void {
  const classes = Array.from(result.classes)
  const ids = Array.from(result.ids).map(id => `#${id}`)
  const allIdentifiers = [...classes, ...ids]
  
  result.components = {
    buttons: classes.filter((c) => c.includes('btn') || c.includes('button')),
    forms: allIdentifiers.filter((c) => c.includes('form') || c.includes('input') || c.includes('select') || c.includes('search')),
    tables: classes.filter((c) => c.includes('table') || c.includes('tbl')),
    boxes: classes.filter((c) => c.includes('box') || c.includes('card')),
    lists: allIdentifiers.filter((c) => c.includes('list')),
    modals: allIdentifiers.filter((c) => c.includes('modal') || c.includes('popup') || c.includes('layer') || c.includes('dialog')),
    tabs: allIdentifiers.filter((c) => (c.includes('tab') && !c.includes('table'))),
    pagination: allIdentifiers.filter((c) => c.includes('page') || c.includes('paging')),
    typography: classes.filter(
      (c) => c.includes('title') || c.includes('tit') || c.includes('heading')
    ),
    badges: classes.filter(
      (c) =>
        c.includes('badge') ||
        c.includes('tag') ||
        c.includes('state') ||
        c.includes('status')
    ),
    accordions: allIdentifiers.filter(
      (c) => c.includes('accordion') || c.includes('collapse') || c.includes('toggle') || c.includes('aco') || c.includes('faq')
    ),
  }
}
