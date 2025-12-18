import fs from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * 파일 시스템 기반 배포 스크립트
 * 빌드된 정적 파일들을 배포 디렉토리로 복사
 */
async function deploy() {
  console.log("🚀 파일 시스템 기반 배포 시작...");

  const sourceDir = join(__dirname, "../../dist/vanilla");
  const deployDir = process.env.DEPLOY_DIR || join(__dirname, "../../dist/deploy/vanilla");

  // 소스 디렉토리 확인
  if (!fs.existsSync(sourceDir)) {
    console.error(`❌ 소스 디렉토리를 찾을 수 없습니다: ${sourceDir}`);
    console.error("   먼저 'pnpm run build:ssg'를 실행해주세요.");
    process.exit(1);
  }

  // 배포 디렉토리 생성
  if (fs.existsSync(deployDir)) {
    console.log(`🗑️  기존 배포 디렉토리 삭제: ${deployDir}`);
    fs.rmSync(deployDir, { recursive: true, force: true });
  }
  fs.mkdirSync(deployDir, { recursive: true });

  console.log(`📦 소스: ${sourceDir}`);
  console.log(`📤 배포: ${deployDir}`);

  // 디렉토리 복사 함수
  function copyDirectory(src, dest) {
    const entries = fs.readdirSync(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = join(src, entry.name);
      const destPath = join(dest, entry.name);

      if (entry.isDirectory()) {
        fs.mkdirSync(destPath, { recursive: true });
        copyDirectory(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
  }

  // 파일 복사
  console.log("📋 파일 복사 중...");
  copyDirectory(sourceDir, deployDir);

  // 배포 정보 파일 생성
  const deployInfo = {
    timestamp: new Date().toISOString(),
    source: sourceDir,
    destination: deployDir,
    files: countFiles(deployDir),
  };

  fs.writeFileSync(join(deployDir, ".deploy-info.json"), JSON.stringify(deployInfo, null, 2));

  console.log(`✅ 배포 완료!`);
  console.log(`   배포 디렉토리: ${deployDir}`);
  console.log(`   생성된 파일 수: ${deployInfo.files}`);
  console.log(`   배포 정보: .deploy-info.json`);
}

/**
 * 디렉토리 내 파일 개수 계산
 */
function countFiles(dir) {
  let count = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      count += countFiles(fullPath);
    } else {
      count++;
    }
  }

  return count;
}

// 실행
deploy().catch((error) => {
  console.error("배포 중 오류 발생:", error);
  process.exit(1);
});
