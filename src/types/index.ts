export interface UploadedFile {
  name: string
  type: 'html' | 'css' | 'js' | 'image'
  size: number
  content: string
  fromZip?: string
}

export interface ExtractedMarkup {
  buttons: ComponentMarkup[]
  forms: ComponentMarkup[]
  tables: ComponentMarkup[]
  boxes: ComponentMarkup[]
  helperBoxes: ComponentMarkup[]
  lists: ComponentMarkup[]
  stepLists: ComponentMarkup[]
  breadcrumbs: ComponentMarkup[]
  menus: ComponentMarkup[]
  leftMenus: ComponentMarkup[]
  tabs: ComponentMarkup[]
  paginations: ComponentMarkup[]
  modals: ComponentMarkup[]
  badges: ComponentMarkup[]
  accordions: ComponentMarkup[]
}

export interface ComponentMarkup {
  classes: string
  html: string
  text?: string
  count?: number
}

export interface CSSVariable {
  name: string
  value: string
  category: 'color' | 'size' | 'font' | 'other'
}

export interface AnalysisResult {
  htmlFiles: number
  cssFiles: number
  jsFiles: number
  imageFiles: number
  classes: Set<string>
  ids: Set<string>
  tags: Set<string>
  colors: Set<string>
  cssVariables: CSSVariable[]
  buttons: { classes: string; text: string }[]
  inputs: { type: string; classes: string }[]
  tables: string[]
  modals: string[]
  icons: Set<string>
  components: ComponentCategories
  extractedMarkup: ExtractedMarkup
  hasFavicon: boolean
  hasOG: boolean
  favicons: FaviconInfo[]
  ogTags: OGTagInfo[]
  typographyInfo: TypographyInfo[]
}

export interface FaviconInfo {
  rel: string
  href: string
  sizes?: string
  type?: string
}

export interface OGTagInfo {
  property: string
  content: string
}

export interface TypographyInfo {
  className: string
  tagName: string
  text?: string
  count?: number
}

export interface ComponentCategories {
  buttons: string[]
  forms: string[]
  tables: string[]
  boxes: string[]
  lists: string[]
  modals: string[]
  tabs: string[]
  pagination: string[]
  typography: string[]
  badges: string[]
  accordions: string[]
}

export interface SectionOptions {
  layout: boolean
  typography: boolean
  buttons: boolean
  forms: boolean
  tables: boolean
  boxes: boolean
  lists: boolean
  tabs: boolean
  modal: boolean
  icons: boolean
  pagination: boolean
  badge: boolean
  accordion: boolean
  colors: boolean
  favicon: boolean
}

// 각 섹션에 수동으로 추가할 클래스명
export interface AdditionalClasses {
  colors: string
  typography: string
  icons: string
  badge: string
  lists: string
  tabs: string
  tables: string
  buttons: string
  forms: string
  boxes: string
  modal: string
  pagination: string
  accordion: string
}

export interface StyleOptions {
  darkmode: boolean
  codeblock: boolean
  toc: boolean
  responsive: boolean
  fontFamily: 'pretendard' | 'notosans'
}

export type FontFamily = 'pretendard' | 'notosans'

export interface ProjectInfo {
  name: string
  version: string
}

export type TabType = 'upload' | 'settings' | 'result'
