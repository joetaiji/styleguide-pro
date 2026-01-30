'use client'

import { useState, useCallback } from 'react'
import { Upload, Settings, FileText, FolderOpen, Trash2, Download, Copy, Eye, Loader2, CheckCircle, X, Sparkles, LayoutGrid, Palette, Type, FileCode, BarChart3, Rocket, ClipboardList, HelpCircle } from 'lucide-react'
import type { UploadedFile, AnalysisResult, SectionOptions, StyleOptions, ProjectInfo, TabType, AdditionalClasses } from '@/types'
import { analyzeFiles } from '@/lib/analyzer'
import { buildStyleGuide } from '@/lib/builder'
import { storeImage, clearImageStore, imageMimeTypes } from '@/lib/imageStore'
import JSZip from 'jszip'

const defaultSectionOptions: SectionOptions = {
  layout: true,
  typography: true,
  buttons: true,
  forms: true,
  tables: true,
  boxes: true,
  lists: true,
  modal: true,
  icons: true,
  pagination: true,
  badge: true,
  accordion: true,
  colors: true,
  favicon: true,
}

const defaultStyleOptions: StyleOptions = {
  darkmode: false,
  codeblock: true,
  toc: true,
  responsive: true,
  fontFamily: 'pretendard',
}

const defaultAdditionalClasses: AdditionalClasses = {
  colors: '',
  typography: '',
  icons: '',
  badge: '',
  lists: '',
  tables: '',
  buttons: '',
  forms: '',
  boxes: '',
  modal: '',
  pagination: '',
  accordion: '',
}

