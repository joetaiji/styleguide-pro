import type { UploadedFile, AnalysisResult, ExtractedMarkup, CSSVariable, FaviconInfo, OGTagInfo, TypographyInfo } from '@/types'
import { replaceImagePaths } from './imageStore'

function cleanMarkup(html: string): string {
  html = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
  html = html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
  html = html.replace(
    /\s(onclick|onload|onerror|onmouseover|onmouseout|onfocus|onblur)="[^"]*"/gi,
    ''
  )
  // href 링크를 #으로 처리
  html = html.replace(/href="[^"]*"/gi, 'href="#"')
  html = html.replace(/href='[^']*'/gi, "href='#'")
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
          // 카테고리 분류 - 컬러는 #으로 시작하는 HEX 값만
          let category: CSSVariable['category'] = 'other'
          
          if (value.startsWith('#') || value.startsWith('rgb') || value.startsWith('hsl')) {
            // HEX, rgb(), hsl() 색상 값만 color로 분류
            category = 'color'
          } else if (
            name.includes('font') ||
            name.includes('letter') ||
            name.includes('family')
          ) {
            category = 'font'
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
          }

          result.cssVariables.push({ name, value, category })
        }
      }
    })

  // 모든 컴포넌트를 개수가 많은 순서로 정렬
  result.typographyInfo.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.buttons.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.forms.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.tables.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.boxes.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.helperBoxes.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.lists.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.stepLists.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.breadcrumbs.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.menus.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.leftMenus.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.tabs.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.paginations.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.modals.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.badges.sort((a, b) => (b.count || 0) - (a.count || 0))
  result.extractedMarkup.accordions.sort((a, b) => (b.count || 0) - (a.count || 0))

  // 컴포넌트 분류
  categorizeComponents(result)

  return result
}

