import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { render } from "./dist/vanilla-ssr/main-server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// BASE_URL 설정
const BASE_URL = "";

/**
 * HTML 템플릿 생성 함수
 */
function createHtmlTemplate(html, initialData = null) {
  // 빌드된 HTML 템플릿 읽기
  const templatePath = join(__dirname, "../../dist/vanilla/index.html");
  let template = fs.readFileSync(templatePath, "utf-8");

  // app-html 플레이스홀더 치환
  template = template.replace("<!--app-html-->", html);

  // app-head 플레이스홀더 제거
  template = template.replace("<!--app-head-->", "");

  // 초기 데이터 스크립트 주입 (Hydration을 위해)
  if (initialData) {
    const initialDataScript = `<script>window.__INITIAL_DATA__ = ${JSON.stringify(initialData)};</script>`;
    template = template.replace("</body>", `${initialDataScript}\n  </body>`);
  }

  return template;
}

/**
 * 모든 상품 ID 가져오기
 */
async function getAllProductIds() {
  try {
    // items.json 파일에서 모든 상품 ID 가져오기
    // 여러 경로 시도
    const possiblePaths = [
      join(__dirname, "src/mocks/items.json"),
      join(__dirname, "../src/mocks/items.json"),
      join(__dirname, "../../packages/vanilla/src/mocks/items.json"),
    ];

    for (const itemsPath of possiblePaths) {
      if (fs.existsSync(itemsPath)) {
        const items = JSON.parse(fs.readFileSync(itemsPath, "utf-8"));
        console.log(`✅ items.json 파일 발견: ${itemsPath}`);
        return items.map((item) => item.productId);
      }
    }

    throw new Error("items.json 파일을 찾을 수 없습니다. 시도한 경로: " + possiblePaths.join(", "));
  } catch (error) {
    console.error("❌ 상품 ID 가져오기 실패:", error.message);
    return [];
  }
}

/**
 * 정적 사이트 생성
 */
async function generateStaticSite() {
  console.log("🚀 정적 사이트 생성 시작...");
  console.log(`📁 작업 디렉토리: ${__dirname}`);

  // 서버 빌드 파일 확인
  const serverBuildPath = join(__dirname, "dist/vanilla-ssr/main-server.js");
  if (!fs.existsSync(serverBuildPath)) {
    console.error("❌ 서버 빌드 파일을 찾을 수 없습니다:", serverBuildPath);
    console.error("   먼저 'pnpm run build:server'를 실행해주세요.");
    process.exit(1);
  }

  const distDir = join(__dirname, "../../dist/vanilla");
  if (!fs.existsSync(distDir)) {
    console.error("❌ 클라이언트 빌드 디렉토리를 찾을 수 없습니다:", distDir);
    console.error("   먼저 'pnpm run build:client-for-ssg'를 실행해주세요.");
    process.exit(1);
  }

  const baseUrl = BASE_URL;

  // 1. 홈 페이지 생성
  console.log("📄 홈 페이지 생성 중...");
  try {
    const { html, initialData } = await render(`${baseUrl}/`, {});
    const homeHtml = createHtmlTemplate(html, initialData);
    fs.writeFileSync(join(distDir, "index.html"), homeHtml);
    console.log("✅ 홈 페이지 생성 완료");
  } catch (error) {
    console.error("❌ 홈 페이지 생성 실패:", error);
  }

  // 2. 모든 상품 상세 페이지 생성
  console.log("📄 상품 상세 페이지 생성 중...");
  const productIds = await getAllProductIds();
  console.log(`   총 ${productIds.length}개의 상품 페이지 생성 예정`);

  let successCount = 0;
  let failCount = 0;

  for (const productId of productIds) {
    try {
      const url = `${baseUrl}/product/${productId}`;
      const { html, initialData } = await render(url, {});

      // product 디렉토리 생성
      const productDir = join(distDir, "product", productId);
      if (!fs.existsSync(productDir)) {
        fs.mkdirSync(productDir, { recursive: true });
      }

      // HTML 파일 생성
      const productHtml = createHtmlTemplate(html, initialData);
      fs.writeFileSync(join(productDir, "index.html"), productHtml);

      successCount++;
      if (successCount % 10 === 0) {
        console.log(`   진행 중... ${successCount}/${productIds.length}`);
      }
    } catch (error) {
      console.error(`❌ 상품 ${productId} 페이지 생성 실패:`, error.message);
      failCount++;
    }
  }

  console.log(`✅ 상품 상세 페이지 생성 완료: 성공 ${successCount}개, 실패 ${failCount}개`);

  // 3. 404 페이지 생성 (NotFoundPage)
  console.log("📄 404 페이지 생성 중...");
  try {
    const { html, initialData } = await render(`${baseUrl}/not-found-page`, {});
    const notFoundHtml = createHtmlTemplate(html, initialData);
    fs.writeFileSync(join(distDir, "404.html"), notFoundHtml);
    console.log("✅ 404 페이지 생성 완료");
  } catch (error) {
    console.error("❌ 404 페이지 생성 실패:", error);
  }

  console.log("🎉 정적 사이트 생성 완료!");
}

// 실행
generateStaticSite().catch((error) => {
  console.error("정적 사이트 생성 중 오류 발생:", error);
  process.exit(1);
});