export default function Home() {
  const [showIntro, setShowIntro] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>('upload')
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [generatedHTML, setGeneratedHTML] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [showPreview, setShowPreview] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showFileTip, setShowFileTip] = useState(false)

  const [sectionOptions, setSectionOptions] = useState<SectionOptions>(defaultSectionOptions)
  const [styleOptions, setStyleOptions] = useState<StyleOptions>(defaultStyleOptions)
  const [additionalClasses, setAdditionalClasses] = useState<AdditionalClasses>(defaultAdditionalClasses)
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({ name: 'UI Style Guide', version: '1.0.0' })

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    await handleFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleFileInput = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await handleFiles(Array.from(e.target.files))
    }
  }, [])

  const handleFiles = async (fileList: File[]) => {
    const newFiles: UploadedFile[] = [...files]

    for (const file of fileList) {
      const ext = file.name.split('.').pop()?.toLowerCase() || ''

      if (ext === 'zip') {
        await handleZipFile(file, newFiles)
      } else if (['html', 'htm', 'css', 'js'].includes(ext)) {
        const content = await file.text()
        newFiles.push({
          name: file.name,
          type: ext === 'htm' ? 'html' : ext as 'html' | 'css' | 'js',
          size: file.size,
          content,
        })
      }
    }

    setFiles(newFiles)
    if (newFiles.length > 0) {
      const result = analyzeFiles(newFiles)
      setAnalysisResult(result)
    }
  }

  const handleZipFile = async (file: File, newFiles: UploadedFile[]) => {
    try {
      const zip = await JSZip.loadAsync(file)
      const zipFileName = file.name

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue

        const ext = relativePath.split('.').pop()?.toLowerCase() || ''

        if (['html', 'htm', 'css', 'js'].includes(ext)) {
          const content = await zipEntry.async('string')
          newFiles.push({
            name: relativePath,
            type: ext === 'htm' ? 'html' : ext as 'html' | 'css' | 'js',
            size: content.length,
            content,
            fromZip: zipFileName,
          })
        } else if (imageMimeTypes[ext]) {
          const base64 = await zipEntry.async('base64')
          const dataUrl = `data:${imageMimeTypes[ext]};base64,${base64}`
          storeImage(relativePath, dataUrl)
          newFiles.push({
            name: relativePath,
            type: 'image',
            size: base64.length,
            content: dataUrl,
            fromZip: zipFileName,
          })
        }
      }

      showToast(`${zipFileName} 압축 해제 완료`, 'info')
    } catch (error) {
      console.error('ZIP 처리 오류:', error)
      showToast('ZIP 파일 처리 중 오류가 발생했습니다', 'error')
    }
  }

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index)
    setFiles(newFiles)
    if (newFiles.length > 0) {
      setAnalysisResult(analyzeFiles(newFiles))
    } else {
      setAnalysisResult(null)
    }
  }

  const clearFiles = () => {
    setFiles([])
    setAnalysisResult(null)
    clearImageStore()
  }

  const generateGuide = async () => {
    if (files.length === 0) {
      showToast('파일을 먼저 업로드해주세요', 'error')
      return
    }

    setIsLoading(true)
    setProgress(0)

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev
        return prev + Math.random() * 15
      })
    }, 200)

    await new Promise((resolve) => setTimeout(resolve, 1500))

    clearInterval(interval)
    setProgress(100)

    const result = analysisResult || analyzeFiles(files)
    const html = buildStyleGuide(files, result, sectionOptions, styleOptions, projectInfo, additionalClasses)
    setGeneratedHTML(html)

    setTimeout(() => {
      setIsLoading(false)
      setActiveTab('result')
      showToast('스타일 가이드가 생성되었습니다!', 'info')
    }, 500)
  }

  const downloadResult = () => {
    const blob = new Blob([generatedHTML], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'styleguide.html'
    a.click()
    URL.revokeObjectURL(url)
    showToast('파일이 다운로드되었습니다', 'info')
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(generatedHTML)
      showToast('코드가 클립보드에 복사되었습니다', 'info')
    } catch {
      showToast('복사에 실패했습니다', 'error')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const getFileIconColor = (type: string) => {
    switch (type) {
      case 'html': return 'bg-orange-500'
      case 'css': return 'bg-blue-600'
      case 'js': return 'bg-yellow-400 text-black'
      case 'image': return 'bg-gray-600'
      default: return 'bg-gray-400'
    }
  }

  // 인트로 화면
  if (showIntro) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: '#C5D5E4' }}>
        {/* 스토리 애니메이션: 코드 → 추출 → 스타일가이드 */}
        <div className="rounded-3xl p-8 mb-10" style={{ background: 'rgba(156, 175, 192, 0.4)' }}>
          <div className="flex items-center gap-6">
            {/* Step 1: 코드 파일 (스캔 중) */}
            <div className="animate-fade-in-up">
              <div className="w-40 h-48 rounded-lg shadow-xl animate-code-scan" style={{ background: '#1E1E1E' }}>
                <div className="p-3">
                  <div className="flex gap-1.5 mb-3">
                    <div className="w-2 h-2 rounded-full bg-red-400"></div>
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div>
                    <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  </div>
                  <div className="text-[10px] text-gray-500 mb-2 font-mono">index.html</div>
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-purple-400/60 rounded w-1/3"></div>
                    <div className="h-1.5 bg-blue-400/60 rounded w-full"></div>
                    <div className="h-1.5 bg-yellow-400/60 rounded w-2/3 ml-3"></div>
                    <div className="h-1.5 bg-green-400/60 rounded w-1/2 ml-3"></div>
                    <div className="h-1.5 bg-blue-400/60 rounded w-3/4 ml-3"></div>
                    <div className="h-1.5 bg-orange-400/60 rounded w-1/2 ml-6"></div>
                    <div className="h-1.5 bg-pink-400/60 rounded w-2/3 ml-6"></div>
                    <div className="h-1.5 bg-blue-400/60 rounded w-1/2 ml-3"></div>
                    <div className="h-1.5 bg-purple-400/60 rounded w-1/3"></div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-2 text-xs text-gray-600 font-medium">코드 분석</div>
            </div>

            {/* 화살표 + 추출 요소들 */}
            <div className="flex flex-col items-center gap-2 w-24">
              {/* 화살표 */}
              <div className="text-2xl text-gray-500 animate-arrow-flow">→</div>
              
              {/* 추출되는 요소들 */}
              <div className="flex flex-wrap justify-center gap-1">
                <div className="w-4 h-4 rounded bg-blue-500 animate-extract-1" title="버튼"></div>
                <div className="w-4 h-4 rounded bg-green-500 animate-extract-2" title="컬러"></div>
                <div className="w-4 h-4 rounded bg-purple-500 animate-extract-3" title="폰트"></div>
                <div className="w-4 h-4 rounded bg-orange-500 animate-extract-4" title="폼"></div>
              </div>
              
              <div className="text-[10px] text-gray-500 text-center">요소 추출</div>
            </div>

            {/* Step 2: 스타일가이드 생성 */}
            <div className="animate-fade-in-up-delay-1">
              <div className="w-48 h-48 rounded-lg shadow-2xl animate-build-glow" style={{ background: '#7FB3D5' }}>
                <div className="p-3 h-full flex flex-col">
                  <div className="text-xs text-white font-semibold mb-2">📋 Style Guide</div>
                  
                  {/* 컬러 팔레트 */}
                  <div className="animate-extract-1">
                    <div className="text-[9px] text-white/70 mb-1">Colors</div>
                    <div className="flex gap-1 mb-2">
                      <div className="w-4 h-4 rounded bg-blue-600"></div>
                      <div className="w-4 h-4 rounded bg-green-600"></div>
                      <div className="w-4 h-4 rounded bg-purple-600"></div>
                      <div className="w-4 h-4 rounded bg-gray-600"></div>
                    </div>
                  </div>
                  
                  {/* 타이포그래피 */}
                  <div className="animate-extract-2">
                    <div className="text-[9px] text-white/70 mb-1">Typography</div>
                    <div className="space-y-0.5 mb-2">
                      <div className="h-2 bg-white/40 rounded w-3/4"></div>
                      <div className="h-1.5 bg-white/30 rounded w-1/2"></div>
                    </div>
                  </div>
                  
                  {/* 버튼 */}
                  <div className="animate-extract-3">
                    <div className="text-[9px] text-white/70 mb-1">Buttons</div>
                    <div className="flex gap-1">
                      <div className="px-2 py-0.5 bg-blue-600 rounded text-[8px] text-white">Primary</div>
                      <div className="px-2 py-0.5 bg-gray-600 rounded text-[8px] text-white">Secondary</div>
                    </div>
                  </div>
                  
                  {/* 프로그레스 바 */}
                  <div className="mt-auto">
                    <div className="h-1 bg-white/20 rounded overflow-hidden">
                      <div className="h-full bg-white/60 rounded animate-build-bar"></div>
                    </div>
                    <div className="text-[8px] text-white/60 text-right mt-0.5">생성 중...</div>
                  </div>
                </div>
              </div>
              <div className="text-center mt-2 text-xs text-gray-600 font-medium">스타일가이드</div>
            </div>
          </div>
        </div>

        {/* 타이틀 */}
        <h1 className="text-4xl font-bold mb-4 animate-fade-in-up-delay-1" style={{ color: '#1E4A6D' }}>StyleGuide Pro</h1>
        
        {/* 설명 */}
        <p className="text-gray-600 text-center max-w-md mb-8 px-4 animate-fade-in-up-delay-1">
          코드에서 UI 요소를 자동으로 추출하여 스타일가이드를 생성합니다.
        </p>

        {/* 시작 버튼 */}
        <button
          onClick={() => setShowIntro(false)}
          className="flex items-center gap-2 px-10 py-4 rounded-full text-white font-semibold text-lg transition-all hover:scale-105 hover:shadow-xl animate-fade-in-up-delay-2"
          style={{ background: '#2D3E50' }}
        >
          <Sparkles size={20} />
          Start
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 h-16 flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-krds-primary to-krds-primary-dark rounded-lg flex items-center justify-center text-white">
              <ClipboardList size={20} />
            </div>
            <span className="font-bold text-lg text-krds-primary">StyleGuide Pro</span>
          </div>
          
          <nav className="ml-auto flex gap-1">
            {[
              { id: 'upload', label: '파일 업로드 및 설정', icon: Upload },
              { id: 'result', label: '결과', icon: FileText },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as TabType)}
                className={`px-5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                  activeTab === id
                    ? 'bg-krds-primary-light text-krds-primary'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* 메인 */}
      <main className="flex-1 w-full">
        {/* 업로드 탭 - 2컬럼 레이아웃 */}
        {activeTab === 'upload' && (
          <div className="flex gap-0 h-full">
            {/* 왼쪽: 설정 패널 */}
            <div className="w-80 flex-shrink-0 bg-white border-r border-gray-200 p-6 overflow-y-auto h-[calc(100vh-64px)]">
              <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Settings size={18} /> 생성 설정</h2>
              
              {/* 포함할 섹션 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><LayoutGrid size={14} /> 포함할 섹션</h3>
                <p className="text-xs text-gray-500 mb-3">추가 클래스: 쉼표로 구분하여 입력 (예: .btn-lg, .btn-sm)</p>
                <div className="space-y-3">
                  {[
                    { key: 'colors', label: '컬러 팔레트', hasInput: false },
                    { key: 'typography', label: '타이포그래피', hasInput: true },
                    { key: 'icons', label: '아이콘', hasInput: false },
                    { key: 'badge', label: '배지', hasInput: true },
                    { key: 'lists', label: '리스트', hasInput: true },
                    { key: 'tables', label: '테이블', hasInput: true },
                    { key: 'buttons', label: '버튼', hasInput: true },
                    { key: 'forms', label: '폼 요소', hasInput: true },
                    { key: 'favicon', label: '파비콘/OG', hasInput: false },
                    { key: 'boxes', label: '박스/카드', hasInput: true },
                    { key: 'modal', label: '모달', hasInput: true },
                    { key: 'pagination', label: '페이지네이션', hasInput: true },
                    { key: 'accordion', label: '아코디언', hasInput: true },
                  ].map(({ key, label, hasInput }) => (
                    <div key={key} className="space-y-1">
                      <label className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded">
                        <input
                          type="checkbox"
                          checked={sectionOptions[key as keyof SectionOptions]}
                          onChange={(e) => setSectionOptions({ ...sectionOptions, [key]: e.target.checked })}
                          className="w-4 h-4 accent-krds-primary"
                        />
                        <span className="text-sm text-gray-700">{label}</span>
                      </label>
                      {hasInput && sectionOptions[key as keyof SectionOptions] && (
                        <input
                          type="text"
                          placeholder="추가 클래스명..."
                          value={additionalClasses[key as keyof AdditionalClasses]}
                          onChange={(e) => setAdditionalClasses({ ...additionalClasses, [key]: e.target.value })}
                          className="w-full ml-6 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-krds-primary"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 스타일 옵션 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><Palette size={14} /> 스타일 옵션</h3>
                <div className="space-y-2">
                  {[
                    { key: 'codeblock', label: '코드 블록 포함' },
                    { key: 'toc', label: '목차(TOC) 생성' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1.5 rounded">
                      <input
                        type="checkbox"
                        checked={styleOptions[key as keyof typeof styleOptions] as boolean}
                        onChange={(e) => setStyleOptions({ ...styleOptions, [key]: e.target.checked })}
                        className="w-4 h-4 accent-krds-primary"
                      />
                      <span className="text-sm text-gray-700">{label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* 폰트 설정 */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><Type size={14} /> 폰트 설정</h3>
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 cursor-pointer p-2 rounded border ${styleOptions.fontFamily === 'pretendard' ? 'border-krds-primary bg-krds-primary-light' : 'border-gray-200'}`}>
                    <input
                      type="radio"
                      name="fontFamily"
                      checked={styleOptions.fontFamily === 'pretendard'}
                      onChange={() => setStyleOptions({ ...styleOptions, fontFamily: 'pretendard' })}
                      className="w-4 h-4 accent-krds-primary"
                    />
                    <span className="text-sm text-gray-700">Pretendard GOV</span>
                  </label>
                  <label className={`flex items-center gap-2 cursor-pointer p-2 rounded border ${styleOptions.fontFamily === 'notosans' ? 'border-krds-primary bg-krds-primary-light' : 'border-gray-200'}`}>
                    <input
                      type="radio"
                      name="fontFamily"
                      checked={styleOptions.fontFamily === 'notosans'}
                      onChange={() => setStyleOptions({ ...styleOptions, fontFamily: 'notosans' })}
                      className="w-4 h-4 accent-krds-primary"
                    />
                    <span className="text-sm text-gray-700">Noto Sans KR</span>
                  </label>
                </div>
                <p className="text-xs text-gray-500 mt-2">ℹ️ Remixicon 아이콘 포함</p>
              </div>

              {/* 프로젝트 정보 */}
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5"><FileCode size={14} /> 프로젝트 정보</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">프로젝트명</label>
                    <input
                      type="text"
                      value={projectInfo.name}
                      onChange={(e) => setProjectInfo({ ...projectInfo, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-krds-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">버전</label>
                    <input
                      type="text"
                      value={projectInfo.version}
                      onChange={(e) => setProjectInfo({ ...projectInfo, version: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded text-sm focus:outline-none focus:border-krds-primary"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 오른쪽: 업로드 영역 */}
            <div className="flex-1 panel min-h-[calc(100vh-64px)]">
              <div className="panel-header">
                <h2 className="text-xl font-bold text-gray-900">파일 업로드</h2>
                <p className="text-sm text-gray-500 mt-1">분석할 HTML, CSS, JS 파일을 업로드하거나 ZIP 파일을 선택하세요</p>
              </div>
              <div className="panel-body">
              {/* 드롭존 */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-16 text-center bg-gray-50 hover:border-krds-primary hover:bg-krds-primary-light transition-all cursor-pointer"
                onClick={() => document.getElementById('fileInput')?.click()}
              >
                <div className="mb-4 flex justify-center"><FolderOpen size={56} className="text-gray-400" /></div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">파일을 드래그하여 업로드하세요</h3>
                <p className="text-sm text-gray-500 mb-5">HTML, CSS, JS 파일 또는 ZIP 압축파일을 지원합니다</p>
                <button className="btn btn-primary">
                  <FolderOpen size={18} />
                  파일 선택
                </button>
                <input
                  type="file"
                  id="fileInput"
                  className="hidden"
                  multiple
                  accept=".html,.htm,.css,.js,.zip"
                  onChange={handleFileInput}
                />
              </div>

              {/* 파일 목록 */}
              {files.length > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                      업로드된 파일
                      <span className="bg-krds-primary text-white text-xs px-2.5 py-0.5 rounded-full">{files.length}</span>
                      <div className="relative">
                        <button 
                          onClick={() => setShowFileTip(!showFileTip)}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                          title="도움말"
                        >
                          <HelpCircle size={18} />
                        </button>
                        {showFileTip && (
                          <div className="absolute left-0 top-full mt-2 z-50 w-64 p-3 bg-gray-800 text-white text-xs rounded-lg shadow-lg">
                            <div className="flex justify-between items-start gap-2">
                              <p>불필요하거나 중복된 파일을 제거하면 더 좋은 결과를 얻을 수 있습니다.</p>
                              <button onClick={() => setShowFileTip(false)} className="text-gray-400 hover:text-white flex-shrink-0">
                                <X size={14} />
                              </button>
                            </div>
                            <div className="absolute -top-1.5 left-3 w-3 h-3 bg-gray-800 rotate-45"></div>
                          </div>
                        )}
                      </div>
                    </h3>
                    <button onClick={clearFiles} className="btn btn-secondary text-sm py-2 px-4">
                      <Trash2 size={14} />
                      전체 삭제
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-2">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-krds-primary transition-colors">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-xs ${getFileIconColor(file.type)}`}>
                          {file.type === 'image' ? 'IMG' : file.type.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-gray-800 truncate" title={file.name}>{file.name}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{formatFileSize(file.size)}</span>
                            {file.fromZip && <span>📦 {file.fromZip}</span>}
                          </div>
                        </div>
                        <button onClick={() => removeFile(index)} className="text-gray-400 hover:text-red-500 p-1">
                          <X size={18} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 분석 결과 */}
              {analysisResult && (
                <div className="mt-8">
                  <h3 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2"><BarChart3 size={18} /> 분석 결과</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                    {[
                      { label: 'HTML', value: analysisResult.htmlFiles },
                      { label: 'CSS', value: analysisResult.cssFiles },
                      { label: 'JS', value: analysisResult.jsFiles },
                      { label: '이미지', value: analysisResult.imageFiles },
                      { label: '클래스', value: analysisResult.classes.size },
                      { label: '버튼', value: analysisResult.buttons.length },
                      { label: '아이콘', value: analysisResult.icons.size },
                      { label: 'CSS변수', value: analysisResult.cssVariables.length },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-gray-50 rounded-lg p-4 text-center border border-gray-200">
                        <div className="text-2xl font-bold text-krds-primary">{value}</div>
                        <div className="text-xs text-gray-500 mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 생성 버튼 */}
              <div className="mt-8 pt-8 border-t border-gray-200 text-center">
                {isLoading ? (
                  <div className="max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-3 mb-4">
                      <Loader2 className="animate-spin text-krds-primary" size={24} />
                      <span className="font-semibold text-gray-700">스타일 가이드 생성 중...</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-krds-primary to-krds-info transition-all duration-300"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">{Math.round(progress)}%</p>
                  </div>
                ) : (
                  <button onClick={generateGuide} className="btn btn-tertiary text-lg px-10 py-4">
                    <Rocket size={22} />
                    스타일 가이드 생성하기
                  </button>
                )}
              </div>
            </div>
          </div>
          </div>
        )}

        {/* 결과 탭 */}
        {activeTab === 'result' && (
          <div className="panel">
            <div className="panel-header">
              <h2 className="text-xl font-bold text-gray-900">생성 결과</h2>
              <p className="text-sm text-gray-500 mt-1">생성된 스타일 가이드를 미리보기하고 다운로드하세요</p>
            </div>
            <div className="panel-body">
              {!generatedHTML ? (
                <div className="text-center py-20 text-gray-500">
                  <div className="text-6xl mb-6">📄</div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">아직 생성된 스타일 가이드가 없습니다</h3>
                  <p className="text-sm">파일을 업로드하고 생성 버튼을 클릭해주세요</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2 text-gray-900 font-semibold">
                      <CheckCircle size={20} className="text-gray-400" />
                      생성 완료!
                    </div>
                    <div className="flex gap-3">
                      <button onClick={downloadResult} className="btn btn-tertiary">
                        <Download size={16} />
                        다운로드
                      </button>
                    </div>
                  </div>

                  <iframe
                    srcDoc={generatedHTML}
                    sandbox="allow-same-origin allow-scripts"
                    className="w-full h-[calc(100vh-280px)] border border-gray-200 rounded-lg bg-white"
                  />
                </>
              )}
            </div>
          </div>
        )}
      </main>

      {/* 토스트 */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 px-6 py-4 rounded-lg shadow-lg text-white flex items-center gap-3 animate-in slide-in-from-bottom-4 ${
            toast.type === 'success' ? 'bg-krds-success' :
            toast.type === 'error' ? 'bg-krds-danger' :
            'bg-gray-600'
          }`}
        >
          {toast.type === 'success' && <CheckCircle size={20} />}
          {toast.message}
        </div>
      )}
    </div>
  )
}
