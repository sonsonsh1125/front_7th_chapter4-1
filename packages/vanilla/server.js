import express from "express";
import compression from "compression";
import sirv from "sirv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readdirSync } from "fs";
import { render } from "./dist/vanilla-ssr/main-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const prod = process.env.NODE_ENV === "production";
const port = process.env.PORT || 5174;
const base = process.env.BASE || (prod ? "/front_7th_chapter4-1/vanilla/" : "/");

const app = express();

/**
 * 프로덕션 환경에서 빌드된 파일명 찾기
 */
function findAssetFiles() {
  if (!prod) {
    return { js: "index.js", css: "index.css" };
  }

  try {
    const assetsDir = join(__dirname, "dist/vanilla/assets");
    const files = readdirSync(assetsDir);

    const jsFile = files.find((file) => file.startsWith("index-") && file.endsWith(".js"));
    const cssFile = files.find((file) => file.startsWith("index-") && file.endsWith(".css"));

    return {
      js: jsFile ? `assets/${jsFile}` : "assets/index.js",
      css: cssFile ? `assets/${cssFile}` : "assets/index.css",
    };
  } catch (error) {
    console.warn("Failed to find asset files, using default names:", error.message);
    return { js: "assets/index.js", css: "assets/index.css" };
  }
}

const assetFiles = findAssetFiles();

/**
 * HTML 템플릿 생성 함수
 */
function createHtmlTemplate(html, baseUrl, isProd, assets) {
  const cssPath = `${baseUrl}${assets.css}`;
  const jsPath = `${baseUrl}${assets.js}`;

  return `
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="${cssPath}">
    <script>
      tailwind.config = {
        theme: {
          extend: {
            colors: {
              primary: '#3b82f6',
              secondary: '#6b7280'
            }
          }
        }
      }
    </script>
  </head>
  <body class="bg-gray-50">
    <div id="root">${html}</div>
    <script type="module" src="${jsPath}"></script>
  </body>
</html>`.trim();
}

/**
 * SSR 렌더링 미들웨어
 */
async function ssrMiddleware(req, res, next) {
  try {
    const url = req.originalUrl.replace(base, "/") || "/";
    const query = req.query;

    // SSR 렌더링
    const html = await render(url, query);

    // HTML 템플릿 생성 및 응답
    const template = createHtmlTemplate(html, base, prod, assetFiles);
    res.setHeader("Content-Type", "text/html");
    res.send(template);
  } catch (error) {
    if (prod) {
      console.error("SSR Error:", error.message);
    } else {
      console.error("SSR Error:", error);
    }
    next(error);
  }
}

/**
 * 에러 핸들링 미들웨어
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  if (prod) {
    console.error("Server Error:", err.message);
  } else {
    console.error("Server Error:", err);
  }

  const errorMessage = prod ? "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." : err.message;
  const errorDetails = prod
    ? ""
    : `<pre style="text-align: left; margin-top: 20px; padding: 10px; background: #f5f5f5; border-radius: 4px; overflow-x: auto;">${err.stack}</pre>`;

  res.status(500).send(`
<!DOCTYPE html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Server Error</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="bg-gray-50">
    <div class="min-h-screen flex items-center justify-center px-4">
      <div class="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div class="text-red-500 mb-4">
          <svg class="mx-auto h-16 w-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"/>
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">서버 오류가 발생했습니다</h1>
        <p class="text-gray-600 mb-4">${errorMessage}</p>
        ${errorDetails}
        <a href="${base}" class="inline-block mt-6 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
          홈으로 돌아가기
        </a>
      </div>
    </div>
  </body>
</html>
  `);
}

// 압축 미들웨어
app.use(compression());

// 정적 파일 서빙 (빌드된 클라이언트 파일들)
if (prod) {
  app.use(base, sirv(join(__dirname, "dist/vanilla"), { gzip: true, maxAge: 31536000 }));
} else {
  // 개발 환경에서는 Vite가 정적 파일을 서빙하므로 여기서는 SSR만 처리
  // 개발 환경에서는 소스맵 등 디버깅 정보 제공
  app.use((req, res, next) => {
    if (req.path.startsWith("/assets/")) {
      console.log(`[DEV] Asset request: ${req.path}`);
    }
    next();
  });
}

// SSR 렌더링 미들웨어
app.use("*", ssrMiddleware);

// 에러 핸들링 미들웨어
app.use(errorMiddleware);

// 서버 시작
app.listen(port, () => {
  console.log("=".repeat(50));
  console.log(`🚀 Vanilla SSR Server started`);
  console.log(`📍 URL: http://localhost:${port}`);
  console.log(`📂 Base path: ${base}`);
  console.log(`🌍 Environment: ${prod ? "production" : "development"}`);
  if (prod) {
    console.log(`📦 Assets: ${assetFiles.js}, ${assetFiles.css}`);
  }
  console.log("=".repeat(50));
});