function extractComponents(doc: Document, result: AnalysisResult): void {
  const markup = result.extractedMarkup

  // 버튼 - button 태그는 클래스가 없어도 무조건 추출 (개수 카운트)
  // Swiper 관련 요소는 제외
  const isSliderRelated = (el: Element): boolean => {
    const className = (el as HTMLElement).className?.toLowerCase() || ''
    if (className.includes('swiper') || className.includes('slick') || 
        className.includes('owl-') || className.includes('bx-') || 
        className.includes('splide')) {
      return true
    }
    // 부모 요소 체크
    let parent = el.parentElement
    while (parent) {
      const parentClass = parent.className?.toLowerCase() || ''
      if (parentClass.includes('swiper') || parentClass.includes('slick') || 
          parentClass.includes('owl-') || parentClass.includes('bx-') || 
          parentClass.includes('splide')) {
        return true
      }
      parent = parent.parentElement
    }
    return false
  }
  
  doc.querySelectorAll('button, .btn, [class*="btn-"]').forEach((el) => {
    const element = el as HTMLElement
    const isButtonTag = el.tagName.toLowerCase() === 'button'
    const classKey = element.className || (isButtonTag ? 'button' : '')
    
    // Swiper 관련 요소 제외
    if (isSliderRelated(el)) {
      return
    }
    
    const html = cleanMarkup(el.outerHTML)
    
    // button 태그는 클래스가 없어도 추출, 다른 요소는 클래스가 있어야 추출
    if (isButtonTag || element.className) {
      const existing = markup.buttons.find((b) => b.classes === classKey)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.buttons.push({
          classes: classKey,
          html,
          text: el.textContent?.trim().substring(0, 30) || '',
          count: 1,
        })
      }
    }
    result.buttons.push({
      classes: element.className,
      text: el.textContent?.trim().substring(0, 30) || '',
    })
  })

  // 폼 (개수 카운트)
  doc.querySelectorAll('.form-group, .form-row, .form-item, .write-form').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 2000) {
      const existing = markup.forms.find((f) => f.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.forms.push({ classes: element.className, html, count: 1 })
      }
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

    let targetEl: Element = el
    const parent = el.parentElement
    const grandparent = parent?.parentElement
    
    // 부모 또는 조부모가 테이블 래퍼인지 확인
    if (grandparent && isTableWrapper(grandparent)) {
      targetEl = grandparent
    } else if (parent && isTableWrapper(parent)) {
      targetEl = parent
    }

    const targetClass = (targetEl as HTMLElement).className || 'table'
    const html = cleanMarkup(targetEl.outerHTML)
    
    if (html.length < 5000) {
      const existing = markup.tables.find((t) => t.classes === targetClass)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else if (!extractedTableElements.has(targetEl)) {
        extractedTableElements.add(targetEl)
        markup.tables.push({
          classes: targetClass,
          html,
          count: 1,
        })
      }
    }
  })

  // 박스 (개수 카운트)
  doc.querySelectorAll('.box, .box-wrap, .flex-box').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 2000) {
      const existing = markup.boxes.find((b) => b.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.boxes.push({ classes: element.className, html, count: 1 })
      }
    }
  })

  // 도움말 박스 (개수 카운트)
  doc.querySelectorAll('.helper-box').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 2000) {
      const existing = markup.helperBoxes.find((b) => b.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.helperBoxes.push({ classes: element.className, html, count: 1 })
      }
    }
  })

  // 리스트 (개수 카운트)
  doc.querySelectorAll('.list-dot, .list-order, .list-dash, .list-sdot').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 1500) {
      const existing = markup.lists.find((l) => l.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.lists.push({ classes: element.className, html, count: 1 })
      }
    }
  })

  // 스텝 리스트 (개수 카운트)
  doc.querySelectorAll('.step-list, .list-procedure').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 3000) {
      const existing = markup.stepLists.find((l) => l.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.stepLists.push({ classes: element.className, html, count: 1 })
      }
    }
  })

  // 브레드크럼 (개수 카운트)
  doc.querySelectorAll('.breadcrumb-wrap, .breadcrumb').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    const existing = markup.breadcrumbs.find((b) => b.classes === element.className)
    if (existing) {
      existing.count = (existing.count || 1) + 1
    } else {
      markup.breadcrumbs.push({ classes: element.className, html, count: 1 })
    }
  })

  // 메뉴 (개수 카운트)
  doc.querySelectorAll('.topmenu, .head-gnb').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 5000) {
      const existing = markup.menus.find((m) => m.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.menus.push({ classes: element.className, html, count: 1 })
      }
    }
  })

  // 좌측 메뉴 (개수 카운트)
  doc.querySelectorAll('.left-menu, #snb').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 5000) {
      const existing = markup.leftMenus.find((m) => m.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.leftMenus.push({ classes: element.className, html, count: 1 })
      }
    }
  })

  // 탭 (개수 카운트) - 탭 요소만 정확히 추출
  doc.querySelectorAll('.tabs, .tab-nav, .tab-conts-wrap, [role="tablist"]').forEach((el) => {
    const element = el as HTMLElement
    const className = element.className
    
    // contents, section 같은 너무 큰 컨테이너는 제외
    if (className.includes('contents') || className.includes('section') || className.includes('page-')) {
      return
    }
    
    const html = cleanMarkup(el.outerHTML)
    // 탭 요소는 보통 작으므로 크기 제한을 더 줄임
    if (html.length < 1500) {
      const existing = markup.tabs.find((t) => t.classes === className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.tabs.push({ classes: className, html, count: 1 })
      }
    }
  })

  // 페이지네이션 - 감싸는 부모 태그까지 추출 (개수 카운트)
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
    const targetClass = (targetEl as HTMLElement).className || 'pagination'
    
    // 이미 추출한 요소의 부모/자식이 아닌 경우에만 추가
    const isDuplicate = markup.paginations.some(p => 
      p.html.includes(html) || html.includes(p.html)
    )
    
    if (html.length < 3000) {
      const existing = markup.paginations.find((p) => p.classes === targetClass)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else if (!isDuplicate) {
        markup.paginations.push({ classes: targetClass, html, count: 1 })
      }
    }
  })

  // 모달 (개수 카운트)
  doc.querySelectorAll('.modal, .popup, [class*="layer"]').forEach((el) => {
    const element = el as HTMLElement
    const html = cleanMarkup(el.outerHTML)
    if (html.length < 5000) {
      const existing = markup.modals.find((m) => m.classes === element.className)
      if (existing) {
        existing.count = (existing.count || 1) + 1
      } else {
        markup.modals.push({ classes: element.className, html, count: 1 })
      }
    }
    result.modals.push(element.className)
  })

  // 배지 (개수 카운트)
  doc
    .querySelectorAll('.badge, [class*="badge"], .tag, [class*="state-"], [class*="status-"]')
    .forEach((el) => {
      const element = el as HTMLElement
      const html = cleanMarkup(el.outerHTML)
      if (html.length < 500) {
        const existing = markup.badges.find((b) => b.classes === element.className)
        if (existing) {
          existing.count = (existing.count || 1) + 1
        } else {
          markup.badges.push({
            classes: element.className,
            html,
            text: el.textContent?.trim().substring(0, 30) || '',
            count: 1,
          })
        }
      }
    })

  // 아코디언 (개수 카운트)
  doc
    .querySelectorAll('.accordion, [class*="accordion"], .collapse, .toggle-wrap, .aco-wrap')
    .forEach((el) => {
      const element = el as HTMLElement
      const html = cleanMarkup(el.outerHTML)
      if (html.length < 5000) {
        const existing = markup.accordions.find((a) => a.classes === element.className)
        if (existing) {
          existing.count = (existing.count || 1) + 1
        } else {
          markup.accordions.push({ classes: element.className, html, count: 1 })
        }
      }
    })

  // 타이포그래피 - h1~h6 태그의 클래스 추출 (main 태그 우선, 없으면 .contents, 둘 다 없으면 전체)
  // main 태그 또는 .contents 존재 여부 확인
  const mainElement = doc.querySelector('main')
  const contentsElement = doc.querySelector('.contents')
  let typoSelector: string
  if (mainElement) {
    typoSelector = 'main h1[class], main h2[class], main h3[class], main h4[class], main h5[class], main h6[class]'
  } else if (contentsElement) {
    typoSelector = '.contents h1[class], .contents h2[class], .contents h3[class], .contents h4[class], .contents h5[class], .contents h6[class]'
  } else {
    typoSelector = 'h1[class], h2[class], h3[class], h4[class], h5[class], h6[class]'
  }
  
  doc.querySelectorAll(typoSelector).forEach((el) => {
    const element = el as HTMLElement
    const tagName = el.tagName.toLowerCase()
    const classValue = element.className
    
    if (classValue) {
      classValue.split(' ').forEach((cls) => {
        cls = cls.trim()
        // 클래스명에 'title' 또는 'tit'이 포함된 경우만 추출
        if (cls && (cls.toLowerCase().includes('title') || cls.toLowerCase().includes('tit'))) {
          // result.typographyInfo에서 기존 항목 찾기
          const existing = result.typographyInfo.find(t => t.className === cls)
          if (existing) {
            existing.count = (existing.count || 0) + 1
          } else {
            result.typographyInfo.push({
              className: cls,
              tagName: tagName,
              text: el.textContent?.trim().substring(0, 50) || '',
              count: 1,
            })
          }
        }
      })
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

  // role="tablist" -> 탭 (컴포넌트 분류만, 마크업은 위에서 이미 추출됨)
  doc.querySelectorAll('[role="tablist"]').forEach((el) => {
    const element = el as HTMLElement
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

  // role="button" -> 버튼 (슬라이더 관련 제외)
  doc.querySelectorAll('[role="button"]').forEach((el) => {
    const element = el as HTMLElement
    const className = element.className?.toLowerCase() || ''
    
    // 슬라이더 관련 요소 제외
    if (className.includes('swiper') || className.includes('slick') || 
        className.includes('owl-') || className.includes('bx-') || 
        className.includes('splide')) {
      return
    }
    
    const html = cleanMarkup(el.outerHTML)
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

  // #tab 관련 ID (큰 컨테이너 제외)
  doc.querySelectorAll('[id*="tab"]').forEach((el) => {
    const element = el as HTMLElement
    const idName = element.id
    const className = element.className || ''
    
    // table 포함, contents/section 같은 큰 컨테이너 제외
    if (idName && !idName.includes('table') && 
        !className.includes('contents') && !className.includes('section') && !className.includes('page-')) {
      const html = cleanMarkup(el.outerHTML)
      // 크기 제한 1500으로 줄임
      if (html.length < 1500) {
        const existing = markup.tabs.find(t => t.classes === `#${idName}`)
        if (existing) {
          existing.count = (existing.count || 1) + 1
        } else {
          markup.tabs.push({ classes: `#${idName}`, html, count: 1 })
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
  
  // 슬라이더 관련 클래스 제외 함수
  const isSliderClass = (c: string): boolean => {
    const lower = c.toLowerCase()
    return lower.includes('swiper') || lower.includes('slick') || 
           lower.includes('owl-') || lower.includes('bx-') || lower.includes('splide')
  }
  
  result.components = {
    buttons: classes.filter((c) => (c.includes('btn') || c.includes('button')) && !isSliderClass(c)),
    forms: allIdentifiers.filter((c) => c.includes('form') || c.includes('input') || c.includes('select') || c.includes('search')),
    tables: classes.filter((c) => c.includes('table') || c.includes('tbl')),
    boxes: classes.filter((c) => c.includes('box') || c.includes('card')),
    lists: allIdentifiers.filter((c) => c.includes('list')),
    modals: allIdentifiers.filter((c) => c.includes('modal') || c.includes('popup') || c.includes('layer') || c.includes('dialog')),
    tabs: allIdentifiers.filter((c) => (c.includes('tab') && !c.includes('table'))),
    pagination: allIdentifiers.filter((c) => c.includes('page') || c.includes('paging')),
    typography: result.typographyInfo.map(t => t.className),
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
