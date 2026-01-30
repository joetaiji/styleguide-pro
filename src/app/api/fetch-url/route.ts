import { NextRequest, NextResponse } from 'next/server'

// 제외할 CSS 라이브러리 패턴
const excludeCssPatterns = [
  /swiper/i,
  /bxslider/i,
  /slick/i,
  /owl\.carousel/i,
  /splide/i,
]

// 제외할 링크 패턴
const excludeLinkPatterns = [
  /\.(jpg|jpeg|png|gif|svg|webp|ico|pdf|zip|doc|docx|xls|xlsx|ppt|pptx)(\?|$)/i,
  /^(mailto:|tel:|javascript:|#)/i,
  /\/(login|logout|signin|signout|register|signup|admin|api|auth)\//i,
  // 언어 변경 페이지 제외
  /^\/(en|eng|english|jp|jpn|japanese|cn|chi|chinese|kr|kor|korean|zh|ja|de|fr|es|vi)\/?$/i,
  /\/(en|eng|english|jp|jpn|japanese|cn|chn|chinese|zh|ja)\//i,
  // 별도 섹션/사이트 제외 (어린이, 키즈 등)
  /\/(kids|children|child|junior|youth)\//i,
  /^https?:\/\/(kids|children|child|www\.|m\.|mobile\.)/i,
]

// CMS 스타일 페이지 URL 패턴 (쿼리 파라미터 허용)
const cmsPagePatterns = [
  /\.(es|do|action|asp|aspx|php|jsp)\?/i,  // menu.es?mid=..., board.do?id=...
  /\?(mid|menu|page|view|mode|act)=/i,      // ?mid=..., ?menu=..., ?page=...
]

// CMS 스타일 페이지인지 확인
function isCmsStylePage(url: string): boolean {
  return cmsPagePatterns.some(pattern => pattern.test(url))
}

// 제외할 쿼리 파라미터 패턴 (검색, 필터 등)
const excludeQueryPatterns = [
  /[?&](search|keyword|query|q)=/i,
  /[?&](sort|order|filter)=/i,
  /[?&](page|p)=\d+/i,  // 페이지네이션
]

// 서브도메인 체크 - 메인 도메인만 허용
function isSameMainDomain(linkHost: string, currentHost: string): boolean {
  // www. 또는 m. 등의 접두사 제거하고 비교
  const cleanHost = (host: string) => host.replace(/^(www\.|m\.|mobile\.|kids\.|children\.)/, '')
  return cleanHost(linkHost) === cleanHost(currentHost)
}

// HTML 콘텐츠인지 확인 (확장자 기반)
function isHtmlPage(pathname: string): boolean {
  const ext = pathname.split('.').pop()?.toLowerCase()
  if (!ext || ext === pathname) return true // 확장자 없으면 HTML로 간주
  return ['html', 'htm', 'php', 'asp', 'aspx', 'jsp', 'do'].includes(ext)
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      },
    })
    if (response.ok) {
      return await response.text()
    }
  } catch (e) {
    console.error(`페이지 가져오기 실패: ${url}`, e)
  }
  return null
}

function extractNavLinks(htmlContent: string, baseUrl: string, currentHost: string): string[] {
  const links: string[] = []
  
  // 네비게이션 영역 추출 (header, nav, gnb, menu 등)
  const navPatterns = [
    /<header[^>]*>[\s\S]*?<\/header>/gi,
    /<nav[^>]*>[\s\S]*?<\/nav>/gi,
    /<[^>]+(class|id)=["'][^"']*(?:gnb|nav|menu|navigation)[^"']*["'][^>]*>[\s\S]*?<\/\w+>/gi,
  ]
  
  let navContent = ''
  navPatterns.forEach(pattern => {
    const matches = htmlContent.match(pattern)
    if (matches) {
      navContent += matches.join(' ')
    }
  })
  
  // 네비게이션 영역이 없으면 전체 페이지에서 추출
  const contentToSearch = navContent || htmlContent
  
  const linkRegex = /<a[^>]+href=["']([^"'#]+)["'][^>]*>/gi
  let match
  
  while ((match = linkRegex.exec(contentToSearch)) !== null) {
    let href = match[1].trim()
    
    // 제외 패턴 확인
    if (excludeLinkPatterns.some(pattern => pattern.test(href))) {
      continue
    }
    
    // 절대 경로로 변환
    if (href.startsWith('//')) {
      href = 'https:' + href
    } else if (href.startsWith('/')) {
      href = baseUrl + href
    } else if (!href.startsWith('http')) {
      // 상대 경로 처리 (menu.es?mid=... 같은 경우)
      if (href.includes('?') || href.match(/^\w+\.(es|do|action|asp|aspx|php|jsp)/i)) {
        href = baseUrl + '/' + href
      } else {
        continue
      }
    }
    
    // 같은 도메인인지 확인
    try {
      const linkUrl = new URL(href)
      
      // 정확히 같은 호스트인지 확인
      if (linkUrl.host !== currentHost) {
        continue
      }
      
      // CMS 스타일 URL 또는 일반 HTML 페이지
      const isCms = isCmsStylePage(href)
      
      if (linkUrl.search) {
        // CMS 스타일이 아니면 제외
        if (!isCms) {
          continue
        }
        // 검색/필터 쿼리는 제외
        if (excludeQueryPatterns.some(pattern => pattern.test(href))) {
          continue
        }
      } else {
        // HTML 페이지인지 확인
        if (!isHtmlPage(linkUrl.pathname)) {
          continue
        }
        // 루트 페이지는 제외
        if (linkUrl.pathname === '/' || linkUrl.pathname === '') {
          continue
        }
      }
      
      // 중복 제거
      const normalizedUrl = normalizeUrl(href)
      const isDuplicate = links.some(link => normalizeUrl(link) === normalizedUrl)
      if (!isDuplicate) {
        links.push(href)
      }
    } catch {
      // 유효하지 않은 URL 무시
    }
  }
  
  return links
}

// URL 정규화 (중복 체크용)
function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    // mid 파라미터가 있으면 그것으로 구분
    const mid = urlObj.searchParams.get('mid')
    if (mid) {
      return `${urlObj.pathname}?mid=${mid}`
    }
    return urlObj.pathname + urlObj.search
  } catch {
    return url
  }
}

