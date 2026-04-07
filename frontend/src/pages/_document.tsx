import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="th">
      <Head>
        {/* Character Set */}
        <meta charSet="utf-8" />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* SEO Meta Tags */}
        <meta name="description" content="ระบบจัดการแรงงาน - Labor Management System สำหรับการบันทึกข้อมูลแรงงานรายวัน การคำนวณค่าแรง และการจัดการโครงการ" />
        <meta name="keywords" content="ระบบจัดการแรงงาน, Labor Management, Daily Report, Wage Calculation, แรงงานรายวัน, ค่าแรง" />
        <meta name="author" content="Labor Management System" />
        <meta name="theme-color" content="#2b2337" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="ระบบจัดการแรงงาน - Labor Management System" />
        <meta property="og:description" content="ระบบจัดการแรงงานรายวัน การคำนวณค่าแรง และการจัดการโครงการ" />
        <meta property="og:locale" content="th_TH" />

        {/* Fonts */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Icons"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
