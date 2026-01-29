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
  modal: boolean
  icons: boolean
  pagination: boolean
  badge: boolean
  accordion: boolean
  colors: boolean
  favicon: boolean
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
