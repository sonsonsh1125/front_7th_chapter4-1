import { HomePage, NotFoundPage, ProductDetailPage } from "./pages";
import { BASE_URL } from "./constants.js";
import { router } from "./router";
import { getCategories, getProduct, getProducts } from "./api/productApi.js";
import {
  productStore,
  PRODUCT_ACTIONS,
  initialProductState,
  cartStore,
  CART_ACTIONS,
  uiStore,
  UI_ACTIONS,
} from "./stores/index.js";

// 서버 환경에서 라우트 등록
router.addRoute("/", HomePage);
router.addRoute("/product/:id", ProductDetailPage);

/**
 * 서버 환경에서 모든 스토어 초기화
 * 각 요청마다 독립적인 상태를 보장하기 위해 호출
 */
function initializeStores() {
  // Product Store 초기화
  productStore.dispatch({
    type: PRODUCT_ACTIONS.SETUP,
    payload: {
      ...initialProductState,
      loading: true,
      status: "pending",
    },
  });

  // Cart Store 초기화 (서버에서는 빈 장바구니)
  cartStore.dispatch({
    type: CART_ACTIONS.CLEAR_CART,
  });

  // UI Store 초기화
  uiStore.dispatch({
    type: UI_ACTIONS.CLOSE_CART_MODAL,
  });
  uiStore.dispatch({
    type: UI_ACTIONS.HIDE_TOAST,
  });
}

// 서버 사이드 라우트 매칭 함수
function findRoute(url, baseUrl = "") {
  const pathname = url.split("?")[0]; // 쿼리 제거
  const cleanPath = pathname.replace(baseUrl, "").replace(/\/$/, "") || "/";

  // 라우트 패턴 매칭
  const routes = [
    { pattern: "/", handler: HomePage },
    { pattern: "/product/:id", handler: ProductDetailPage },
  ];

  for (const route of routes) {
    const paramNames = [];
    const regexPath = route.pattern
      .replace(/:\w+/g, (match) => {
        paramNames.push(match.slice(1));
        return "([^/]+)";
      })
      .replace(/\//g, "\\/");

    const regex = new RegExp(`^${regexPath}$`);
    const match = cleanPath.match(regex);

    if (match) {
      const params = {};
      paramNames.forEach((name, index) => {
        params[name] = match[index + 1];
      });

      return {
        handler: route.handler,
        params,
      };
    }
  }

  // 매칭되는 라우트가 없으면 NotFoundPage
  return {
    handler: NotFoundPage,
    params: {},
  };
}

/**
 * 서버 환경에서 상품 목록 데이터 프리패칭
 */
async function prefetchProducts(query = {}) {
  try {
    // 상품 목록과 카테고리 동시에 가져오기
    const [productsResponse, categories] = await Promise.all([getProducts(query), getCategories()]);

    // 스토어에 데이터 설정
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SETUP,
      payload: {
        products: productsResponse.products,
        categories,
        totalCount: productsResponse.pagination.total,
        loading: false,
        status: "done",
        error: null,
      },
    });
  } catch (error) {
    console.error("상품 목록 프리패칭 실패:", error);
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_ERROR,
      payload: error.message,
    });
  }
}

/**
 * 서버 환경에서 상품 상세 데이터 프리패칭
 */
async function prefetchProductDetail(productId) {
  try {
    // 상품 상세 정보 가져오기
    const product = await getProduct(productId);

    // 스토어에 현재 상품 설정
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_CURRENT_PRODUCT,
      payload: product,
    });

    // 관련 상품도 가져오기 (같은 category2 기준)
    if (product.category2) {
      try {
        const relatedResponse = await getProducts({
          category2: product.category2,
          limit: 20,
          page: 1,
        });

        // 현재 상품 제외
        const relatedProducts = relatedResponse.products.filter((p) => p.productId !== productId);

        productStore.dispatch({
          type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
          payload: relatedProducts,
        });
      } catch (error) {
        console.error("관련 상품 프리패칭 실패:", error);
        // 관련 상품 로드 실패는 조용히 처리
        productStore.dispatch({
          type: PRODUCT_ACTIONS.SET_RELATED_PRODUCTS,
          payload: [],
        });
      }
    }
  } catch (error) {
    console.error("상품 상세 프리패칭 실패:", error);
    productStore.dispatch({
      type: PRODUCT_ACTIONS.SET_ERROR,
      payload: error.message,
    });
  }
}

/**
 * 서버 사이드 렌더링 함수
 * @param {string} url - 요청 URL
 * @param {Object} query - 쿼리 파라미터 객체
 * @returns {Promise<string>} 렌더링된 HTML 문자열
 */
export const render = async (url, query = {}) => {
  try {
    // BASE_URL 제거
    const cleanUrl = url.replace(BASE_URL, "").replace(/\/$/, "") || "/";

    // 라우트 찾기
    const route = findRoute(cleanUrl, BASE_URL);

    // 서버 환경에서 router 객체 설정
    router.setServerRoute(cleanUrl, query, route.params);

    // 모든 스토어 초기화 (각 요청마다 독립적인 상태 보장)
    initializeStores();

    // 라우트에 따라 데이터 프리패칭
    if (route.params.id) {
      // 상품 상세 페이지
      await prefetchProductDetail(route.params.id);
    } else {
      // 홈 페이지 (상품 목록)
      await prefetchProducts(query);
    }

    // 페이지 컴포넌트 실행
    const html = route.handler();

    return html || "";
  } catch (error) {
    console.error("SSR Render Error:", error);
    // 에러 발생 시 기본 페이지 반환
    return NotFoundPage();
  }
};
