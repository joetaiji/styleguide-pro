import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'StyleGuide Pro',
  description: 'HTML, CSS, JS 파일을 분석하여 자동으로 UI 스타일 가이드를 생성합니다',
  icons: {
    icon: '/icon.svg',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="min-h-screen">
        {children}
      </body>
    </html>
  )
}