function groupLinksByCategory(links: string[], baseUrl: string): Map<string, string[]> {
  const categories = new Map<string, string[]>()
  
  links.forEach(link => {
    try {
      const url = new URL(link)
      let category = 'root'
      
      // CMS 스타일 URL의 경우 mid 파라미터로 카테고리 구분
      const mid = url.searchParams.get('mid')
      if (mid) {
        // mid=a10102000000 -> a101 (앞 4자리를 카테고리로)
        category = mid.substring(0, 4) || mid.substring(0, 3) || 'cms'
      } else {
        // 일반 URL의 경우 첫 번째 경로를 카테고리로
        const pathParts = url.pathname.split('/').filter(p => p.length > 0)
        category = pathParts.length > 0 ? pathParts[0] : 'root'
      }
      
      if (!categories.has(category)) {
        categories.set(category, [])
      }
      categories.get(category)!.push(link)
    } catch {
      // 무시
    }
  })
  
  return categories
}

function extractCssLinks(htmlContent: string, baseUrl: string, pathname: string): string[] {
  const cssLinks: string[] = []
  const linkRegex = /<link[^>]+href=["']([^"']+\.css[^"']*)["'][^>]*>/gi
  let match
  
  while ((match = linkRegex.exec(htmlContent)) !== null) {
    let cssUrl = match[1]
    
    if (cssUrl.startsWith('//')) {
      cssUrl = 'https:' + cssUrl
    } else if (cssUrl.startsWith('/')) {
      cssUrl = baseUrl + cssUrl
    } else if (!cssUrl.startsWith('http')) {
      const pathParts = pathname.split('/')
      pathParts.pop()
      cssUrl = baseUrl + pathParts.join('/') + '/' + cssUrl
    }
    
    // 제외 패턴 확인
    if (!excludeCssPatterns.some(pattern => pattern.test(cssUrl))) {
      if (!cssLinks.includes(cssUrl)) {
        cssLinks.push(cssUrl)
      }
    }
  }
  
  // @import 추출
  const importRegex = /@import\s+(?:url\()?["']?([^"'\)]+\.css[^"'\)]*)["']?\)?/gi
  while ((match = importRegex.exec(htmlContent)) !== null) {
    let cssUrl = match[1]
    
    if (cssUrl.startsWith('//')) {
      cssUrl = 'https:' + cssUrl
    } else if (cssUrl.startsWith('/')) {
      cssUrl = baseUrl + cssUrl
    } else if (!cssUrl.startsWith('http')) {
      const pathParts = pathname.split('/')
      pathParts.pop()
      cssUrl = baseUrl + pathParts.join('/') + '/' + cssUrl
    }
    
    if (!excludeCssPatterns.some(pattern => pattern.test(cssUrl))) {
      if (!cssLinks.includes(cssUrl)) {
        cssLinks.push(cssUrl)
      }
    }
  }
  
  return cssLinks
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL이 필요합니다.' }, { status: 400 })
    }

    // URL 유효성 검사
    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json({ error: '유효하지 않은 URL입니다.' }, { status: 400 })
    }

    const baseUrl = `${parsedUrl.protocol}//${parsedUrl.host}`
    const currentHost = parsedUrl.host

    // 메인 페이지 HTML 가져오기
    const mainHtml = await fetchPage(url)
    if (!mainHtml) {
      return NextResponse.json({ error: '페이지를 가져올 수 없습니다.' }, { status: 400 })
    }

    // HTML 파일들 수집
    const htmlPages: { url: string; content: string }[] = [
      { url, content: mainHtml }
    ]

    // 네비게이션에서 링크 추출 (header, nav, gnb 등)
    const navLinks = extractNavLinks(mainHtml, baseUrl, currentHost)
    
    // 카테고리별로 그룹화하여 고르게 선택
    const categorizedLinks = groupLinksByCategory(navLinks, baseUrl)
    const categories = Array.from(categorizedLinks.keys())
    
    // 각 카테고리에서 균등하게 링크 선택 (총 최대 20개)
    const maxTotal = 20
    const linksPerCategory = Math.max(1, Math.floor(maxTotal / Math.max(categories.length, 1)))
    const selectedLinks: string[] = []
    
    for (const category of categories) {
      const categoryLinks = categorizedLinks.get(category) || []
      const links = categoryLinks
        .filter(link => link !== url)
        .slice(0, linksPerCategory)
      selectedLinks.push(...links)
      
      if (selectedLinks.length >= maxTotal) break
    }
    
    // 서브페이지들 병렬로 가져오기 (최대 20개)
    const subpagePromises = selectedLinks.slice(0, maxTotal).map(link =>
      fetchPage(link).then(content => 
        content ? { url: link, content } : null
      )
    )
    
    const subpageResults = await Promise.all(subpagePromises)
    subpageResults.forEach(result => {
      if (result) {
        htmlPages.push(result)
      }
    })

    // 모든 페이지에서 CSS 링크 수집
    const allCssLinks: string[] = []
    htmlPages.forEach(page => {
      const pageUrl = new URL(page.url)
      const cssLinks = extractCssLinks(page.content, baseUrl, pageUrl.pathname)
      cssLinks.forEach(link => {
        if (!allCssLinks.includes(link)) {
          allCssLinks.push(link)
        }
      })
    })

    // CSS 파일들 가져오기 (최대 15개)
    const cssContents: { url: string; content: string }[] = []
    const fetchedCssUrls = new Set<string>()
    
    // CSS 파일 가져오기 함수 (재귀적으로 @import도 처리)
    async function fetchCssWithImports(cssUrl: string, depth: number = 0): Promise<void> {
      // 최대 깊이 제한 및 중복 방지
      if (depth > 2 || fetchedCssUrls.has(cssUrl) || cssContents.length >= 15) {
        return
      }
      
      // 제외 패턴 확인
      if (excludeCssPatterns.some(pattern => pattern.test(cssUrl))) {
        return
      }
      
      fetchedCssUrls.add(cssUrl)
      
      try {
        const cssResponse = await fetch(cssUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          },
        })
        if (cssResponse.ok) {
          const cssContent = await cssResponse.text()
          cssContents.push({ url: cssUrl, content: cssContent })
          
          // @import 문 추출
          const importRegex = /@import\s+(?:url\s*\()?["']?([^"'\)\s;]+)["']?\)?/gi
          let importMatch
          const importUrls: string[] = []
          
          while ((importMatch = importRegex.exec(cssContent)) !== null) {
            let importUrl = importMatch[1].trim()
            
            // 상대 경로를 절대 경로로 변환
            if (importUrl.startsWith('//')) {
              importUrl = 'https:' + importUrl
            } else if (importUrl.startsWith('/')) {
              importUrl = baseUrl + importUrl
            } else if (!importUrl.startsWith('http')) {
              // CSS 파일 기준 상대 경로
              const cssPathParts = cssUrl.split('/')
              cssPathParts.pop() // 파일명 제거
              importUrl = cssPathParts.join('/') + '/' + importUrl
            }
            
            importUrls.push(importUrl)
          }
          
          // @import된 CSS 파일들도 가져오기
          for (const importUrl of importUrls) {
            await fetchCssWithImports(importUrl, depth + 1)
          }
        }
      } catch (e) {
        console.error(`CSS 가져오기 실패: ${cssUrl}`, e)
      }
    }
    
    // 모든 CSS 파일 가져오기
    for (const cssUrl of allCssLinks.slice(0, 10)) {
      await fetchCssWithImports(cssUrl, 0)
      if (cssContents.length >= 15) break
    }

    return NextResponse.json({
      html: htmlPages.map(page => ({
        url: page.url,
        content: page.content,
      })),
      css: cssContents,
      baseUrl,
      pagesCount: htmlPages.length,
    })
  } catch (error) {
    console.error('URL 가져오기 오류:', error)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
